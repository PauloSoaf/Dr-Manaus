import { BufferAttribute, Group, Mesh, MeshBasicNodeMaterial, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu';
import { attribute, normalLocal, smoothstep, uniform } from 'three/tsl';
import { surfaceColour } from '../../world/planet/EarthLandMask';
import { moonColourAt } from '../../world/planet/MoonSurface';
import type { CelestialRenderSample } from './types';

/** Bounded presentation geometry. Coordinates and geography share the physical body's fixed axes. */
export class GeographicBodyVisual {
  readonly group = new Group();
  readonly mesh: Mesh<SphereGeometry, MeshBasicNodeMaterial>;
  private readonly sun = uniform(new Vector3(1, 0, 0));
  private readonly opacity = uniform(1);

  constructor(readonly bodyId: 'earth' | 'moon') {
    const geometry = new SphereGeometry(1, 128, 64);
    // Three's sphere is Y-up; the body-fixed frame is Z-up, longitude zero along +X.
    geometry.rotateX(Math.PI / 2);
    const positions = geometry.getAttribute('position');
    const colours = new Float32Array(positions.count * 3);
    const direction = new Vector3();
    const rgb: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < positions.count; i++) {
      direction.fromBufferAttribute(positions, i).normalize();
      if (bodyId === 'earth') surfaceColour(Math.asin(direction.z), Math.atan2(direction.y, direction.x), rgb);
      else moonColourAt(direction.toArray(), rgb);
      colours.set(rgb, i * 3);
    }
    geometry.setAttribute('color', new BufferAttribute(colours, 3));
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, fog: false });
    const illumination = bodyId === 'moon' ? smoothstep(-0.1, 0.1, normalLocal.dot(this.sun))
      : smoothstep(-0.06, 0.16, normalLocal.dot(this.sun));
    material.colorNode = attribute('color', 'vec3').mul(bodyId === 'moon'
      ? illumination.mul(0.95).add(0.05) : illumination.mul(0.92).add(0.08));
    material.opacityNode = this.opacity;
    this.mesh = new Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.group.name = `${bodyId}-geographic-proxy`;
    this.group.add(this.mesh);
  }

  update(sample: CelestialRenderSample): void {
    const discWeight = 1 - (sample.pointMix ?? 0);
    this.group.visible = sample.visible && discWeight > 0;
    this.opacity.value = sample.opacity * discWeight;
    if (!this.group.visible) return;
    this.group.position.set(...sample.directionRender).multiplyScalar(sample.proxyDistanceM);
    this.group.quaternion.set(...(sample.bodyFixedOrientationRender ?? [0, 0, 0, 1]));
    // A sphere subtends asin(r/d); the existing billboard uses tan(angle)*d.
    this.mesh.scale.setScalar(Math.sin(sample.angularRadiusRad) * sample.proxyDistanceM);
    if (sample.phaseLightDirection) this.sun.value.set(...sample.phaseLightDirection)
      .applyQuaternion(new Quaternion().copy(this.group.quaternion).invert()).normalize();
  }

  dispose(): void { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
