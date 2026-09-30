import { Group, PerspectiveCamera } from 'three/webgpu';
import { SunVisual } from './SunVisual';
import { MoonVisual } from './MoonVisual';
import { EarthVisual } from './EarthVisual';
import type { CelestialRenderSample } from './types';

export class CelestialBodyVisualLayer {
  readonly root = new Group();
  private readonly sun = new SunVisual();
  private readonly moon = new MoonVisual();
  private readonly earth = new EarthVisual();

  constructor() {
    this.root.name = 'CelestialBodyVisualLayer';
    this.root.add(this.sun.group);
    this.root.add(this.moon.group);
    this.root.add(this.earth.group);
  }

  update(samples: CelestialRenderSample[], camera: PerspectiveCamera): void {
    // Lock the root group to the camera position to avoid parallax on far proxies
    this.root.position.copy(camera.position);

    let foundSun = false;
    let foundMoon = false;
    let foundEarth = false;

    for (const sample of samples) {
      if (sample.bodyId === 'sun') {
        this.sun.update(sample, camera.position);
        foundSun = true;
      } else if (sample.bodyId === 'moon') {
        this.moon.update(sample, camera.position);
        foundMoon = true;
      } else if (sample.bodyId === 'earth') {
        this.earth.update(sample, camera.position);
        foundEarth = true;
      }
    }

    if (!foundSun) {
      this.sun.group.visible = false;
    }
    if (!foundMoon) {
      this.moon.group.visible = false;
    }
    if (!foundEarth) {
      this.earth.group.visible = false;
    }
  }

  dispose(): void {
    this.sun.dispose();
    this.moon.dispose();
    this.earth.dispose();
  }
}
