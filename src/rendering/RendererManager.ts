import { ACESFilmicToneMapping, PCFShadowMap, PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu';
import { QUALITY, type QualityPreset } from '../core/config';
import { LOCAL_FAR_M, LOCAL_LAYER, RenderDomains } from './domains/RenderDomains';
export class RendererManager {
  readonly renderer: WebGPURenderer;
  /**
   * One camera for every domain.
   *
   * The logarithmic depth buffer is what makes that possible: its precision is relative, so a
   * 0.15 m near plane stays usable while the far plane runs out to the Moon. `RenderDomains` owns
   * how far it reaches; see that file for why this is not two cameras and two passes.
   */
  readonly camera = new PerspectiveCamera(58, 1, .15, LOCAL_FAR_M);
  readonly domains: RenderDomains;
  readonly scene = new Scene();
  backend = 'Inicializando';
  renderScale = 1;
  preset: QualityPreset = 'High';
  /** The pause menu can force shadows off below what the preset would choose. */
  shadowsAllowed = true;
  constructor(container: HTMLElement) {
    this.renderer = new WebGPURenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true, forceWebGL: new URLSearchParams(location.search).has('webgl') });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.domElement.id = 'world';
    this.renderer.domElement.setAttribute('aria-label', 'Mundo 3D de DR Manaus. Clique para controlar a câmera.');
    container.prepend(this.renderer.domElement);
    // The local domain only, until the planetary one is switched on.
    this.camera.layers.set(LOCAL_LAYER);
    this.domains = new RenderDomains(this.camera);
    window.addEventListener('resize', this.resize);
    this.resize();
  }
  async initialize() {
    await this.renderer.init();
    this.backend = 'isWebGPUBackend' in this.renderer.backend ? 'WebGPU' : 'WebGL 2';
  }
  resize = () => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY[this.preset].pixelRatio) * this.renderScale);
    this.renderer.setSize(innerWidth, innerHeight);
  };
  setQuality(preset: QualityPreset) { this.preset = preset; this.applyShadows(); this.resize(); }
  setShadows(allowed: boolean) { this.shadowsAllowed = allowed; this.applyShadows(); }
  private applyShadows() { this.renderer.shadowMap.enabled = this.shadowsAllowed && QUALITY[this.preset].shadows; }
  dispose() { window.removeEventListener('resize', this.resize); this.renderer.dispose(); }
}
