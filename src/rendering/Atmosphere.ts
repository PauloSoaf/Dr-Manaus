import { BackSide, Color, DirectionalLight, Fog, HemisphereLight, InstancedMesh, Mesh, MeshBasicNodeMaterial, MeshStandardMaterial, Object3D, Scene, SphereGeometry, Vector3 } from 'three/webgpu';
import { float, mix, positionLocal, smoothstep, uniform } from 'three/tsl';
import { SPACE } from '../core/config';
import { spaceFactorFor } from './SpaceLayer';
import type { TimeKind, WeatherKind } from '../core/types';
/** Colours are parsed once: `update` runs every frame and must never re-parse a CSS string. */
const TIMES: Record<TimeKind, { top: Color; horizon: Color; zenith: Color; glow: Color; sun: Color; warm: number; intensity: number; elevation: number; azimuth: number; hour: string }> = {
  Morning: { top: new Color('#4d86ad'), horizon: new Color('#f7dcb2'), zenith: new Color('#1e4f84'), glow: new Color('#ffb877'), sun: new Color('#ffdab2'), warm: .9, intensity: 3, elevation: .27, azimuth: -2.4, hour: '06:24' },
  Noon: { top: new Color('#4e8bb2'), horizon: new Color('#cfdfdd'), zenith: new Color('#1b5896'), glow: new Color('#ffe9c4'), sun: new Color('#fff4d8'), warm: .25, intensity: 3.7, elevation: 1.1, azimuth: -1.35, hour: '12:00' },
  'Golden Hour': { top: new Color('#6e969f'), horizon: new Color('#f3c095'), zenith: new Color('#274d6d'), glow: new Color('#ff9e52'), sun: new Color('#ffcc94'), warm: 1, intensity: 3.1, elevation: .19, azimuth: -1.06, hour: '17:42' },
  Night: { top: new Color('#05101f'), horizon: new Color('#122a3f'), zenith: new Color('#01030b'), glow: new Color('#20456b'), sun: new Color('#91b5d7'), warm: .3, intensity: .42, elevation: .55, azimuth: 1.45, hour: '21:16' },
};
const RAIN = { top: new Color('#5e727b'), horizon: new Color('#a0ada8'), zenith: new Color('#465a63'), glow: new Color('#8e9ca0'), warm: .15 };
const CLOUD_DAY = new Color('#eadac8'), CLOUD_RAIN = new Color('#7c8d92'), CLOUD_NIGHT = new Color('#263743');
export class Atmosphere {
  time: TimeKind = 'Golden Hour'; weather: WeatherKind = 'clear'; dayCycle = false;
  readonly sun = new DirectionalLight('#ffcc94', 3.1);
  readonly ambient = new HemisphereLight('#d5e5df', '#665c44', 2.3);
  /** Unit vector from the player toward the sun. SpaceLayer needs it to place its disc and limb glow. */
  readonly sunDirection = new Vector3(0, 1, 0);
  private top = uniform(new Color(TIMES['Golden Hour'].top));
  private horizon = uniform(new Color(TIMES['Golden Hour'].horizon));
  private zenith = uniform(new Color(TIMES['Golden Hour'].zenith));
  private glow = uniform(new Color(TIMES['Golden Hour'].glow));
  private warmth = uniform(TIMES['Golden Hour'].warm);
  private sunAxis = uniform(new Vector3(0, 1, 0));
  private space = uniform(0);
  private sky: Mesh;
  private clouds: InstancedMesh;
  private cloudMaterial = new MeshStandardMaterial({ color: '#ead5be', roughness: 1, flatShading: false });
  private dummy = new Object3D();
  private elapsed = 0;
  private altitude = 0;
  private spaceBlend = 0;
  private temp = new Vector3();
  private transition = new Color();
  constructor(private scene: Scene) {
    const skyMaterial = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false });
    const direction = positionLocal.normalize();
    const dome = mix(mix(this.horizon, this.top, smoothstep(-.07, .5, direction.y).pow(.85)), this.zenith, smoothstep(.32, 1, direction.y));
    // Golden hour is a narrow band around the sun, not a tint across the whole dome.
    const band = float(1).sub(smoothstep(0, .36, direction.y.add(.03).abs()));
    const warm = mix(dome, this.glow, direction.dot(this.sunAxis).max(0).pow(2.6).mul(band).mul(this.warmth));
    // Air is what makes a sky bright; above it this dome has to get out of SpaceLayer's way.
    skyMaterial.colorNode = mix(warm, this.zenith, this.space.mul(.6)).mul(float(1).sub(this.space.mul(.7)));
    this.sky = new Mesh(new SphereGeometry(44000, 32, 20), skyMaterial);
    this.sky.renderOrder = -10; scene.add(this.sky);
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
  /** Optional. Feeding flight altitude in thins the haze, the fog and the sky bounce on the way to orbit. */
  setAltitude(metres: number) { this.altitude = Number.isFinite(metres) ? Math.min(Math.max(metres, 0), SPACE.maxAltitude) : 0; }
  update(dt: number, playerLocal: Vector3) {
    // A single non-finite frame would poison every damped value below, including the sky uniforms.
    const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), .25) : 0;
    this.elapsed += step;
    if (this.dayCycle && this.elapsed > 100) { this.elapsed = 0; const times = Object.keys(TIMES) as TimeKind[]; this.time = times[(times.indexOf(this.time) + 1) % times.length]; }
    const state = TIMES[this.time]; const rain = this.weather === 'rain' || this.weather === 'storm';
    const blend = 1 - Math.exp(-step * 1.5);
    this.spaceBlend += (spaceFactorFor(this.altitude) - this.spaceBlend) * blend;
    this.space.value = this.spaceBlend;
    this.top.value.lerp(rain ? RAIN.top : state.top, blend);
    this.horizon.value.lerp(rain ? RAIN.horizon : state.horizon, blend);
    this.zenith.value.lerp(rain ? RAIN.zenith : state.zenith, blend);
    this.glow.value.lerp(rain ? RAIN.glow : state.glow, blend);
    this.warmth.value += ((rain ? RAIN.warm : state.warm) - this.warmth.value) * blend;
    this.sun.color.lerp(state.sun, blend);
    // Vacuum sunlight is harder and the sky stops bouncing any of it back.
    this.sun.intensity += ((rain ? .7 : state.intensity) * (1 + this.spaceBlend * .3) - this.sun.intensity) * blend;
    this.ambient.intensity += ((this.time === 'Night' ? .75 : rain ? 1.6 : 2.05) * (1 - this.spaceBlend * .45) - this.ambient.intensity) * blend;
    this.sky.position.copy(playerLocal);
    const flat = Math.cos(state.elevation);
    this.sunDirection.set(flat * Math.sin(state.azimuth), Math.sin(state.elevation), flat * Math.cos(state.azimuth)).normalize();
    this.sunAxis.value.copy(this.sunDirection);
    // A fixed light distance keeps every hour inside the same shadow frustum, unlike a fixed height.
    this.temp.copy(this.sunDirection).multiplyScalar(620);
    this.sun.position.copy(playerLocal).add(this.temp); this.sun.target.position.copy(playerLocal);
    this.clouds.position.set(playerLocal.x, 0, playerLocal.z);
    this.clouds.visible = this.altitude < SPACE.karman;
    this.cloudMaterial.color.copy(this.time === 'Night' ? CLOUD_NIGHT : rain ? CLOUD_RAIN : CLOUD_DAY);
    // Thin air means the horizon stops being a wall, so the city survives being looked at from orbit.
    const climb = Math.min(1, Math.max(0, (this.altitude - 900) / 25100));
    const lift = 1 + climb * climb * (3 - 2 * climb) * 14;
    const fog = this.scene.fog as Fog;
    this.transition.copy(this.horizon.value).multiplyScalar(1 - this.spaceBlend * .85);
    fog.color.lerp(this.transition, blend);
    fog.near += ((rain ? 300 : 2800) * lift - fog.near) * blend;
    fog.far += ((rain ? 6500 : 27000) * lift - fog.far) * blend;
  }
}
