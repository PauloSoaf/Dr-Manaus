import { DoubleSide, Group, Mesh, MeshBasicNodeMaterial, NormalBlending, PlaneGeometry, Quaternion, RingGeometry, Vector3 } from 'three/webgpu';
import { float, max, mix, positionLocal, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { CelestialRenderSample } from './types';
import type { BodyVisualProfile } from '../../world/celestial/CelestialBodyProfile';

export class PlanetVisual {
  readonly group = new Group();
  private readonly disc: Mesh;
  private readonly material: MeshBasicNodeMaterial;
  private readonly rings?: Mesh<RingGeometry, MeshBasicNodeMaterial>;
  private readonly uPole = uniform(new Vector3(0, 1, 0));
  
  private readonly uPhaseLightDir = uniform(new Vector3(1, 0, 0));
  private readonly uOpacity = uniform(1);
  private readonly uAlbedo = uniform(new Vector3(0.5, 0.5, 0.5));
  private readonly uAmbient = uniform(new Vector3(0.02, 0.02, 0.02));
  private readonly uDiscRadius = uniform(0.9);
  private readonly uGlowStrength = uniform(0.0);
  private readonly uPointMix = uniform(0);
  private readonly uRingOpacity = uniform(1);
  private readonly uDirectSunlight = uniform(1);

  constructor(albedoRGB: [number, number, number], ambientRGB: [number, number, number] = [0.02, 0.02, 0.02],
    profile?: BodyVisualProfile) {
    this.group.name = 'PlanetVisual';
    this.uAlbedo.value.set(albedoRGB[0], albedoRGB[1], albedoRGB[2]);
    if (profile?.ambient) {
      this.uAmbient.value.set(profile.ambient[0], profile.ambient[1], profile.ambient[2]);
    } else {
      this.uAmbient.value.set(ambientRGB[0], ambientRGB[1], ambientRGB[2]);
    }

    const geometry = new PlaneGeometry(2, 2);
    
    this.material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: NormalBlending,
      fog: false,
    });

    const x = positionLocal.x;
    const y = positionLocal.y;
    const rSq = x.mul(x).add(y.mul(y));
    const normR = rSq.pow(0.5);
    
    // sx/sy are used for the 3D spherical normal. They should map [0, uDiscRadius] to [0, 1]
    const sx = x.div(this.uDiscRadius);
    const sy = y.div(this.uDiscRadius);
    const sphereR2 = sx.mul(sx).add(sy.mul(sy));
    
    // The sharp disc
    const disc = float(1).sub(smoothstep(this.uDiscRadius.mul(0.98), this.uDiscRadius, normR));
    const z = float(1).sub(sphereR2).max(0).pow(0.5);
    const normal = vec3(sx, sy, z).normalize();
    
    const nDotL = max(0, normal.dot(this.uPhaseLightDir));
    
    const bands = profile?.bands
      ? normal.dot(this.uPole).mul(profile.bands * Math.PI).sin().mul(0.16).add(0.84)
      : float(1);
    const lit = this.uAlbedo.mul(bands).mul(nDotL.pow(profile?.phaseExponent ?? 0.8)).mul(this.uDirectSunlight);
    
    const earthshine = this.uAmbient.mul(float(1).sub(nDotL));
    
    // The optical radius ends at 0.9, matching the quad scale and the bounded proxy budget.
    const drop = normR.sub(this.uDiscRadius).max(0).div(float(0.9).sub(this.uDiscRadius).max(0.001));
    const glowAlpha = float(1).sub(drop).max(0).pow(2.0).mul(this.uGlowStrength);
    const finalGlow = this.uAlbedo.mul(glowAlpha).mul(nDotL.mul(0.8).add(0.2)).mul(this.uDirectSunlight);
    
    const phaseColor = lit.add(earthshine);
    const pointColor = this.uAlbedo.mul(profile?.pointBrightness ?? 0.55).mul(this.uDirectSunlight);
    const finalColor = mix(phaseColor, pointColor, this.uPointMix).mul(disc)
      .add(finalGlow.mul(float(1).sub(disc)));
    const alpha = disc.add(glowAlpha.mul(float(1).sub(disc))).mul(this.uOpacity).saturate();

    this.material.colorNode = vec4(finalColor, alpha);

    this.disc = new Mesh(geometry, this.material);
    this.disc.frustumCulled = false;
    this.group.add(this.disc);
    if (profile?.rings) {
      const material = new MeshBasicNodeMaterial({ transparent: true, side: DoubleSide,
        depthWrite: false, depthTest: true, fog: false });
      const radius = positionLocal.xy.length();
      const stripe = radius.mul(90).sin().mul(0.14).add(0.65);
      material.colorNode = vec3(0.72, 0.65, 0.47).mul(stripe);
      material.opacityNode = stripe.mul(this.uOpacity).mul(this.uRingOpacity);
      this.rings = new Mesh(new RingGeometry(profile.rings.innerRadius, profile.rings.outerRadius, 96), material);
      this.rings.name = 'analytic-rings';
      this.rings.frustumCulled = false;
      this.group.add(this.rings);
    }
  }

  update(sample: CelestialRenderSample, cameraPos: Vector3): void {
    this.group.visible = sample.visible;
    this.uOpacity.value = Math.max(0, Math.min(1, sample.opacity));
    if (!this.group.visible) return;

    const baseRadius = sample.presentationProxyRadiusM ?? sample.proxyRadiusM;
    const glowRadius = Math.max(baseRadius, sample.glowProxyRadiusM ?? baseRadius, 1e-12);
    const scale = glowRadius / 0.9;
    this.disc.scale.setScalar(scale);
    
    // discRadius is the fraction of the quad that the actual disc takes up
    this.uDiscRadius.value = (baseRadius / glowRadius) * 0.9;
    this.uPointMix.value = sample.pointMix ?? 0;
    this.uGlowStrength.value = Math.max((sample.profile?.visual.pointGlowStrength ?? 0) * this.uPointMix.value,
      (sample.profile?.visual.haze?.strength ?? 0) * (1 - this.uPointMix.value));
    this.uDirectSunlight.value = Math.max(0, Math.min(1, sample.directSunlight01 ?? 1));
    this.uRingOpacity.value = sample.ringsOpacity ?? 1;
    if (this.rings) this.rings.visible = this.uRingOpacity.value > 0;

    const dir = sample.directionRender;
    this.group.position.set(dir[0], dir[1], dir[2]).multiplyScalar(sample.proxyDistanceM);
    
    // Both the billboard and rings use observer-relative axes, independent of root translation.
    this.group.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...dir).negate().normalize());
    if (sample.bodyOrientationRender) {
      const bodyRotation = new Quaternion(...sample.bodyOrientationRender);
      const localRotation = this.group.quaternion.clone().invert().multiply(bodyRotation);
      this.uPole.value.set(0, 0, 1).applyQuaternion(localRotation);
      if (this.rings) {
        this.rings.quaternion.copy(localRotation);
        this.rings.scale.setScalar(sample.proxyRadiusM);
      }
    }

    if (sample.phaseLightDirection) {
      const lightDir = new Vector3(sample.phaseLightDirection[0], sample.phaseLightDirection[1], sample.phaseLightDirection[2]);
      const invQuat = this.group.quaternion.clone().invert();
      lightDir.applyQuaternion(invQuat).normalize();
      this.uPhaseLightDir.value.copy(lightDir);
    }
  }

  dispose(): void {
    this.disc.geometry.dispose();
    this.material.dispose();
    this.rings?.geometry.dispose();
    this.rings?.material.dispose();
  }
}
