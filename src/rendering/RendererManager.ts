import { ACESFilmicToneMapping, PCFShadowMap, PerspectiveCamera, Scene, WebGPURenderer } from 'three/webgpu';
import { QUALITY, type QualityPreset } from '../core/config';
export class RendererManager {
  readonly renderer: WebGPURenderer;
  // A logarithmic depth buffer keeps a 0.15 m near plane usable out to orbit.
  readonly camera = new PerspectiveCamera(58, 1, .15, 260000);
  readonly scene = new Scene();
  backend = 'Inicializando';
  renderScale = 1;
  preset: QualityPreset = 'High';
  constructor(container: HTMLElement) {
    this.renderer = new WebGPURenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true, forceWebGL: new URLSearchParams(location.search).has('webgl') });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.domElement.id = 'world';
    this.renderer.domElement.setAttribute('aria-label', 'Mundo 3D de DR Manaus. Clique para controlar a câmera.');
    container.prepend(this.renderer.domElement);
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
  setQuality(preset: QualityPreset) { this.preset = preset; this.renderer.shadowMap.enabled = QUALITY[preset].shadows; this.resize(); }
  dispose() { window.removeEventListener('resize', this.resize); this.renderer.dispose(); }
}
