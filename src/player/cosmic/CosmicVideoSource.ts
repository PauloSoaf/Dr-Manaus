import { DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace, Texture, UnsignedByteType, VideoTexture } from 'three/webgpu';

export type CosmicSourceState = 'VIDEO' | 'PROCEDURAL' | 'STATIC';
export interface CosmicTextureSource {
  readonly texture: Texture;
  readonly version: number;
  readonly state: CosmicSourceState;
  readonly aspect: number;
}
export interface CosmicVideoDiagnostics {
  state: CosmicSourceState;
  width: number;
  height: number;
  fps: number;
  decodedFps: number;
  readyState: number;
  decodedFrames: number;
  droppedFrames: number;
  playbackRate: number;
  ownedVideoCount: number;
  activeTextures: number;
  autoplayBlocked: boolean;
  enabled: boolean;
  error: string | null;
  codec: string;
}
export interface CosmicVideoSourceOptions {
  url?: string;
  webmUrl?: string;
  /** Explicit dependency injection keeps lifecycle tests independent of a browser. */
  createVideo?: () => HTMLVideoElement;
  createVideoTexture?: (video: HTMLVideoElement) => Texture;
  gestureTarget?: EventTarget;
  fallback?: 'PROCEDURAL' | 'STATIC';
  autoStart?: boolean;
}

function createFallback(): DataTexture {
  const width = 160, height = 90;
  const pixels = new Uint8Array(width * height * 4);
  let seed = 0x19a8c01;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const ridge = v - .22 - .55 * u + Math.sin(u * 19) * .05;
    const cloud = Math.exp(-ridge * ridge * 52) * (.45 + .2 * Math.sin(u * 37 + v * 24) + .15 * Math.sin(u * 83 - v * 47));
    const star = random() > .987 ? 90 + random() * 165 : 0;
    const index = (y * width + x) * 4;
    pixels[index] = Math.min(255, 1 + cloud * 100 + star * .8);
    pixels[index + 1] = Math.min(255, 2 + cloud * 42 + star * .92);
    pixels[index + 2] = Math.min(255, 5 + cloud * 170 + star);
    pixels[index + 3] = 255;
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, UnsignedByteType);
  texture.name = 'Shared cosmic static fallback';
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** One decoder and one VideoTexture, owned by the main character and shared by limbs/clones. */
export class CosmicVideoSource implements CosmicTextureSource {
  readonly video?: HTMLVideoElement;
  private readonly fallbackTexture = createFallback();
  private readonly videoTextureFactory: (video: HTMLVideoElement) => Texture;
  private readonly gestureTarget?: EventTarget;
  private videoTexture?: Texture;
  private currentTexture: Texture = this.fallbackTexture;
  private currentState: CosmicSourceState;
  private fallbackState: 'PROCEDURAL' | 'STATIC';
  private revision = 0;
  private live = true;
  private active = true;
  private playingRequest?: Promise<void>;
  private frameClock = 0;
  private lastFrames = 0;
  private alternateUrl?: string;
  private triedAlternate = false;
  private manualMode: 'AUTO' | 'PROCEDURAL' | 'STATIC' = 'AUTO';
  private static ownedVideos = 0;
  private readonly stats: CosmicVideoDiagnostics = {
    state: 'PROCEDURAL', width: 960, height: 540, fps: 0, decodedFps: 0, readyState: 0,
    decodedFrames: 0, droppedFrames: 0, playbackRate: 1, ownedVideoCount: 0, activeTextures: 1,
    autoplayBlocked: false, enabled: true, error: null, codec: 'H.264 / AVC',
  };

  constructor(options: CosmicVideoSourceOptions = {}) {
    this.fallbackState = options.fallback ?? 'PROCEDURAL';
    this.currentState = this.fallbackState;
    this.videoTextureFactory = options.createVideoTexture ?? (video => new VideoTexture(video));
    // Test suites and SSR may define a canvas-only document. Do not treat it as a media DOM.
    const create = options.createVideo ?? (typeof document !== 'undefined' && typeof HTMLVideoElement !== 'undefined' ? () => document.createElement('video') : undefined);
    if (!create) return;
    const video = create();
    if (typeof video.play !== 'function' || typeof video.addEventListener !== 'function') return;
    this.video = video;
    CosmicVideoSource.ownedVideos++;
    this.gestureTarget = options.gestureTarget ?? (typeof window !== 'undefined' ? window : undefined);
    const base = import.meta.env?.BASE_URL ?? '/';
    const mp4 = options.url ?? `${base}assets/cosmic/galaxy.mp4`;
    const webm = options.webmUrl ?? `${base}assets/cosmic/galaxy.webm`;
    const mp4Supported = typeof video.canPlayType !== 'function' || !!video.canPlayType('video/mp4; codecs="avc1.64001f"');
    video.src = mp4Supported ? mp4 : webm;
    this.alternateUrl = mp4Supported ? webm : mp4;
    this.stats.codec = mp4Supported ? 'H.264 / AVC' : 'VP9';
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.addEventListener('loadeddata', this.onReady);
    video.addEventListener('playing', this.onPlaying);
    video.addEventListener('error', this.onError);
    this.gestureTarget?.addEventListener('pointerdown', this.onGesture, { passive: true });
    this.gestureTarget?.addEventListener('keydown', this.onGesture);
    if (options.autoStart !== false) void this.ensurePlaying();
  }

  get texture(): Texture { return this.currentTexture; }
  get version(): number { return this.revision; }
  get state(): CosmicSourceState { return this.currentState; }
  get aspect(): number { return this.stats.width / this.stats.height; }
  get enabled(): boolean { return this.active; }
  get diagnostics(): Readonly<CosmicVideoDiagnostics> {
    this.stats.state = this.currentState;
    this.stats.ownedVideoCount = CosmicVideoSource.ownedVideos;
    this.stats.activeTextures = this.live ? 1 + Number(!!this.videoTexture) : 0;
    this.stats.enabled = this.active;
    return this.stats;
  }

  private readonly onGesture = (): void => { void this.ensurePlaying(); };
  private readonly onReady = (): void => {
    if (!this.live) return;
    this.promoteReadyVideo();
    void this.ensurePlaying();
  };
  private readonly onPlaying = (): void => {
    if (!this.live) return;
    this.stats.autoplayBlocked = false;
    this.stats.error = null;
    this.promoteReadyVideo();
  };
  private readonly onError = (): void => {
    if (!this.live || !this.video) return;
    this.currentState = this.fallbackState;
    this.stats.error = `Video load/decode error ${this.video.error?.code ?? 'unknown'}`;
    // A codec/network failure gets one local alternative; neither URL is external.
    if (!this.triedAlternate && this.alternateUrl && !this.videoTexture) {
      this.triedAlternate = true;
      this.video.src = this.alternateUrl;
      this.stats.codec = this.stats.codec === 'VP9' ? 'H.264 / AVC' : 'VP9';
      this.video.load();
      void this.ensurePlaying();
    }
  };

  private promoteReadyVideo(): void {
    const video = this.video;
    if (!this.live || !video || video.readyState < 2 || video.videoWidth < 1 || video.videoHeight < 1) return;
    this.stats.width = video.videoWidth;
    this.stats.height = video.videoHeight;
    this.stats.readyState = video.readyState;
    if (!this.active || this.manualMode !== 'AUTO' || video.paused || this.stats.autoplayBlocked || video.error) return;
    if (!this.videoTexture) {
      this.videoTexture = this.videoTextureFactory(video);
      this.videoTexture.name = 'Shared cosmic galaxy video';
      this.videoTexture.colorSpace = SRGBColorSpace;
      this.videoTexture.generateMipmaps = false;
      this.videoTexture.minFilter = this.videoTexture.magFilter = LinearFilter;
    }
    this.selectTexture(this.videoTexture);
    this.currentState = 'VIDEO';
  }

  private selectTexture(texture: Texture): void {
    if (this.currentTexture === texture) return;
    this.currentTexture = texture;
    this.revision++;
  }

  ensurePlaying(): Promise<void> {
    if (!this.live || !this.active || this.manualMode !== 'AUTO' || !this.video || this.video.error) return Promise.resolve();
    if (this.playingRequest) return this.playingRequest;
    if (!this.video.paused && this.video.readyState >= 2) { this.promoteReadyVideo(); return Promise.resolve(); }
    // Promise rejection is a normal autoplay outcome, not a render-loop exception.
    this.playingRequest = Promise.resolve().then(() => {
      if (!this.live || !this.active || this.manualMode !== 'AUTO') return;
      return this.video?.play();
    }).then(() => {
      if (!this.live || !this.active) { this.video?.pause(); return; }
      this.stats.autoplayBlocked = false;
      this.promoteReadyVideo();
    }).catch((error: unknown) => {
      if (!this.live) return;
      this.currentState = this.fallbackState;
      const name = error instanceof Error ? error.name : 'PlaybackError';
      this.stats.autoplayBlocked = name === 'NotAllowedError';
      this.stats.error = name;
    }).finally(() => { this.playingRequest = undefined; });
    return this.playingRequest;
  }

  update(dt = 0): void {
    if (!this.live || !this.video) return;
    this.promoteReadyVideo();
    this.stats.readyState = this.video.readyState;
    const quality = this.video.getVideoPlaybackQuality?.();
    if (quality) {
      this.stats.decodedFrames = quality.totalVideoFrames;
      this.stats.droppedFrames = quality.droppedVideoFrames;
    }
    this.frameClock += Math.max(0, Number.isFinite(dt) ? dt : 0);
    if (this.frameClock >= 1) {
      const frames = this.stats.decodedFrames;
      this.stats.fps = this.stats.decodedFps = Math.max(0, frames - this.lastFrames) / this.frameClock;
      this.lastFrames = frames;
      this.frameClock = 0;
    }
    // VideoTexture owns rVFC/needsUpdate. No manual GPU upload or per-frame canvas.
  }

  setPlaybackRate(rate: number): void {
    this.stats.playbackRate = Math.min(1.1, Math.max(.1, Number.isFinite(rate) ? rate : 1));
    if (this.video) this.video.playbackRate = this.stats.playbackRate;
  }

  setEnabled(enabled: boolean): void {
    if (!this.live || this.active === enabled) return;
    this.active = enabled;
    if (!enabled) {
      this.video?.pause();
      this.currentState = this.currentTexture === this.fallbackTexture ? this.fallbackState : 'STATIC';
    } else void this.ensurePlaying();
  }

  /** Diagnostic modes reuse the same decoder and textures; AUTO restores normal playback. */
  setMode(mode: 'AUTO' | 'PROCEDURAL' | 'STATIC'): void {
    if (!this.live || mode === this.manualMode) return;
    this.manualMode = mode;
    if (mode === 'AUTO') { this.currentState = this.fallbackState; void this.ensurePlaying(); }
    else {
      this.video?.pause();
      this.currentState = mode;
      if (mode === 'STATIC') this.selectTexture(this.fallbackTexture);
    }
  }

  dispose(): void {
    if (!this.live) return;
    this.live = false;
    this.active = false;
    this.gestureTarget?.removeEventListener('pointerdown', this.onGesture);
    this.gestureTarget?.removeEventListener('keydown', this.onGesture);
    if (this.video) {
      this.video.removeEventListener('loadeddata', this.onReady);
      this.video.removeEventListener('playing', this.onPlaying);
      this.video.removeEventListener('error', this.onError);
      this.video.pause();
      // Dispose first: Three cancels its outstanding requestVideoFrameCallback.
      this.videoTexture?.dispose();
      this.video.removeAttribute('src');
      this.video.load();
      CosmicVideoSource.ownedVideos--;
    }
    this.fallbackTexture.dispose();
    this.stats.activeTextures = 0;
    this.stats.fps = this.stats.decodedFps = 0;
  }
}
