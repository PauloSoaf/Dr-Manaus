import { Matrix3, MeshBasicNodeMaterial, NormalBlending, Vector2, Vector3 } from 'three/webgpu';
import { Fn, If, atan, cos, float, mix, mx_noise_float, mx_worley_noise_float, positionLocal,
  sin, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { QualityPreset } from '../../core/config';

/** One analytic ray-disc, with body-fixed procedural coordinates and optical-only halo. */
export class SunMaterial {
  readonly material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false,
    depthTest: true, blending: NormalBlending, fog: false });
  readonly direction = uniform(new Vector3(0, 0, -1));
  readonly ratio = uniform(.00465);
  readonly tangent = uniform(new Vector2(1, 1));
  readonly screenCentre = uniform(new Vector2());
  readonly screenHalf = uniform(new Vector2(1, 1));
  readonly cameraToBody = uniform(new Matrix3());
  readonly clock = uniform(0);
  readonly detail = uniform(0);
  readonly micro = uniform(0);
  readonly prominence = uniform(0);
  readonly opacity = uniform(1);

  constructor(readonly quality: QualityPreset) {
    // Sky depth keeps opaque foreground bodies/city in front despite the bounded quad.
    this.material.depthNode = float(1);
    const screen = positionLocal.xy.mul(this.screenHalf).add(this.screenCentre);
    const ray = vec3(screen.x.mul(this.tangent.x), screen.y.mul(this.tangent.y), -1).normalize();
    const mu = ray.dot(this.direction);
    const discriminant = mu.mul(mu).sub(float(1).sub(this.ratio.mul(this.ratio)));
    const separation = float(1).sub(mu.mul(mu)).max(0).sqrt().div(this.ratio);
    const front = smoothstep(0, .001, mu);
    const disc = float(1).sub(smoothstep(.998, 1.002, separation)).mul(front);
    this.material.colorNode = Fn(() => {
      const output = vec4(0).toVar();
      If(separation.lessThan(5).and(mu.greaterThan(0)), () => {
        const t = float(1).sub(this.ratio.mul(this.ratio))
          .div(mu.add(discriminant.max(0).sqrt()).max(1e-6));
        const normal = ray.mul(t).sub(this.direction).div(this.ratio);
        const p = this.cameraToBody.mul(normal).normalize();
        const evolution = vec3(this.clock.mul(.0007), this.clock.mul(.0003), this.clock.mul(-.0004));
        const macro = mx_noise_float(p.mul(18).add(evolution)).mul(.5).add(.5);
        const cells = mx_worley_noise_float(p.mul(95).add(evolution));
        const lanes = smoothstep(.42, .78, cells);
        let convection = float(1).sub(lanes.mul(.38)).mul(macro.mul(.25).add(.85));
        if (quality !== 'Low') {
          const fine = mx_noise_float(p.mul(370).add(evolution)).mul(.5).add(.5);
          const microCoordinate = p.mul(quality === 'Ultra' ? 500000 : 300000);
          const microFilter = float(1).sub(smoothstep(.4, 1.2, microCoordinate.fwidth().length()));
          const microCells = mx_noise_float(microCoordinate.add(evolution));
          convection = convection.mul(fine.mul(.22).add(.82))
            .mul(float(1).add(microCells.mul(.7).mul(this.micro).mul(microFilter)));
        }
        let activity = float(0).add(0), facula = float(0).add(0);
        for (const axis of [[.25,.18,-.95],[-.58,-.12,-.81],[.8,.3,.5],[-.2,-.28,.94]]) {
          const distance = float(1).sub(p.dot(vec3(axis[0], axis[1], axis[2]).normalize()));
          activity = activity.add(float(1).sub(smoothstep(.0008, .004, distance)));
          facula = facula.add(float(1).sub(smoothstep(.004, .009, distance)));
        }
        const limb = discriminant.max(0).sqrt().div(this.ratio).saturate();
        const brightness = mix(float(1), convection, this.detail)
          .mul(float(1).sub(activity.saturate().mul(.78).mul(this.detail)))
          .add(facula.mul(.09).mul(this.detail)).mul(limb.mul(.42).add(.58));
        const photosphere = mix(vec3(1.5, .48, .08), vec3(2.4, 1.2, .35), limb).mul(brightness);
        const theta = atan(ray.y.sub(this.direction.y), ray.x.sub(this.direction.x));
        const slow = this.clock.mul(.001);
        const streamers = sin(theta.mul(7).add(slow)).mul(.22)
          .add(cos(theta.mul(13).sub(slow.mul(.7))).mul(.13)).add(.65);
        const edgeDistance = separation.sub(1).max(0);
        const inner = edgeDistance.mul(-5).exp().mul(.3);
        const outer = float(1).sub(smoothstep(1, 5, separation)).pow(3).mul(streamers).mul(.13);
        const glare = edgeDistance.mul(-22).exp().mul(.35);
        const loopAngle = sin(theta.mul(6).add(sin(theta.mul(3)).mul(.7)).add(.8).add(slow));
        const arcHeight = loopAngle.max(0).pow(2).mul(.15)
          .mul(sin(theta.mul(7)).pow(2).mul(.6).add(.4));
        const loops = float(1).sub(smoothstep(.006, .018, edgeDistance.sub(arcHeight).abs()))
          .mul(smoothstep(.02, .04, edgeDistance)).mul(loopAngle.max(0).pow(3)).mul(this.prominence);
        const halo = inner.add(outer).add(glare).add(loops.mul(.8)).mul(float(1).sub(disc)).mul(front);
        const colour = mix(vec3(2.1, .8, .18), photosphere, disc);
        output.assign(vec4(colour, disc.add(halo).saturate().mul(this.opacity)));
      });
      return output;
    })();
    this.material.name = `SunMaterial/${quality}`;
  }
  dispose() { this.material.dispose(); }
}
