import { BackSide, Color, DirectionalLight, Fog, HemisphereLight, InstancedMesh, Mesh, MeshBasicNodeMaterial, MeshStandardMaterial, Object3D, Scene, SphereGeometry, Vector3 } from 'three/webgpu';
import { float, mix, positionLocal, smoothstep, uniform } from 'three/tsl';
import { SPACE } from '../core/config';
import { spaceFactorFor } from './SpaceLayer';
import type { TimeKind, WeatherKind } from '../core/types';
import { LOCAL_SUN_ELEVATION_RAD, NIGHT_FILL_INTENSITY, localLightPlan } from './SolarElevation';
import type { PlanetaryAtmospherePalette } from '../world/life/PlanetaryHazardService';
/** Colours are parsed once: `update` runs every frame and must never re-parse a CSS string. */
const TIMES: Record<TimeKind, { top: Color; horizon: Color; zenith: Color; glow: Color; sun: Color; warm: number; intensity: number; elevation: number; azimuth: number; hour: string }> = {
  Morning: { top: new Color('#4d86ad'), horizon: new Color('#f7dcb2'), zenith: new Color('#1e4f84'), glow: new Color('#ffb877'), sun: new Color('#ffdab2'), warm: .9, intensity: 3, elevation: .27, azimuth: -2.4, hour: '06:24' },
  Noon: { top: new Color('#4e8bb2'), horizon: new Color('#cfdfdd'), zenith: new Color('#1b5896'), glow: new Color('#ffe9c4'), sun: new Color('#fff4d8'), warm: .25, intensity: 3.7, elevation: 1.1, azimuth: -1.35, hour: '12:00' },
  'Golden Hour': { top: new Color('#6e969f'), horizon: new Color('#f3c095'), zenith: new Color('#274d6d'), glow: new Color('#ff9e52'), sun: new Color('#ffcc94'), warm: 1, intensity: 3.1, elevation: .19, azimuth: -1.06, hour: '17:42' },
  Night: { top: new Color('#05101f'), horizon: new Color('#122a3f'), zenith: new Color('#01030b'), glow: new Color('#20456b'), sun: new Color('#91b5d7'), warm: .3, intensity: NIGHT_FILL_INTENSITY, elevation: LOCAL_SUN_ELEVATION_RAD.Night, azimuth: 1.45, hour: '21:16' },
};
const RAIN = { top: new Color('#5e727b'), horizon: new Color('#a0ada8'), zenith: new Color('#465a63'), glow: new Color('#8e9ca0'), warm: .15 };
const CLOUD_DAY = new Color('#eadac8'), CLOUD_RAIN = new Color('#7c8d92'), CLOUD_NIGHT = new Color('#263743');
const SKY_BLUE = new Color('#4e8bb2');
const SKY_DEEP_BLUE = new Color('#1d54a0');
const SKY_NAVY = new Color('#07204b');
const SKY_VACUUM = new Color('#010206');

/**
 * Continuous altitude sky progression from 04-EARTH-ALTITUDE-TRANSITION.md:
 * blue sky (0-8 km) -> deep blue (8-25 km) -> navy (25-60 km) -> black vacuum (60-100 km+).
 */
export function skyColorAtAltitude(altitudeM: number, out = new Color()): Color {
  const alt = Number.isFinite(altitudeM) ? Math.max(0, altitudeM) : 0;
  if (alt <= 8_000) {
    return out.copy(SKY_BLUE);
  }
  if (alt <= 25_000) {
    const t = (alt - 8_000) / (25_000 - 8_000);
    return out.copy(SKY_BLUE).lerp(SKY_DEEP_BLUE, t);
  }
  if (alt <= 60_000) {
    const t = (alt - 25_000) / (60_000 - 25_000);
    return out.copy(SKY_DEEP_BLUE).lerp(SKY_NAVY, t);
  }
  const t = Math.min(1, (alt - 60_000) / (100_000 - 60_000));
  return out.copy(SKY_NAVY).lerp(SKY_VACUUM, t);
}

export class Atmosphere {
  time: TimeKind = 'Golden Hour'; weather: WeatherKind = 'clear'; dayCycle = false;
  atmosphereWeight = 1;
  /**
   * True while the real planet is what the player is looking at.
   *
   * The sky dome and the cloud deck are local weather drawn around the player; from orbit they
   * cover the globe. A switch the layer honours rather than a `visible` flag set from outside,
   * because `update` runs every frame and would put its own answer back.
   */
  planetaryView = false;
  private planetaryPalette: PlanetaryAtmospherePalette | null = null;
  /** Sets or clears a custom planetary atmosphere palette (e.g. Mars, Venus, or exoplanets). Pass null for Earth. */
  setPlanetaryAtmosphere(palette: PlanetaryAtmospherePalette | null) { this.planetaryPalette = palette; }
  get activePaletteLabel(): string { return this.planetaryPalette?.label ?? 'Terra (Padrão)'; }
  readonly sun = new DirectionalLight('#ffcc94', 3.1);
  readonly ambient = new HemisphereLight('#d5e5df', '#665c44', 2.3);
  /** Unit vector from the player toward the sun. SpaceLayer needs it to place its disc and limb glow. */
  readonly sunDirection = new Vector3(0, 1, 0);
  /** Direction of the scene's directional light. Equals the sun above the horizon; a faint fill at night. */
  readonly lightDirection = new Vector3(0, 1, 0);
  /** Local sun elevation of the current preset; negative at night. */
  sunElevationRad = 0;
  sunAboveLocalHorizon = true;
  private top = uniform(new Color(TIMES['Golden Hour'].top));
  private horizon = uniform(new Color(TIMES['Golden Hour'].horizon));
  private zenith = uniform(new Color(TIMES['Golden Hour'].zenith));
  private glow = uniform(new Color(TIMES['Golden Hour'].glow));
  private warmth = uniform(TIMES['Golden Hour'].warm);
  private sunAxis = uniform(new Vector3(0, 1, 0));
  private space = uniform(0);
  /**
   * The 44 km sky dome, drawn around the player. It is a local-domain object: from orbit it would
   * paint over the planet, so whoever owns the planetary view is allowed to stand it down.
   */
  readonly sky: Mesh;
  readonly clouds: InstancedMesh;
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
    // Confine horizon tint to a narrow band so mid-sky and zenith remain blue
    const dome = mix(mix(this.horizon, this.top, smoothstep(-.02, .18, direction.y).pow(.85)), this.zenith, smoothstep(.18, .75, direction.y));
    // Golden hour is a narrow band around the sun, not a tint across the whole dome.
    const band = float(1).sub(smoothstep(0, .20, direction.y.add(.02).abs()));
    const warm = mix(dome, this.glow, direction.dot(this.sunAxis).max(0).pow(3.0).mul(band).mul(this.warmth));
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
    if (this.planetaryPalette) {
      this.top.value.lerp(this.planetaryPalette.top, blend);
      this.horizon.value.lerp(this.planetaryPalette.horizon, blend);
      this.zenith.value.lerp(this.planetaryPalette.zenith, blend);
      this.glow.value.lerp(this.planetaryPalette.glow, blend);
      this.sun.color.lerp(this.planetaryPalette.sunColor, blend);
    } else {
      this.top.value.lerp(rain ? RAIN.top : state.top, blend);
      this.horizon.value.lerp(rain ? RAIN.horizon : state.horizon, blend);
      this.zenith.value.lerp(rain ? RAIN.zenith : state.zenith, blend);
      if (this.altitude > 8_000) {
        const highSky = skyColorAtAltitude(this.altitude, this.transition);
        const highFactor = Math.min(1, (this.altitude - 8_000) / 52_000);
        this.top.value.lerp(highSky, highFactor * blend);
        this.zenith.value.lerp(highSky, Math.min(1, highFactor * 1.25) * blend);
      }
      this.glow.value.lerp(rain ? RAIN.glow : state.glow, blend);
      this.warmth.value += ((rain ? RAIN.warm : state.warm) - this.warmth.value) * blend;
      this.sun.color.lerp(state.sun, blend);
    }
    // Vacuum sunlight is harder and the sky stops bouncing any of it back.
    this.sun.intensity += ((rain ? .7 : state.intensity) * (1 + this.spaceBlend * .3) - this.sun.intensity) * blend;
    this.ambient.intensity += ((this.time === 'Night' ? .75 : rain ? 1.6 : 2.05) * (1 - this.spaceBlend * .45) - this.ambient.intensity) * blend;
    this.sky.position.copy(playerLocal);
    const plan = localLightPlan(this.time);
    this.sunElevationRad = plan.sunElevationRad; this.sunAboveLocalHorizon = plan.sunUp;
    const flat = Math.cos(state.elevation);
    this.sunDirection.set(flat * Math.sin(state.azimuth), Math.sin(state.elevation), flat * Math.cos(state.azimuth)).normalize();
    this.sunAxis.value.copy(this.sunDirection);
    // The scene light is not the Sun when it is below the horizon: it is a faint fill lifted above
    // the horizon so it never lights surfaces from below. A fixed light distance keeps every hour
    // inside the same shadow frustum, unlike a fixed height.
    const lightFlat = Math.cos(plan.lightElevationRad);
    this.lightDirection.set(lightFlat * Math.sin(state.azimuth), Math.sin(plan.lightElevationRad), lightFlat * Math.cos(state.azimuth)).normalize();
    this.temp.copy(this.lightDirection).multiplyScalar(620);
    this.sun.position.copy(playerLocal).add(this.temp); this.sun.target.position.copy(playerLocal);
    this.clouds.position.set(playerLocal.x, 0, playerLocal.z);
    this.clouds.visible = !this.planetaryPalette && !this.planetaryView && this.altitude < SPACE.karman && this.weather !== 'clear';
    // The dome is drawn around the player, so from orbit it paints straight over the planet the
    // far pass just drew. It stands down with the flat ground it belongs to.
    const hasDome = this.planetaryPalette ? this.planetaryPalette.hasSkyDome : true;
    this.sky.visible = !this.planetaryView && hasDome;
    this.cloudMaterial.color.copy(this.time === 'Night' ? CLOUD_NIGHT : rain ? CLOUD_RAIN : CLOUD_DAY);
    // Thin air means the horizon stops being a wall, so the city survives being looked at from orbit.
    const flightAlt = Math.max(0, this.altitude - 80);
    const climb = Math.min(1, flightAlt / 16000);
    const lift = 1 + climb * climb * (3 - 2 * climb) * 16;
    const orbitLift = this.planetaryView ? 1 + this.spaceBlend * 50 : 1;
    const fog = this.scene.fog as Fog;
    if (this.planetaryPalette) {
      fog.color.lerp(this.planetaryPalette.fogColor, blend);
      fog.near += (this.planetaryPalette.fogNear * lift * orbitLift - fog.near) * blend;
      fog.far += (this.planetaryPalette.fogFar * lift * orbitLift - fog.far) * blend;
    } else {
      // Blend fog color towards clear atmospheric blue as flight altitude increases,
      // avoiding warm horizontal dust tint from occluding the green rainforest and gray city below.
      const aerialFactor = Math.min(1, Math.max(0, (this.altitude - 120) / 2400));
      this.transition.copy(this.horizon.value).lerp(SKY_BLUE, aerialFactor * 0.60).multiplyScalar(1 - this.spaceBlend * .85);
      fog.color.lerp(this.transition, blend);

      const baseNear = (rain ? 300 : 3400) + flightAlt * 2.5;
      const baseFar = (rain ? 6500 : 32000) + flightAlt * 8.0;
      fog.near += (baseNear * lift * orbitLift - fog.near) * blend;
      fog.far += (baseFar * lift * orbitLift - fog.far) * blend;
    }
  }
}
