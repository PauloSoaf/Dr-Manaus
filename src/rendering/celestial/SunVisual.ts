import { Group, Matrix4, Mesh, PerspectiveCamera, PlaneGeometry, Quaternion } from 'three/webgpu';
import type { CelestialRenderSample } from './types';
import type { QualityPreset } from '../../core/config';
import { SunMaterial } from './SunMaterial';
import { solarPresentation } from './solarPresentation';
import { smoothRange } from './presentation';

/** Bounded viewport quad. The physical edge is a ray/sphere intersection, never tan(90°) geometry. */
export class SunVisual {
  readonly group = new Group();
  private shader = new SunMaterial('High');
  private readonly disc = new Mesh(new PlaneGeometry(2, 2), this.shader.material);
  private readonly rotation = new Quaternion();
  private readonly matrix = new Matrix4();
  private quality: QualityPreset = 'High';
  private mode = 'DISTANT';
  constructor() {
    this.group.name = 'SunVisual';
    this.disc.frustumCulled = false;
    this.disc.renderOrder = -7;
    this.group.add(this.disc);
  }
  setQuality(quality: QualityPreset) {
    if (quality === this.quality) return;
    this.shader.dispose(); this.shader = new SunMaterial(quality);
    this.disc.material = this.shader.material; this.quality = quality;
  }
  update(sample: CelestialRenderSample, camera: PerspectiveCamera): void {
    this.group.visible = sample.visible;
    if (!sample.visible) return;
    const presentation = solarPresentation(sample.angularRadiusRad, this.quality);
    this.mode = presentation.mode;
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    const distance = Math.max(camera.near * 4, Math.min(100_000, camera.far * .9));
    camera.getWorldQuaternion(this.rotation);
    this.group.quaternion.copy(this.rotation);
    this.shader.direction.value.set(...sample.directionRender).applyQuaternion(this.rotation.clone().invert()).normalize();
    const dir=this.shader.direction.value;
    let cx=0,cy=0,hx=1,hy=1;
    // Small discs rasterize only their conservative optical rectangle. Close views use the
    // complete viewport; neither representation ever creates a tan(near-90°) mesh.
    if(sample.angularRadiusRad<.02) {
      if(dir.z>=0){this.group.visible=false;return;}
      const x=dir.x/(-dir.z*tangent*camera.aspect),y=dir.y/(-dir.z*tangent);
      const extent=Math.tan(sample.angularRadiusRad)*5*1.3/(dir.z*dir.z);
      const left=Math.max(-1,x-extent/(tangent*camera.aspect)),right=Math.min(1,x+extent/(tangent*camera.aspect));
      const bottom=Math.max(-1,y-extent/tangent),top=Math.min(1,y+extent/tangent);
      if(right<=left||top<=bottom){this.group.visible=false;return;}
      cx=(left+right)/2;cy=(bottom+top)/2;hx=(right-left)/2;hy=(top-bottom)/2;
    }
    this.shader.screenCentre.value.set(cx,cy);this.shader.screenHalf.value.set(hx,hy);
    this.group.position.set(cx*distance*tangent*camera.aspect,cy*distance*tangent,-distance).applyQuaternion(this.rotation);
    this.disc.scale.set(hx*distance*tangent*camera.aspect,hy*distance*tangent,1);
    this.shader.ratio.value = Math.max(1e-8, Math.min(1, sample.physicalRadiusM / Math.max(1, sample.logicalDistanceM)));
    this.shader.tangent.value.set(tangent * camera.aspect, tangent);
    this.shader.detail.value = presentation.detail;
    this.shader.micro.value = smoothRange(sample.angularRadiusRad, .9, 1.4);
    this.shader.prominence.value = presentation.prominence;
    this.shader.opacity.value = Math.max(0, Math.min(1, sample.opacity));
    this.shader.clock.value = (sample.solarTimeS ?? 0) % 1_000_000;
    const body = new Quaternion(...(sample.bodyOrientationRender ?? [0, 0, 0, 1]));
    this.matrix.makeRotationFromQuaternion(body.invert().multiply(this.rotation));
    this.shader.cameraToBody.value.setFromMatrix4(this.matrix);
  }
  get diagnostics() { return { mode: this.mode, quality: this.quality, drawCalls: this.group.visible ? 1 : 0,
    triangles: this.group.visible ? 2 : 0, materials: 1, coronaExtentR: 5 }; }
  dispose(): void { this.disc.geometry.dispose(); this.shader.dispose(); }
}
