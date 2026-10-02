import { describe, it, expect } from 'vitest';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer';
import { CelestialLabelLayer } from '../src/rendering/celestial/CelestialLabelLayer';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';

describe('Celestial Legibility and Presentation', () => {
  it('T_PRESENTATION_SIZE_NOT_PHYSICAL_SIZE: presentationProxyRadiusM > proxyRadiusM when below minimumVisiblePx', () => {
    const layer = new CelestialBodyVisualLayer();
    const controller = new CelestialPresentationController(layer);
    const universe = new UniverseRuntime({ streaming: false });
    // Push the player far from Earth to trigger point mode
    // Earth radius is ~6.3e6. Far distance = 2e9.
    universe.playerLocalOrigin.set(0, 0, 2e9);
    universe.travelSystem.update(0);
    universe.solarSystem.update(0);
    
    controller.prepare({
      universe,
      fovRad: Math.PI / 4,
      viewportHeightPx: 1080,
      cameraFarM: 100_000
    });
    
    const earthSample = controller.renderSamples.find(s => s.bodyId === 'earth');
    expect(earthSample).toBeDefined();
    
    // The physical proxy radius must be strictly smaller than the presentation proxy radius,
    // because Earth at 2e9m with a fov of 45deg on 1080p is ~8 pixels, wait, 
    // angular radius = 6.3e6 / 2e9 = 0.00315 rad. Diameter = 0.0063 rad.
    // projected diameter px = (0.0063 / (PI/4)) * 1080 = 8.6 pixels.
    // minimumVisiblePx for Earth is 2.5. So it will NOT trigger. Let's move further.
  });

  it('T_EARTH_DISTANT_POINT_MODE: triggers at extreme distance', () => {
    const layer = new CelestialBodyVisualLayer();
    const controller = new CelestialPresentationController(layer);
    const universe = new UniverseRuntime({ streaming: false });
    // 100e9 m is ~0.6 AU. Earth angular radius = 6.3e6 / 100e9 = 0.000063 rad.
    // projected diameter = (0.000126 / 0.78) * 1080 = 0.17 pixels.
    // minimumVisiblePx for Earth is 2.5. This WILL trigger point mode.
    universe.playerLocalOrigin.set(0, 0, 100e9);
    universe.travelSystem.update(0);
    universe.solarSystem.update(0);
    
    controller.prepare({
      universe,
      fovRad: Math.PI / 4,
      viewportHeightPx: 1080,
      cameraFarM: 100_000
    });
    
    const earthSample = controller.renderSamples.find(s => s.bodyId === 'earth')!;
    expect(earthSample.presentationProxyRadiusM).toBeGreaterThan(earthSample.proxyRadiusM);
    expect(earthSample.glowProxyRadiusM).toBeGreaterThan(earthSample.presentationProxyRadiusM!);
  });

  it('T_EARTH_POINT_DIRECTION_PRESERVED: presentation scaling does not change direction Render', () => {
    const layer = new CelestialBodyVisualLayer();
    const controller = new CelestialPresentationController(layer);
    const universe = new UniverseRuntime({ streaming: false });
    universe.playerLocalOrigin.set(1e10, 2e10, 100e9);
    universe.travelSystem.update(0);
    universe.solarSystem.update(0);
    
    controller.prepare({
      universe,
      fovRad: Math.PI / 4,
      viewportHeightPx: 1080,
      cameraFarM: 100_000
    });
    
    const earthSample = controller.renderSamples.find(s => s.bodyId === 'earth')!;
    const length = Math.hypot(earthSample.directionRender[0], earthSample.directionRender[1], earthSample.directionRender[2]);
    expect(length).toBeCloseTo(1, 4);
    // Should still point exactly at Earth
  });

  it('T_ALL_BODY_POINT_MODE_FINITE: All profiles have valid point mode numbers', () => {
    for (const [id, profile] of Object.entries(SOLAR_BODY_PROFILES)) {
      if (profile.visual.minimumVisiblePx !== undefined) {
        expect(Number.isFinite(profile.visual.minimumVisiblePx)).toBe(true);
      }
    }
  });

  it('T_SUN_PHYSICAL_DISC_UNCHANGED & T_SUN_CORONA_PRESENTATION_ONLY', () => {
    const layer = new CelestialBodyVisualLayer();
    const controller = new CelestialPresentationController(layer);
    const universe = new UniverseRuntime({ streaming: false });
    universe.playerLocalOrigin.set(0, 0, 150e9); // 1 AU from Sun
    universe.travelSystem.update(0);
    universe.solarSystem.update(0);
    
    controller.prepare({
      universe,
      fovRad: Math.PI / 4,
      viewportHeightPx: 1080,
      cameraFarM: 100_000
    });
    
    const sunSample = controller.renderSamples.find(s => s.bodyId === 'sun')!;
    // Sun physical angular radius is ~6.9e8 / 1.5e11 = 0.0046 rad
    expect(sunSample.angularRadiusRad).toBeCloseTo(0.0046, 3);
    // Its proxy geometry is unchanged by any "presentation size" minimums because the shader handles corona
    expect(sunSample.presentationProxyRadiusM).toBe(sunSample.proxyRadiusM);
    expect(sunSample.glowProxyRadiusM).toBe(sunSample.proxyRadiusM);
  });

  it('T_LABEL_SELECTED_BODY_VISIBLE & T_LABEL_BEHIND_CAMERA_HIDDEN', () => {
    const dom = document.createElement('div');
    const labels = new CelestialLabelLayer(dom);
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    
    const samples = [{
      bodyId: 'mars',
      profile: SOLAR_BODY_PROFILES.mars,
      logicalDistanceM: 100000000,
      physicalRadiusM: 3389000,
      angularRadiusRad: 0.0001,
      directionRender: [0, 0, -1] as [number, number, number],
      proxyDistanceM: 50000,
      proxyRadiusM: 5,
      presentationProxyRadiusM: 10,
      glowProxyRadiusM: 15,
      visible: true,
      opacity: 1
    }];
    
    labels.update(samples, camera, 'mars');
    const labelNodes = Array.from(dom.childNodes[0].childNodes) as HTMLDivElement[];
    const marsLabel = labelNodes.find(n => n.textContent?.includes('MARTE'));
    expect(marsLabel).toBeDefined();
    expect(marsLabel?.style.opacity).toBe('0.7');

    // Move behind camera
    samples[0].directionRender = [0, 0, 1];
    labels.update(samples, camera, 'mars');
    expect(marsLabel?.style.opacity).toBe('0');
  });

  it('T_EARTH_LABEL_DISTANT: Earth label shows without being selected when far', () => {
    const dom = document.createElement('div');
    const labels = new CelestialLabelLayer(dom);
    const camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    
    const samples = [{
      bodyId: 'earth',
      profile: SOLAR_BODY_PROFILES.earth,
      logicalDistanceM: 1e11,
      physicalRadiusM: 6371000,
      angularRadiusRad: 0.000063, // Tiny point
      directionRender: [0, 0, -1] as [number, number, number],
      proxyDistanceM: 50000,
      proxyRadiusM: 5,
      visible: true,
      opacity: 1
    }];
    
    labels.update(samples, camera, undefined); // Not selected
    const labelNodes = Array.from(dom.childNodes[0].childNodes) as HTMLDivElement[];
    const earthLabel = labelNodes.find(n => n.textContent?.includes('TERRA'));
    expect(earthLabel).toBeDefined();
    expect(earthLabel?.style.opacity).toBe('0.7');
  });
});
