import { BackSide, Color, DirectionalLight, Fog, Group, HemisphereLight, InstancedMesh, Mesh, MeshBasicNodeMaterial, MeshStandardMaterial, Object3D, Scene, SphereGeometry, Vector3 } from 'three/webgpu';
import { mix, positionLocal, smoothstep, uniform } from 'three/tsl';
import type { TimeKind, WeatherKind } from '../core/types';
const TIMES: Record<TimeKind, { top: string; horizon: string; sun: string; intensity: number; elevation: number; hour: string }> = {
  Morning: { top: '#6899b0', horizon: '#f5d9ad', sun: '#ffdab2', intensity: 3, elevation: .27, hour: '06:24' },
  Noon: { top: '#528cad', horizon: '#c9dad5', sun: '#fff4d8', intensity: 3.7, elevation: 1.1, hour: '12:00' },
  'Golden Hour': { top: '#6e969f', horizon: '#f3c095', sun: '#ffcc94', intensity: 3.1, elevation: .19, hour: '17:42' },
  Night: { top: '#081725', horizon: '#233e46', sun: '#91b5d7', intensity: .42, elevation: .55, hour: '21:16' },
};
export class Atmosphere {
  time: TimeKind = 'Golden Hour'; weather: WeatherKind = 'clear'; dayCycle = false;
  readonly sun = new DirectionalLight('#ffcc94', 3.1);
  readonly ambient = new HemisphereLight('#d5e5df', '#665c44', 2.3);
  private top = uniform(new Color(TIMES['Golden Hour'].top));
  private horizon = uniform(new Color(TIMES['Golden Hour'].horizon));
  private sky: Mesh;
  private solar: Mesh;
  private clouds: InstancedMesh;
  private cloudMaterial = new MeshStandardMaterial({ color: '#ead5be', roughness: 1, flatShading: false });
  private dummy = new Object3D();
  private elapsed = 0;
  private temp = new Vector3();
  private transition = new Color();
  constructor(private scene: Scene) {
    const skyMaterial = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
    skyMaterial.colorNode = mix(this.horizon, this.top, smoothstep(-.04, .68, positionLocal.normalize().y));
    this.sky = new Mesh(new SphereGeometry(44000, 24, 16), skyMaterial);
    this.sky.renderOrder = -10; scene.add(this.sky);
    this.solar = new Mesh(new SphereGeometry(120, 24, 16), new MeshBasicNodeMaterial({ color: '#fff0c4', fog: false }));
    scene.add(this.solar);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -145, right: 145, top: 145, bottom: -145, near: 1, far: 900 });
    this.sun.shadow.bias = -.00025; this.sun.shadow.normalBias = .12;
    scene.add(this.sun, this.sun.target, this.ambient);
    scene.fog = new Fog('#d2bb98', 2800, 26000);
    this.clouds = new InstancedMesh(new SphereGeometry(1, 8, 6), this.cloudMaterial, 72);
    for (let i = 0; i < 72; i++) {
      const angle = i * 2.399;
      const ring = 3000 + (i % 12) * 1300;
      this.dummy.position.set(Math.cos(angle) * ring, 1000 + (i % 7) * 90, Math.sin(angle) * ring);
      this.dummy.scale.set(380 + (i % 6) * 140, 65 + (i % 4) * 40, 150 + (i % 5) * 80);
      this.dummy.updateMatrix(); this.clouds.setMatrixAt(i, this.dummy.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    scene.add(this.clouds);
  }
  get clock() { return TIMES[this.time].hour; }
  update(dt: number, playerLocal: Vector3) {
    this.elapsed += dt;
    if (this.dayCycle && this.elapsed > 100) { this.elapsed = 0; const times = Object.keys(TIMES) as TimeKind[]; this.time = times[(times.indexOf(this.time) + 1) % times.length]; }
    const state = TIMES[this.time]; const rain = this.weather === 'rain' || this.weather === 'storm';
    const blend = 1 - Math.exp(-dt * 1.5);
    this.transition.set(rain ? '#5e727b' : state.top); this.top.value.lerp(this.transition, blend);
    this.transition.set(rain ? '#a0ada8' : state.horizon); this.horizon.value.lerp(this.transition, blend);
    this.sun.color.set(state.sun); this.sun.intensity += ((rain ? .7 : state.intensity) - this.sun.intensity) * blend;
    this.ambient.intensity += ((this.time === 'Night' ? .75 : rain ? 1.6 : 2.05) - this.ambient.intensity) * blend;
    this.sky.position.copy(playerLocal);
    this.temp.set(-700, Math.sin(state.elevation) * 900 + 100, 390);
    this.sun.position.copy(playerLocal).add(this.temp); this.sun.target.position.copy(playerLocal);
    this.solar.position.copy(this.temp).normalize().multiplyScalar(21000).add(playerLocal);
    this.solar.visible = !rain && this.weather !== 'cloudy';
    this.clouds.position.set(playerLocal.x, 0, playerLocal.z);
    this.cloudMaterial.color.set(this.time === 'Night' ? '#263743' : rain ? '#7c8d92' : '#eadac8');
    const fog = this.scene.fog as Fog; fog.color.lerp(this.horizon.value, blend);
    fog.near += ((rain ? 300 : 2800) - fog.near) * blend;
    fog.far += ((rain ? 6500 : 27000) - fog.far) * blend;
  }
}
