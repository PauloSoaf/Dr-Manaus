import { AdditiveBlending, BackSide, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, MeshBasicNodeMaterial, NormalBlending, PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry, Uint32BufferAttribute, Vector3 } from 'three/webgpu';
import { attribute, float, mix, positionLocal, sin, smoothstep, time, uniform, uv } from 'three/tsl';
import { SPACE } from '../core/config';
/** The rig rides the camera, so these are viewing distances, not world extents. Far plane is 260 km. */
const STAR_RADIUS = 150000, SHELL_RADIUS = 170000, SUN_DISTANCE = 120000, SUN_QUAD = SUN_DISTANCE * .0968;
const FIELD_STARS = 2200, BAND_STARS = 1200, STARS = FIELD_STARS + BAND_STARS;
const EARTH_RADIUS = 6371000;
/** Stellar classes from hot blue-white to cool orange, walked as a ramp so most of the sky reads neutral. */
const CLASSES = [new Color('#a8c6ff'), new Color('#dbe7ff'), new Color('#fffaf2'), new Color('#ffdfb4'), new Color('#ffab6b')];
const DUST = new Color('#cbd2ef');
const SUN_AIR = new Color('#ffd49a'), SUN_VACUUM = new Color('#fffaf0'), MOON = new Color('#cddff2');
const HALO_AIR = new Color('#ffc274'), HALO_VACUUM = new Color('#94add2');
const SKY_HIGH_DAY = new Color('#1d54a0'), SKY_HIGH_NIGHT = new Color('#050d1e');
const ZENITH_DAY = new Color('#07204b'), ZENITH_NIGHT = new Color('#01040c');
const VACUUM = new Color('#010206');
const RIM_COOL = new Color('#63b8ff'), RIM_WARM = new Color('#ffd9ab'), RIM_NIGHT = new Color('#27618f');
const BAND_AXIS = new Vector3(.38, .82, -.43).normalize();
const FORWARD = new Vector3(0, 0, 1);
const clamp01 = (value: number) => value < 0 ? 0 : value > 1 ? 1 : value;
const fade = (edge0: number, edge1: number, x: number) => { const t = clamp01((x - edge0) / (edge1 - edge0)); return t * t * (3 - 2 * t); };
/** mulberry32: the star field has to be byte-identical on every machine and every reload. */
const seeded = (seed: number) => () => {
  seed = seed + 0x6d2b79f5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
/** 0 inside the troposphere, .62 at the Karman line, 1 from orbit up. Shared so Atmosphere agrees exactly. */
export function spaceFactorFor(altitude: number): number {
  if (!Number.isFinite(altitude)) return 0;
  return fade(SPACE.atmosphereTop, SPACE.karman, altitude) * .62 + fade(SPACE.karman, SPACE.orbit, altitude) * .38;
}
/**
 * Stars, the atmospheric limb and the solar disc: three draw calls that turn a climb into an ascent.
 * Everything hangs off a rig pinned to the camera position with an identity rotation, so the sky never
 * parallaxes as the player flies yet still swings correctly when the player looks around. All three are
 * transparent on purpose: that puts them behind the opaque depth buffer, so the city always occludes them.
 */
export class SpaceLayer {
  private rig = new Group();
  private stars: Mesh;
  private shell: Mesh;
  private disc: Mesh;
  private starMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
  private shellMaterial = new MeshBasicNodeMaterial({ side: BackSide, transparent: true, depthWrite: false, blending: NormalBlending, fog: false });
  private discMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
  private uSpace = uniform(0);
  private uVisible = uniform(0);
  private uSun = uniform(new Vector3(0, 1, 0));
  private uBand = uniform(new Vector3().copy(BAND_AXIS));
  private uLimb = uniform(0);
  private uRimWidth = uniform(.17);
  private uRimStrength = uniform(0);
  private uRimGain = uniform(1);
  private uShellFade = uniform(0);
  private uSkyHigh = uniform(new Color(SKY_HIGH_DAY));
  private uZenith = uniform(new Color(ZENITH_DAY));
  private uVacuum = uniform(new Color(VACUUM));
  private uRimCool = uniform(new Color(RIM_COOL));
  private uRimWarm = uniform(new Color(RIM_WARM));
  private uDust = uniform(new Color(DUST));
  private uSunSize = uniform(.22);
  private uSunSoft = uniform(.085);
  private uSunGain = uniform(1);
  private uHalo = uniform(.52);
  private uSunTint = uniform(new Color(SUN_AIR));
  private uHaloTint = uniform(new Color(HALO_AIR));
  private factor = 0;
  private height = 0;
  private nightBlend = 0;
  private axis = new Vector3(0, 1, 0);
  private facing = new Vector3(0, 0, -1);
  constructor(private scene: Scene, private camera: PerspectiveCamera) {
    this.stars = new Mesh(this.buildStars(), this.starMaterial);
    this.shell = new Mesh(new SphereGeometry(SHELL_RADIUS, 48, 28), this.shellMaterial);
    this.disc = new Mesh(new PlaneGeometry(SUN_QUAD, SUN_QUAD), this.discMaterial);
    this.writeShellShader(); this.writeStarShader(); this.writeDiscShader();
    this.shell.renderOrder = -9; this.stars.renderOrder = -8; this.disc.renderOrder = -7;
    this.shell.frustumCulled = false; this.stars.frustumCulled = false;
    this.shell.visible = false; this.stars.visible = false;
    this.rig.name = 'DR Manaus · space rig';
    this.rig.add(this.shell, this.stars, this.disc);
    scene.add(this.rig);
  }
  /** 0 on the ground, .62 at the Karman line, 1 from orbit up. Smoothed, so the HUD can show it raw. */
  get spaceFactor() { return this.factor; }
  update(altitude: number, sunDirection: Vector3, night: boolean, dt: number, overcast = 0) {
    const metres = Number.isFinite(altitude) ? Math.min(Math.max(altitude, 0), SPACE.maxAltitude) : 0;
    const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), .25) : 0;
    const blend = 1 - Math.exp(-step * 1.4);
    this.factor += (spaceFactorFor(metres) - this.factor) * blend;
    this.height += (metres - this.height) * blend;
    this.nightBlend += ((night ? 1 : 0) - this.nightBlend) * blend;
    const space = this.factor, dark = this.nightBlend;
    // Cloud cover hides the sky, but only while there is still weather above the player.
    const veil = 1 - clamp01(Number.isFinite(overcast) ? overcast : 0) * (1 - space);
    if (Number.isFinite(sunDirection.x + sunDirection.y + sunDirection.z) && sunDirection.lengthSq() > 1e-8) this.axis.copy(sunDirection).normalize();
    this.uSun.value.copy(this.axis);
    this.uSpace.value = space;
    this.uVisible.value = Math.min(1, Math.max(dark * .9, space * 1.2)) * veil;
    // True horizon dip for the altitude, so the limb keeps opening up all the way to 140 km.
    this.uLimb.value = -Math.sin(Math.acos(EARTH_RADIUS / (EARTH_RADIUS + this.height)));
    this.uRimWidth.value = .17 - .125 * fade(0, SPACE.karman, this.height);
    this.uRimStrength.value = .3 + .7 * fade(.05, .7, space);
    this.uRimGain.value = 1 + space * 1.5;
    this.uShellFade.value = fade(.015, .4, space);
    this.uSkyHigh.value.copy(SKY_HIGH_DAY).lerp(SKY_HIGH_NIGHT, dark);
    this.uZenith.value.copy(ZENITH_DAY).lerp(ZENITH_NIGHT, dark);
    this.uRimCool.value.copy(RIM_COOL).lerp(RIM_NIGHT, dark);
    this.uSunSize.value = .22 - .06 * space;
    this.uSunSoft.value = .085 - .081 * space;
    this.uSunGain.value = (1 + space * .9) * (1 - dark * .55);
    this.uHalo.value = .52 * (1 - space * .88) * veil;
    this.uSunTint.value.copy(SUN_AIR).lerp(MOON, dark).lerp(SUN_VACUUM, space * (1 - dark));
    this.uHaloTint.value.copy(HALO_AIR).lerp(HALO_VACUUM, dark);
    this.rig.position.copy(this.camera.position);
    this.disc.position.copy(this.axis).multiplyScalar(SUN_DISTANCE);
    this.facing.copy(this.axis).negate();
    this.disc.quaternion.setFromUnitVectors(FORWARD, this.facing);
    this.stars.visible = this.uVisible.value > .004;
    this.shell.visible = this.uShellFade.value > .003;
    this.disc.visible = veil > .02;
  }
  dispose() {
    this.scene.remove(this.rig);
    this.stars.geometry.dispose(); this.shell.geometry.dispose(); this.disc.geometry.dispose();
    this.starMaterial.dispose(); this.shellMaterial.dispose(); this.discMaterial.dispose();
  }
  /** One indexed mesh of inward-facing quads. The camera sits at the rig origin, so they need no billboarding. */
  private buildStars() {
    const random = seeded(0x5eed1a);
    const position = new Float32Array(STARS * 12), corner = new Float32Array(STARS * 8);
    const tint = new Float32Array(STARS * 12), glint = new Float32Array(STARS * 8);
    const index = new Uint32Array(STARS * 6);
    const bandU = new Vector3(BAND_AXIS.z, 0, -BAND_AXIS.x).normalize();
    const bandV = new Vector3().crossVectors(BAND_AXIS, bandU).normalize();
    const dir = new Vector3(), tangent = new Vector3(), bitangent = new Vector3(), hue = new Color();
    for (let i = 0; i < STARS; i++) {
      const inBand = i >= FIELD_STARS;
      if (inBand) {
        // A great circle with a gaussian spill is what gives the Milky Way its soft, uneven edges.
        const angle = random() * Math.PI * 2, spill = (random() + random() + random() - 1.5) * .3;
        dir.copy(bandU).multiplyScalar(Math.cos(angle)).addScaledVector(bandV, Math.sin(angle)).addScaledVector(BAND_AXIS, spill).normalize();
      } else {
        const y = random() * 2 - 1, angle = random() * Math.PI * 2, ring = Math.sqrt(Math.max(0, 1 - y * y));
        dir.set(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
      }
      const temperature = random() * (CLASSES.length - 1);
      const slot = Math.min(CLASSES.length - 2, Math.floor(temperature));
      hue.copy(CLASSES[slot]).lerp(CLASSES[slot + 1], temperature - slot);
      if (inBand) hue.lerp(DUST, .55);
      const bright = (.26 + Math.pow(random(), 2.6) * 1.2) * (inBand ? .5 : 1);
      const half = STAR_RADIUS * (.0011 + bright * .0016);
      if (Math.abs(dir.y) > .99) tangent.set(1, 0, 0); else tangent.set(0, 1, 0);
      bitangent.crossVectors(dir, tangent).normalize();
      tangent.crossVectors(bitangent, dir).normalize();
      const phase = random() * Math.PI * 2;
      for (let c = 0; c < 4; c++) {
        const u = c === 0 || c === 3 ? -1 : 1, v = c < 2 ? -1 : 1, v3 = (i * 4 + c) * 3, v2 = (i * 4 + c) * 2;
        position[v3] = dir.x * STAR_RADIUS + bitangent.x * u * half + tangent.x * v * half;
        position[v3 + 1] = dir.y * STAR_RADIUS + bitangent.y * u * half + tangent.y * v * half;
        position[v3 + 2] = dir.z * STAR_RADIUS + bitangent.z * u * half + tangent.z * v * half;
        tint[v3] = hue.r; tint[v3 + 1] = hue.g; tint[v3 + 2] = hue.b;
        corner[v2] = u; corner[v2 + 1] = v;
        glint[v2] = bright; glint[v2 + 1] = phase;
      }
      const base = i * 4, slice = i * 6;
      index[slice] = base; index[slice + 1] = base + 1; index[slice + 2] = base + 2;
      index[slice + 3] = base; index[slice + 4] = base + 2; index[slice + 5] = base + 3;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
    geometry.setAttribute('corner', new Float32BufferAttribute(corner, 2));
    geometry.setAttribute('tint', new Float32BufferAttribute(tint, 3));
    geometry.setAttribute('glint', new Float32BufferAttribute(glint, 2));
    geometry.setIndex(new Uint32BufferAttribute(index, 1));
    return geometry;
  }
  private writeStarShader() {
    const corner = attribute('corner', 'vec2'), glint = attribute('glint', 'vec2'), tint = attribute('tint', 'vec3');
    const drop = float(1).sub(corner.length()).max(0);
    const shape = drop.pow(2.4).mul(.38).add(drop.pow(9).mul(1.45));
    // Scintillation is an artefact of moving air: in vacuum the stars have to hold perfectly still.
    const beat = sin(time.mul(2.1).add(glint.y)).mul(sin(time.mul(1.27).add(glint.y.mul(3.7))));
    const twinkle = beat.mul(.24).mul(float(1).sub(this.uSpace).mul(.92).add(.08));
    const direction = positionLocal.normalize();
    const lift = mix(smoothstep(-.02, .26, direction.y), smoothstep(this.uLimb.sub(.01), this.uLimb.add(.05), direction.y), this.uSpace);
    const glare = float(1).sub(smoothstep(.75, .995, direction.dot(this.uSun)).mul(float(1).sub(this.uSpace.mul(.45))));
    this.starMaterial.colorNode = tint.mul(glint.x).mul(float(1).add(twinkle));
    this.starMaterial.opacityNode = shape.mul(glint.x).mul(this.uVisible).mul(lift).mul(glare).saturate();
  }
  private writeShellShader() {
    const direction = positionLocal.normalize();
    const height = direction.y;
    const air = mix(this.uSkyHigh, this.uZenith, smoothstep(-.05, .62, height));
    const tone = mix(air, this.uVacuum, smoothstep(.08, .8, this.uSpace));
    const rim = float(1).sub(smoothstep(0, this.uRimWidth, height.sub(this.uLimb).abs())).pow(1.7);
    const rimColour = mix(this.uRimCool, this.uRimWarm, direction.dot(this.uSun).max(0).pow(2.2)).mul(this.uRimGain);
    const body = mix(tone, rimColour, rim.mul(this.uRimStrength));
    // A dust lane, not only points: the band has to glow between its stars to read as a galaxy.
    const band = float(1).sub(direction.dot(this.uBand).abs()).pow(24).mul(.42).mul(this.uSpace);
    // Below the limb the air is still something you look through, so the ground keeps showing until orbit.
    const below = float(1).sub(smoothstep(this.uLimb.sub(.08), this.uLimb.add(.02), height));
    this.shellMaterial.colorNode = body.add(this.uDust.mul(band));
    this.shellMaterial.opacityNode = this.uShellFade.mul(float(1).sub(below.mul(float(1).sub(this.uSpace)).mul(.6))).saturate();
  }
  private writeDiscShader() {
    const radial = uv().sub(.5).length().mul(2);
    const disc = float(1).sub(smoothstep(this.uSunSize.sub(this.uSunSoft), this.uSunSize.add(this.uSunSoft), radial));
    const drop = float(1).sub(radial).max(0);
    // The halo is scattering inside air. Only a tight residual glare survives in vacuum.
    const halo = drop.pow(3.2).mul(this.uHalo).add(drop.pow(11).mul(.4));
    this.discMaterial.colorNode = mix(this.uHaloTint, this.uSunTint.mul(this.uSunGain), disc);
    this.discMaterial.opacityNode = disc.add(halo).saturate();
  }
}
