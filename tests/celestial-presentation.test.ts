import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { celestialLabelOpacity, projectCelestialLabel, CELESTIAL_LABEL_NAMES } from '../src/rendering/celestial/CelestialLabelLayer.ts';
import { bodyPresentation } from '../src/rendering/celestial/presentation.ts';
import { angularRadiusRad } from '../src/rendering/celestial/math.ts';
import type { CelestialRenderSample } from '../src/rendering/celestial/types.ts';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { SOLAR_BODY_PROFILES } from '../src/world/celestial/CelestialBodyProfile.ts';
import { PlanetVisual } from '../src/rendering/celestial/PlanetVisual.ts';
import { SunVisual } from '../src/rendering/celestial/SunVisual.ts';

const options = { fovRad: Math.PI / 3, viewportHeightPx: 1080, cameraFarM: 100_000 };
const camera = () => new PerspectiveCamera(60, 1, 0.1, 100_000);
function sample(id = 'earth'): CelestialRenderSample {
  return { bodyId: id, profile: SOLAR_BODY_PROFILES[id], logicalDistanceM: 1e11, physicalRadiusM: 6e6,
    angularRadiusRad: 0.00006, directionRender: [0, 0, -1], proxyDistanceM: 50_000, proxyRadiusM: 3,
    physicalProjectedDiameterPx: 0.2, presentationDiameterPx: 2.5, visible: true, opacity: 1 };
}
function withDistantSamples(run: (samples: readonly CelestialRenderSample[], layer: CelestialBodyVisualLayer,
  universe: UniverseRuntime, controller: CelestialPresentationController) => void) {
  const universe = new UniverseRuntime({ streaming: false, epochS: 0 });
  const layer = new CelestialBodyVisualLayer();
  const controller = new CelestialPresentationController(layer);
  try {
    universe.updateSystemPose([1e13, 2e13, 1e13], [0, 0, 0], 0);
    controller.prepare({ universe, ...options });
    controller.render({ camera: camera() });
    run(controller.renderSamples, layer, universe, controller);
  } finally { layer.dispose(); universe.dispose(); }
}

test('T_EARTH_DISTANT_POINT_MODE and T_EARTH_POINT_DIRECTION_PRESERVED', () => {
  withDistantSamples((samples, layer, universe) => {
    const earth = samples.find(s => s.bodyId === 'earth')!;
    assert.equal(earth.pointMix, 1);
    assert.equal(earth.presentationDiameterPx, 3.5);
    assert.ok(earth.physicalProjectedDiameterPx! < 1);
    assert.ok(earth.glowProxyRadiusM! > earth.presentationProxyRadiusM!);
    const centre = universe.activeSystem.positionOf('earth')!;
    const observer = universe.playerSystemPositionM();
    const direction = universe.frames.convertDirection('solar-system/barycentric',
      universe.renderSpace.currentOrigin.frame, centre.map((v, i) => v - observer[i]) as [number, number, number]);
    const expected = new Vector3(...direction).normalize();
    assert.ok(expected.distanceTo(new Vector3(...earth.directionRender)) < 1e-12);
    const actual = layer.root.getObjectByName('earth-proxy')!.position.clone().normalize();
    assert.ok(actual.distanceTo(expected) < 1e-12);
  });
});

test('T_PRESENTATION_SIZE_NOT_PHYSICAL_SIZE: changing floors cannot affect physical measurements or activation', () => {
  withDistantSamples((samples, _layer, universe, controller) => {
    for (const s of samples) {
      const body = universe.activeSystem.bodies.find(b => b.id === s.bodyId)!;
      assert.equal(s.physicalRadiusM, body.equatorialRadiusM);
      const position = universe.activeSystem.positionOf(s.bodyId)!;
      const observer = universe.playerSystemPositionM();
      assert.equal(s.logicalDistanceM, Math.hypot(...position.map((v, i) => v - observer[i])));
      assert.equal(s.angularRadiusRad, universe.activeSystem.handoff(s.bodyId, observer)?.apparentAngularRadiusRad
        ?? angularRadiusRad(s.physicalRadiusM, s.logicalDistanceM));
      const normal = bodyPresentation(s.angularRadiusRad, s.profile!.visual, options.fovRad, 1080);
      const exaggerated = bodyPresentation(s.angularRadiusRad, { ...s.profile!.visual, minimumVisiblePx: 100 }, options.fovRad, 1080);
      assert.equal(normal.physicalProjectedDiameterPx, exaggerated.physicalProjectedDiameterPx);
      assert.equal(normal.physicalTangent, exaggerated.physicalTangent);
    }
    assert.equal(controller.physicalBodyId, undefined);
    assert.equal(controller.physicalMode, 'off');
  });
});

test('T_ALL_BODY_POINT_MODE_FINITE: all ten distant samples and optical extents fit the far plane', () => {
  withDistantSamples((samples, layer) => {
    assert.equal(samples.length, 10);
    for (const s of samples) {
      assert.ok([s.physicalProjectedDiameterPx!, s.presentationDiameterPx!, s.pointMix!, s.proxyRadiusM,
        s.presentationProxyRadiusM!, s.glowProxyRadiusM!, s.proxyDistanceM, ...s.directionRender].every(Number.isFinite));
      const p = bodyPresentation(s.angularRadiusRad, s.profile!.visual, options.fovRad, 1080);
      assert.ok(s.proxyDistanceM * (1 + p.extentTangent) < options.cameraFarM);
      assert.ok(s.proxyDistanceM * p.extentTangent < 10_000_000);
      if (s.bodyId !== 'sun') assert.equal(s.pointMix, 1);
    }
    layer.root.traverse(object => assert.ok([...object.position.toArray(), ...object.scale.toArray()].every(Number.isFinite)));
  });
});

test('T_SUN_PHYSICAL_DISC_UNCHANGED and T_SUN_CORONA_PRESENTATION_ONLY', () => {
  withDistantSamples(samples => {
    const s = samples.find(s => s.bodyId === 'sun')!;
    const glow = s.profile!.visual.solarGlow!;
    const modified = bodyPresentation(s.angularRadiusRad, { ...s.profile!.visual,
      solarGlow: { innerScale: 1.5, outerScale: 3 } }, options.fovRad, 1080);
    assert.equal(modified.physicalTangent, Math.tan(s.angularRadiusRad));
    assert.equal(s.presentationProxyRadiusM, s.proxyRadiusM);
    const visual = new SunVisual();
    try {
      visual.update(s, new Vector3());
      const quad = visual.group.children[0] as Mesh;
      assert.equal(quad.scale.x, s.proxyRadiusM * glow.outerScale);
      assert.equal(quad.scale.x / glow.outerScale, s.proxyRadiusM);
      assert.equal(glow.innerScale, 2);
      assert.equal(glow.outerScale, 5);
      assert.ok(s.proxyDistanceM + quad.scale.x < options.cameraFarM);
    } finally { visual.dispose(); }
  });
});

test('T_MOON_MIN_BRIGHTNESS: neutral finite ambient floor and brighter phased lit side', () => {
  const profile = SOLAR_BODY_PROFILES.moon.visual;
  const visual = new PlanetVisual([...profile.albedo], undefined, profile);
  try {
    const uniforms = visual as unknown as { uAmbient: { value: Vector3 }; uAlbedo: { value: Vector3 } };
    assert.deepEqual(uniforms.uAmbient.value.toArray(), [0.08, 0.08, 0.08]);
    assert.deepEqual(uniforms.uAlbedo.value.toArray(), [0.65, 0.65, 0.65]);
    for (const illumination of [0, 0.01, 0.25, 0.5, 1]) {
      const channels = profile.albedo.map((albedo, i) => albedo * illumination ** (profile.phaseExponent ?? 0.8)
        + profile.ambient![i] * (1 - illumination));
      assert.ok(channels.every(v => Number.isFinite(v) && v >= 0.08 && v <= 0.65));
    }
    assert.ok(profile.albedo[0] / profile.ambient![0] > 8, 'night floor retains substantial phase contrast');
  } finally { visual.dispose(); }
});

test('point floor, glow and disc regimes transition continuously and stay finite near/inside a body', () => {
  const profile = SOLAR_BODY_PROFILES.earth.visual;
  const scale = 1080 / Math.tan(options.fovRad / 2);
  for (const boundary of [3.5, 10.5]) {
    const before = bodyPresentation(Math.atan((boundary - 1e-6) / scale), profile, options.fovRad, 1080);
    const after = bodyPresentation(Math.atan((boundary + 1e-6) / scale), profile, options.fovRad, 1080);
    assert.ok(Math.abs(before.presentationDiameterPx - after.presentationDiameterPx) < 3e-6);
    assert.ok(Math.abs(before.pointMix - after.pointMix) < 1e-6);
  }
  for (const angle of [0, 0.1, 1, Math.PI / 2]) {
    const p = bodyPresentation(angle, profile, options.fovRad, 1080);
    assert.ok(Object.values(p).every(Number.isFinite));
  }
  assert.ok(Object.values(bodyPresentation(0.001, profile, 0, 0)).every(Number.isFinite));
  assert.equal(bodyPresentation(0.1, profile, options.fovRad, 1080).pointMix, 0);
});

test('T_LABEL_SELECTED_BODY_VISIBLE: every selected body, including a retired physical proxy, is eligible', () => {
  for (const id of Object.keys(SOLAR_BODY_PROFILES)) {
    const s = { ...sample(id), visible: false, angularRadiusRad: 1, physicalProjectedDiameterPx: 300 };
    const projected = projectCelestialLabel(s, camera())!;
    assert.ok(projected);
    assert.equal(celestialLabelOpacity(s, { selectedBodyId: id }, projected), 0.9);
    assert.ok(CELESTIAL_LABEL_NAMES[id]);
  }
  assert.equal(CELESTIAL_LABEL_NAMES.mercury, 'MERCÚRIO');
  assert.equal(CELESTIAL_LABEL_NAMES.venus, 'VÊNUS');
  assert.equal(CELESTIAL_LABEL_NAMES.jupiter, 'JÚPITER');
});

test('T_LABEL_BEHIND_CAMERA_HIDDEN and invalid/outside projections hidden', () => {
  for (const patch of [
    { directionRender: [0, 0, 1] }, { directionRender: [1, 0, 0] },
    { directionRender: [NaN, 0, -1] }, { proxyDistanceM: Infinity },
    { proxyDistanceM: 1.5e11 }, { proxyDistanceM: 0 },
    { directionRender: [Math.sqrt(0.5), 0, -Math.sqrt(0.5)] },
  ]) assert.equal(projectCelestialLabel({ ...sample(), ...patch } as CelestialRenderSample, camera()), undefined);
});

test('T_LABEL_PROJECTION_BOUNDED: logical distance and camera rebases do not change the bounded anchor', () => {
  const c = camera();
  const s = sample();
  const before = projectCelestialLabel(s, c);
  c.position.set(1000, -2000, 3000);
  c.updateMatrixWorld();
  assert.deepEqual(projectCelestialLabel({ ...s, logicalDistanceM: 1e25 }, c), before);
  c.rotation.y = Math.PI;
  c.updateMatrixWorld();
  assert.equal(projectCelestialLabel(s, c), undefined);
});

test('T_EARTH_LABEL_DISTANT: travel context shows tiny Earth, globe fades, selection overrides', () => {
  const s = sample();
  const screen = { x: 0, y: 0 };
  assert.equal(celestialLabelOpacity(s, { inTravel: true }, screen), 0.7);
  assert.equal(celestialLabelOpacity(s, { inTravel: false }, screen), 0);
  assert.equal(celestialLabelOpacity({ ...s, physicalProjectedDiameterPx: 20 }, { inTravel: true }, screen), 0);
  assert.equal(celestialLabelOpacity({ ...s, physicalProjectedDiameterPx: 12 }, { inTravel: true }, screen), 0.35);
  assert.equal(celestialLabelOpacity({ ...s, physicalProjectedDiameterPx: 20 }, { selectedBodyId: 'earth' }, screen), 0.9);
});

test('Moon labels require Earth/Moon travel context; unselected Sun avoids the centre', () => {
  const screen = { x: 0, y: 0 };
  assert.equal(celestialLabelOpacity(sample('moon'), { inTravel: true, referenceBodyId: 'mars' }, screen), 0);
  assert.ok(celestialLabelOpacity(sample('moon'), { inTravel: true, referenceBodyId: 'earth' }, screen) > 0);
  assert.equal(celestialLabelOpacity(sample('sun'), { inTravel: true }, screen), 0);
  assert.ok(celestialLabelOpacity(sample('sun'), { inTravel: true }, { x: 0.7, y: 0 }) > 0);
  assert.equal(celestialLabelOpacity(sample('mars'), { inTravel: true }, screen), 0);
});

test('T_SATURN_RINGS_SUBPIXEL_HIDDEN: rings fade in using physical size, independently of point floor', () => {
  withDistantSamples((samples, layer) => {
    const saturn = samples.find(s => s.bodyId === 'saturn')!;
    const rings = layer.root.getObjectByName('saturn-proxy')!.getObjectByName('analytic-rings')!;
    assert.equal(saturn.ringsOpacity, 0);
    assert.equal(rings.visible, false);
    const profile = saturn.profile!.visual;
    const scale = 1080 / Math.tan(options.fovRad / 2);
    for (const [ringPx, opacity] of [[5.99, 0], [7.5, 0.5], [9, 1]]) {
      const p = bodyPresentation(Math.atan(ringPx / profile.rings!.outerRadius / scale), profile, options.fovRad, 1080);
      assert.ok(Math.abs(p.ringsOpacity - opacity) < 1e-12);
      const exaggerated = bodyPresentation(Math.atan(ringPx / profile.rings!.outerRadius / scale),
        { ...profile, minimumVisiblePx: 50 }, options.fovRad, 1080);
      assert.equal(exaggerated.ringsOpacity, p.ringsOpacity);
    }
  });
});
