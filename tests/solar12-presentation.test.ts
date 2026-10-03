import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, PerspectiveCamera, Quaternion, Vector3 } from 'three/webgpu';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime.ts';
import { SOLAR_SYSTEM_BODIES, bodyById } from '../src/world/celestial/CelestialBody.ts';
import { bodyProfile } from '../src/world/celestial/CelestialBodyProfile.ts';
import { CelestialBodyVisualLayer } from '../src/rendering/celestial/CelestialBodyVisualLayer.ts';
import { CelestialPresentationController } from '../src/rendering/celestial/CelestialPresentationController.ts';
import { CelestialLabelLayer, reserveLabelRect, type LabelRect } from '../src/rendering/celestial/CelestialLabelLayer.ts';
import { PlanetVisual } from '../src/rendering/celestial/PlanetVisual.ts';
import { bodyPresentation } from '../src/rendering/celestial/presentation.ts';
import { normalizeVec3, distanceVec3, subVec3 } from '../src/world/spatial/units.ts';

const moons = SOLAR_SYSTEM_BODIES.filter(b => b.parentId && b.parentId !== 'sun');
const options = { fovRad: 1, viewportHeightPx: 900, cameraFarM: 100000 };

for (const epoch of [0, 1e8]) test(`T_ALL_MOONS_RENDER_FINITE / T_ALL_MOONS_RENDER_BOUNDED / T_MOON_PHASES_USE_SUN: ${epoch}`, () => {
  const u = new UniverseRuntime({ epochS: epoch }), layer = new CelestialBodyVisualLayer(), c = new CelestialPresentationController(layer);
  const camera = new PerspectiveCamera(57, 1, .1, options.cameraFarM);
  try {
      for (const body of moons) {
        const p = u.activeSystem.positionOf(body.id)!;
        u.updateSystemPose([p[0] + body.equatorialRadiusM * 3, p[1], p[2]], [0, 0, 0], 0);
        c.prepare({ universe: u, ...options }); c.render({ camera });
        const sample = c.renderSamples.find(s => s.bodyId === body.id)!;
        assert.ok([...sample.directionRender, ...sample.phaseLightDirection!, sample.proxyRadiusM, sample.proxyDistanceM].every(Number.isFinite));
        const sun = normalizeVec3(u.frames.convertDirection('solar-system/barycentric', u.renderSpace.currentOrigin.frame,
          subVec3(u.activeSystem.positionOf('sun')!, p)));
        assert.ok(distanceVec3(sun, sample.phaseLightDirection!) < 1e-12);
        const optical = bodyPresentation(sample.angularRadiusRad, sample.profile!.visual, options.fovRad, 900);
        assert.ok(sample.proxyDistanceM + sample.proxyDistanceM * optical.extentTangent < camera.far);
        const proxy = layer.root.getObjectByName(`${body.id}-proxy`)!;
        assert.ok(proxy.position.length() < camera.far);
      }
    let meshes = 0; layer.root.traverse(o => { if (o instanceof Mesh) meshes++; });
    assert.equal(meshes, 22, 'nine extra cheap quads, no extra geographic spheres');
  } finally { layer.dispose(); u.dispose(); }
});

test('Titan haze stays bounded in the existing quad; sunlight attenuation remains separate from ambient', () => {
  const profile = bodyProfile(bodyById('titan')!), visual = new PlanetVisual([...profile.visual.albedo], undefined, profile.visual);
  const p = bodyPresentation(.01, profile.visual, 1, 900);
  assert.ok(p.glowTangent > p.presentationTangent); assert.equal(p.glowTangent, p.extentTangent);
  try {
    visual.update({ bodyId: 'titan', profile, directionRender: [0,0,-1], proxyDistanceM: 1000,
      proxyRadiusM: 10, presentationProxyRadiusM: 10, glowProxyRadiusM: 11.2, angularRadiusRad: .01,
      logicalDistanceM: 1e9, physicalRadiusM: 2574965, visible: true, opacity: 1, pointMix: 0,
      phaseLightDirection: [1,0,0], directSunlight01: .25 }, new Vector3());
    assert.equal((visual as any).uGlowStrength.value, .3);
    assert.equal((visual as any).uDirectSunlight.value, .25);
    assert.equal(visual.group.children.length, 1);
  } finally { visual.dispose(); }
});

test('T_LABEL_SELECTED_MOON_VISIBLE / T_LABEL_CLUSTER_REDUCES_OVERLAP: selected label reserves space first', () => {
  const u = new UniverseRuntime(), layer = new CelestialBodyVisualLayer(), controller = new CelestialPresentationController(layer);
  const labels = Object.create(CelestialLabelLayer.prototype) as CelestialLabelLayer;
  const elements = new Map(moons.map(b => [b.id, { style: {}, textContent: '', offsetWidth: 90 }]));
  Object.assign(labels, { container: { clientWidth: 1000, clientHeight: 700 }, labels: elements,
    marker: { hidden: true, style: {}, dataset: {} }, markerPoint: new Vector3(),
    markerRotation: new Quaternion(), markerScreen: { x: 0, y: 0, offscreen: false } });
  try {
    u.updateSystemPose([1e13, 0, 0], [0,0,0], 0); controller.prepare({ universe: u, ...options });
    const cluster = controller.renderSamples.filter(s => ['io','europa','ganymede','callisto'].includes(s.bodyId))
      .map(s => ({ ...s, directionRender: [0,0,-1] as [number,number,number], physicalProjectedDiameterPx: 20 }));
    labels.update(cluster, new PerspectiveCamera(60,1,.1,100000), { selectedBodyId: 'europa', inTravel: true, referenceBodyId: 'jupiter' });
    assert.equal((elements.get('europa')!.style as any).visibility, 'visible');
    for (const id of ['io','ganymede','callisto']) assert.equal((elements.get(id)!.style as any).visibility, 'hidden');
    const occupied: LabelRect[] = [];
    assert.equal(reserveLabelRect({ x:100, y:100, halfWidth:40 }, occupied), true);
    assert.equal(reserveLabelRect({ x:110, y:110, halfWidth:40 }, occupied), false);
    assert.equal(reserveLabelRect({ x:300, y:100, halfWidth:40 }, occupied), true);
  } finally { layer.dispose(); u.dispose(); }
});
