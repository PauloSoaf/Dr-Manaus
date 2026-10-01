import { Group, PerspectiveCamera } from 'three/webgpu';
import { SunVisual } from './SunVisual';
import { PlanetVisual } from './PlanetVisual';
import type { CelestialRenderSample } from './types';

export class CelestialBodyVisualLayer {
  readonly root = new Group();
  private readonly sun = new SunVisual();
  private readonly planets = new Map<string, PlanetVisual>();

  constructor() {
    this.root.name = 'CelestialBodyVisualLayer';
    this.root.add(this.sun.group);
    
    // Register generic planets
    this.planets.set('moon', new PlanetVisual([0.5, 0.5, 0.5], [0.01, 0.01, 0.01]));
    this.planets.set('earth', new PlanetVisual([0.1, 0.3, 0.8], [0.02, 0.02, 0.05]));
    this.planets.set('mars', new PlanetVisual([0.7, 0.3, 0.1], [0.05, 0.02, 0.01]));
    
    for (const visual of this.planets.values()) {
      this.root.add(visual.group);
    }
  }

  update(samples: CelestialRenderSample[], camera: PerspectiveCamera): void {
    this.root.position.copy(camera.position);

    let foundSun = false;
    const foundPlanets = new Set<string>();

    for (const sample of samples) {
      if (sample.bodyId === 'sun') {
        this.sun.update(sample, camera.position);
        foundSun = true;
      } else {
        const visual = this.planets.get(sample.bodyId);
        if (visual) {
          visual.update(sample, camera.position);
          foundPlanets.add(sample.bodyId);
        }
      }
    }

    if (!foundSun) {
      this.sun.group.visible = false;
    }
    
    for (const [id, visual] of this.planets.entries()) {
      if (!foundPlanets.has(id)) {
        visual.group.visible = false;
      }
    }
  }

  dispose(): void {
    this.sun.dispose();
    for (const visual of this.planets.values()) {
      visual.dispose();
    }
  }
}
