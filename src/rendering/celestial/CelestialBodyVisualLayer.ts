import { Group, PerspectiveCamera } from 'three/webgpu';
import { SunVisual } from './SunVisual';
import { PlanetVisual } from './PlanetVisual';
import type { CelestialRenderSample } from './types';
import { SOLAR_SYSTEM_BODIES } from '../../world/celestial/CelestialBody';
import { bodyProfile } from '../../world/celestial/CelestialBodyProfile';
import { GeographicBodyVisual } from './GeographicBodyVisual';

export class CelestialBodyVisualLayer {
  readonly root = new Group();
  private readonly sun = new SunVisual();
  private readonly planets = new Map<string, PlanetVisual>();
  private readonly geographic = new Map<string, GeographicBodyVisual>();

  constructor(parent?: Group) {
    this.root.name = 'CelestialBodyVisualLayer';
    this.root.add(this.sun.group);
    
    parent?.add(this.root);
    for (const body of SOLAR_SYSTEM_BODIES) {
      const profile = bodyProfile(body);
      if (profile.bodyClass === 'star') continue;
      const visual = new PlanetVisual([...profile.visual.albedo], undefined, profile.visual);
      visual.group.name = `${body.id}-proxy`;
      this.planets.set(body.id, visual);
      if (body.id === 'earth' || body.id === 'moon') {
        const geography = new GeographicBodyVisual(body.id);
        this.geographic.set(body.id, geography);
        this.root.add(geography.group);
      }
    }
    
    for (const visual of this.planets.values()) {
      this.root.add(visual.group);
    }
  }

  update(samples: readonly CelestialRenderSample[], camera: PerspectiveCamera): void {
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
          const geography = this.geographic.get(sample.bodyId);
          geography?.update(sample);
          visual.update(geography ? { ...sample, opacity: sample.opacity * (sample.pointMix ?? 0) } : sample, camera.position);
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
        const geography = this.geographic.get(id);
        if (geography) geography.group.visible = false;
      }
    }
  }

  dispose(): void {
    this.sun.dispose();
    for (const visual of this.geographic.values()) visual.dispose();
    for (const visual of this.planets.values()) {
      visual.dispose();
    }
  }
}
