import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera } from 'three/webgpu';
import {
  HypercruisePresentation,
  proxyCacheKey,
} from '../src/rendering/HypercruisePresentation';
import {
  hypercruiseTelemetry,
  hypercruisePhaseLabel,
  effectiveHypercruiseSpeed,
} from '../src/ui/HypercruiseTelemetry';
import {
  CosmologyMapRenderer,
  GalaxyMapRenderer,
} from '../src/ui/map/MapRenderers';
import {
  renderUniversalTargetCardHtml,
  describeNavigationGuidance,
} from '../src/ui/map/UniversalMapPanel';
import { GalaxyMorphologyRenderer } from '../src/world/galaxy/GalaxyMorphologyRenderer';
import {
  ProceduralGalaxyDiscovery,
  DEFAULT_UNIVERSE_SEED,
} from '../src/world/galaxy/ProceduralGalaxyDiscovery';
import {
  galaxyDefinition,
  setProceduralUniverseSeed,
} from '../src/world/galaxy/GalaxyCoordinates';
import { resolveGalaxyDescriptor } from '../src/world/galaxy/GalaxyPointCloudProvider';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import { GalaxyMaterializer } from '../src/world/galaxy/GalaxyMaterializer';
import {
  ProceduralSystemMaterializer,
  safeSystemArrivalM,
} from '../src/world/runtime/ProceduralSystemMaterializer';
import {
  UniversalTargetCatalog,
  SOLAR_TARGET_ADDRESS,
} from '../src/world/travel/UniversalTargetCatalog';
import { UniversalTargetResolver, type TargetResolutionContext } from '../src/world/travel/UniversalTargetResolver';
import {
  UniversalTravelController,
  type DepartureSafety,
  type HypercruisePhase,
} from '../src/world/travel/UniversalTravelController';
import { GalaxyEntryResolver } from '../src/world/travel/GalaxyEntryResolver';

const SAFE_DEPARTURE: DepartureSafety = {
  grounded: false,
  localPhysics: false,
  landing: false,
  collision: false,
  materializing: false,
};

function createMockCanvas(width = 1000, height = 650) {
  const texts: string[] = [];
  const arcs: { x: number; y: number; r: number; strokeStyle: unknown; fillStyle: unknown }[] = [];
  const ellipses: { x: number; y: number; rx: number; ry: number; rot: number }[] = [];

  const ctx: Record<string, any> = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    font: '12px sans-serif',
    textAlign: 'left',
    clearRect() {},
    fillRect() {},
    setTransform() {},
    beginPath() {},
    stroke() {},
    fill() {},
    moveTo() {},
    lineTo() {},
    arc(x: number, y: number, r: number) {
      arcs.push({ x, y, r, strokeStyle: ctx.strokeStyle, fillStyle: ctx.fillStyle });
    },
    ellipse(x: number, y: number, rx: number, ry: number, rot: number) {
      ellipses.push({ x, y, rx, ry, rot });
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    save() {},
    restore() {},
    rotate() {},
    translate() {},
    fillText(text: string) {
      texts.push(text);
    },
    measureText(text: string) {
      return { width: text.length * 7 };
    },
  };

  const canvas = {
    width,
    height,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0 }),
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx, texts, arcs, ellipses };
}

function makeTransitSetup(seed: bigint = DEFAULT_UNIVERSE_SEED) {
  setProceduralUniverseSeed(seed);
  const catalog = new UniversalTargetCatalog(seed);
  const universe = new UniverseRuntime({ epochS: 0 });
  const root = new Group();
  const galaxyMat = new GalaxyMaterializer(universe, root);
  const initial = galaxyMat.prepare('milky_way');
  initial.install();
  initial.activate();
  initial.complete?.();
  const noop = { install: () => {}, activate: () => {}, dispose: () => {} };
  const sysMat = new ProceduralSystemMaterializer(universe, catalog, noop, () => noop, undefined, galaxyMat);
  universe.installSystem(universe.solarSystem, SOLAR_TARGET_ADDRESS, safeSystemArrivalM(universe.solarSystem));
  const controller = new UniversalTravelController(universe, catalog, {
    prepare: plan => sysMat.prepareTravel(plan.resolvedDestination),
  });
  return {
    catalog,
    universe,
    root,
    galaxyMat,
    sysMat,
    controller,
    dispose() {
      controller.dispose();
      sysMat.current?.dispose();
      galaxyMat.current?.dispose();
      universe.dispose();
      setProceduralUniverseSeed(DEFAULT_UNIVERSE_SEED);
    },
  };
}

function findReachableProceduralGalaxy(catalog: UniversalTargetCatalog): string {
  const region = catalog.discovery.discoverRegion({ x: 0n, y: 0n, z: 0n }, 3, 64);
  for (const g of region) {
    if (!g.isKnownAstronomicalEntity && GalaxyEntryResolver.resolve(g.id, catalog)) {
      return g.id;
    }
  }
  throw new Error('Nenhuma galáxia procedural com sistema de entrada encontrada na região de teste');
}

test('T_U45_01: Diferenciação visual por fase e domínio do Hypercruise + modo reducedMotion', () => {
  const setup = makeTransitSetup();
  try {
    const parent = new Group();
    const camera = new PerspectiveCamera();
    const pres = new HypercruisePresentation(parent);

    const target = setup.catalog.target('andromeda')!;
    assert.equal(setup.controller.start(target, SAFE_DEPARTURE), 'started');

    const phases: HypercruisePhase[] = [
      'spool',
      'acceleration',
      'cruise',
      'deceleration',
      'arrival-hold',
      'arrival',
      'coasting',
    ];
    const snapshots = new Map<HypercruisePhase, ReturnType<typeof pres.getPhaseVisualState>>();

    for (const ph of phases) {
      setup.controller.state!.phase = ph;
      setup.controller.state!.progress =
        ph === 'spool'
          ? 0.01
          : ph === 'acceleration'
            ? 0.12
            : ph === 'cruise'
              ? 0.5
              : ph === 'deceleration'
                ? 0.88
                : ph === 'arrival-hold'
                  ? 0.985
                  : ph === 'arrival'
                    ? 0.995
                    : 0.4;
      for (let step = 0; step < 25; step++) {
        pres.update(setup.controller.state, camera, 0.05);
      }
      snapshots.set(ph, pres.getPhaseVisualState());
    }

    const spool = snapshots.get('spool')!;
    const cruise = snapshots.get('cruise')!;
    const decel = snapshots.get('deceleration')!;
    const hold = snapshots.get('arrival-hold')!;
    const coast = snapshots.get('coasting')!;

    assert.equal(cruise.domain, 'intergalactic');
    assert.ok(cruise.lengthScale > spool.lengthScale * 2.5, 'Cruise streaks must elongate significantly vs spool');
    assert.ok(cruise.speedScale > decel.speedScale, 'Cruise speedScale must exceed deceleration');
    assert.ok(hold.speedScale < decel.speedScale, 'Arrival-hold must calm streak motion');
    assert.ok(coast.opacity < cruise.opacity, 'Coasting must reduce streak opacity');

    // Reduced motion clamps streak length, speed, and opacity
    pres.setReducedMotion(true);
    setup.controller.state!.phase = 'cruise';
    for (let step = 0; step < 30; step++) {
      pres.update(setup.controller.state, camera, 0.05);
    }
    const reduced = pres.getPhaseVisualState();
    assert.equal(reduced.reducedMotion, true);
    assert.ok(reduced.opacity <= 0.46, 'Reduced motion must cap opacity');
    assert.ok(reduced.speedScale < cruise.speedScale * 0.4, 'Reduced motion must reduce streak speed');

    pres.dispose();
  } finally {
    setup.dispose();
  }
});

test('T_U45_02_05_06: Proxy de galáxia procedural em trânsito, zero rebuild por frame e dispose limpo', () => {
  const setup = makeTransitSetup();
  try {
    const procGalaxyId = findReachableProceduralGalaxy(setup.catalog);
    const target = setup.catalog.target(`galaxy/${procGalaxyId}`)!;
    assert.ok(target);

    const parent = new Group();
    const camera = new PerspectiveCamera();
    const pres = new HypercruisePresentation(parent);
    const initialBuilds = pres.proxyBuildsCount;

    assert.equal(setup.controller.start(target, SAFE_DEPARTURE), 'started');

    // First frame builds the procedural destination proxy once
    setup.controller.update(0.05);
    pres.update(setup.controller.state, camera, 0.05);
    const buildsAfterFirstFrame = pres.proxyBuildsCount;
    assert.equal(buildsAfterFirstFrame, initialBuilds + 1, 'Procedural destination proxy must be built on first transit frame');

    const proxy = pres.getGalaxyProxy(procGalaxyId, DEFAULT_UNIVERSE_SEED);
    assert.ok(proxy, 'Procedural galaxy proxy must exist in presentation');
    assert.equal(proxy.visible, true);

    const initialScale = proxy.scale.x;

    // Advance 180 frames across transit: zero additional geometry builds and proxy grows on approach
    for (let i = 0; i < 180 && setup.controller.active; i++) {
      setup.controller.update(0.08);
      if (setup.controller.state) {
        pres.update(setup.controller.state, camera, 0.08);
      }
    }

    assert.equal(pres.proxyBuildsCount, buildsAfterFirstFrame, 'Zero per-frame geometry rebuilds during transit');
    assert.ok(proxy.scale.x > initialScale, 'Destination procedural galaxy proxy must grow in apparent scale during approach');

    pres.dispose();
    assert.equal(pres.getGalaxyProxy(procGalaxyId, DEFAULT_UNIVERSE_SEED), undefined, 'Dispose must clear cached proxies');
    assert.equal(parent.children.includes(pres.root), false, 'Dispose must detach presentation root');
  } finally {
    setup.dispose();
  }
});

test('T_U45_03_04: Zero Math.random() e coordenadas limitadas (< 50 km) em trânsito procedural', () => {
  const setup = makeTransitSetup();
  const originalRandom = Math.random;
  try {
    Math.random = () => {
      throw new Error('Math.random() é estritamente proibido em U4.5');
    };

    const procGalaxyId = findReachableProceduralGalaxy(setup.catalog);
    const target = setup.catalog.target(`galaxy/${procGalaxyId}`)!;
    const parent = new Group();
    const camera = new PerspectiveCamera();
    const pres = new HypercruisePresentation(parent);

    assert.equal(setup.controller.start(target, SAFE_DEPARTURE), 'started');
    for (let i = 0; i < 120 && setup.controller.active; i++) {
      setup.controller.update(0.05);
      pres.update(setup.controller.state, camera, 0.05);
      parent.traverse(node => {
        assert.ok(
          node.position.length() < 50000 &&
            Number.isFinite(node.position.x) &&
            Number.isFinite(node.position.y) &&
            Number.isFinite(node.position.z),
          `Node ${node.name} exceeded bounded render coordinates: ${node.position.length()}`,
        );
      });
    }

    const { canvas } = createMockCanvas(1000, 650);
    const cosmos = new CosmologyMapRenderer(canvas);
    const galaxyMap = new GalaxyMapRenderer(canvas);
    cosmos.draw(setup.universe.location);
    galaxyMap.draw(setup.universe.location);

    pres.dispose();
  } finally {
    Math.random = originalRandom;
    setup.dispose();
  }
});

test('T_U45_07_08_09: Mapa Cosmos atualiza cache em sub-cell pan, hit-test preciso, cursor zoom e estados visuais', () => {
  const { canvas, arcs, texts } = createMockCanvas(1000, 650);
  const cosmos = new CosmologyMapRenderer(canvas);
  const loc: UniverseLocation = {
    address: { galaxyId: 'milky_way', sector: sectorIndex(0n, 0n, 0n), systemId: 'sol', bodyId: 'earth' },
    frameId: 'solar-system/barycentric',
  };

  cosmos.draw(loc);
  const initialVisible = cosmos.getVisibleGalaxies();
  assert.ok(initialVisible.length > 0);

  // Pan by 1.2 Mpc (< 2.0 Mpc cell size so centerCell remains 0,0,0 while panOffsetMpc changes)
  cosmos.pan(-85, 0);
  assert.equal(cosmos.centerCell.x, 0n, 'Sub-cell pan keeps centerCell at 0n');
  assert.ok(Math.abs(cosmos.panOffsetMpc.x) > 0.8, 'panOffsetMpc reflects sub-cell shift');
  cosmos.draw(loc);
  const afterSubCellPan = cosmos.getVisibleGalaxies();
  assert.ok(afterSubCellPan.length > 0);

  // Hit-test canonical and procedural galaxies
  const mwHit = cosmos.hitTest(500 - (cosmos.panOffsetMpc.x / cosmos.zoomMpc) * 1000, 325);
  assert.equal(mwHit, 'galaxy/milky_way', 'Milky Way hit-test must track panned position accurately');

  // Select Andromeda and verify gold selection reticle (#facc15) and hover halo
  cosmos.selectedTargetKey = 'galaxy/andromeda';
  cosmos.hoveredTargetKey = 'galaxy/milky_way';
  arcs.length = 0;
  texts.length = 0;
  cosmos.draw(loc);

  assert.ok(arcs.some(a => a.strokeStyle === '#facc15'), 'Selected galaxy must render gold reticle (#facc15)');
  assert.ok(arcs.some(a => a.strokeStyle === '#ef4444'), 'Current galaxy must render red reticle (#ef4444)');
  assert.ok(arcs.some(a => a.strokeStyle === '#38bdf8'), 'Canonical galaxies must render cyan ring (#38bdf8)');

  // Cursor-relative zoom keeps coordinates finite and updates zoomMpc
  const beforeZoom = cosmos.zoomMpc;
  cosmos.changeZoom(-120, 750, 200);
  assert.ok(cosmos.zoomMpc < beforeZoom);
  assert.ok(Number.isFinite(cosmos.panOffsetMpc.x) && Number.isFinite(cosmos.panOffsetMpc.y));
});

test('T_U45_10: Painel de destino estruturado em 4 seções (IDENTIDADE, POSIÇÃO, EXPLORAÇÃO, NAVEGAÇÃO) sem NaN/undefined', () => {
  const catalog = new UniversalTargetCatalog();
  const universe = new UniverseRuntime({ epochS: 0 });
  try {
    const context: TargetResolutionContext = {
      activeSystem: universe.activeSystem,
      solarSystem: universe.solarSystem,
      address: universe.address,
      playerSystemPositionM: () => [0, 0, 0],
      location: universe.location,
    };
    const resolver = new UniversalTargetResolver(catalog, context);

    const procGalaxyId = findReachableProceduralGalaxy(catalog);
    const targets = [
      catalog.target('andromeda')!,
      catalog.target(`galaxy/${procGalaxyId}`)!,
      catalog.target('milky_way')!,
      catalog.target('observable-horizon')!,
    ];

    for (const t of targets) {
      const resolved = resolver.resolve(t);
      const html = renderUniversalTargetCardHtml(resolved, catalog.discovery, 'milky_way');
      assert.doesNotMatch(html, /NaN|undefined/);
      assert.match(html, /data-target-section="identidade"/);
      assert.match(html, /data-target-section="posicao"/);
      assert.match(html, /data-target-section="exploracao"/);
      assert.match(html, /data-target-section="navegacao"/);
      assert.match(html, /data-travel-shortcut-hint/);
    }

    // Reachable intergalactic galaxy displays [P] shortcut hint
    const andromedaHtml = renderUniversalTargetCardHtml(
      resolver.resolve(catalog.target('andromeda')!),
      catalog.discovery,
      'milky_way',
    );
    assert.match(andromedaHtml, /Atalho \[P\]/);
    assert.match(andromedaHtml, /Canônica/);

    // Procedural galaxy displays Procedural Sintética classification and [P] shortcut
    const procHtml = renderUniversalTargetCardHtml(
      resolver.resolve(catalog.target(`galaxy/${procGalaxyId}`)!),
      catalog.discovery,
      'milky_way',
    );
    assert.match(procHtml, /Procedural Sintética/);
    assert.match(procHtml, /Atalho \[P\]/);

    // Current galaxy explains why intergalactic travel to same galaxy is blocked
    const currentGuidance = describeNavigationGuidance('cosmological-future', 'galaxy', 'milky_way', 'milky_way');
    assert.equal(currentGuidance.available, false);
    assert.match(currentGuidance.status, /já está nesta galáxia/);
  } finally {
    universe.dispose();
  }
});

test('T_U45_11_12: Continuidade morfológica entre proxy e chegada + estabilidade de histerese LOD sem thrashing', () => {
  const setup = makeTransitSetup();
  try {
    const procGalaxyId = findReachableProceduralGalaxy(setup.catalog);
    const parent = new Group();
    const pres = new HypercruisePresentation(parent);
    const proxy = pres.ensureGalaxyProxy(procGalaxyId, DEFAULT_UNIVERSE_SEED);

    const def = galaxyDefinition(procGalaxyId, DEFAULT_UNIVERSE_SEED)!;
    assert.ok(def);
    const descriptor = resolveGalaxyDescriptor(def);
    const orient = def.orientationEuler ?? descriptor.orientationEulerRad;

    // Proxy orientation matches galaxy definition orientationEuler
    assert.ok(Math.abs(proxy.rotation.x - orient[0]) < 1e-6);
    assert.ok(Math.abs(proxy.rotation.y - orient[1]) < 1e-6);
    assert.ok(Math.abs(proxy.rotation.z - orient[2]) < 1e-6);

    // MorphologyRenderer hysteresis stability test around LOD 0/1 (16 px) and LOD 1/2 (280 px)
    const morphGroup = new Group();
    const morph = new GalaxyMorphologyRenderer(morphGroup, descriptor, {
      qualityPreset: 'Medium',
      maxParticles: 4000,
    });

    assert.equal(morph.currentLod, 0);
    morph.update(1e22, 16.5); // Crosses 0 -> 1
    assert.equal(morph.currentLod, 1);
    const transitionsAfterEnterLod1 = morph.lodTransitionCount;
    assert.equal(transitionsAfterEnterLod1, 1);

    // Oscillate inside hysteresis band [13.8 px .. 16.2 px]: must NOT thrash back to LOD 0
    for (const px of [15.8, 14.9, 14.1, 15.4, 13.9, 16.1]) {
      morph.update(1e22, px);
      assert.equal(morph.currentLod, 1, `Must remain in LOD 1 at ${px} px within hysteresis band`);
    }
    assert.equal(morph.lodTransitionCount, transitionsAfterEnterLod1, 'Zero LOD thrashing inside hysteresis band');

    // Approach LOD 2 and verify predictive preheat + smooth alpha exposure
    morph.update(5e21, 190);
    assert.equal(morph.isLod2Preheated, true);
    morph.update(1e21, 290);
    assert.equal(morph.currentLod, 2);
    const alphas = morph.getLodAlphas();
    assert.ok(alphas.lod2 >= 0.88 && alphas.lod2 <= 1.0);

    morph.dispose();
    pres.dispose();
  } finally {
    setup.dispose();
  }
});

test('T_U45_13_14: Isolamento multissemente de proxies e ciclo completo Sol <-> galáxia procedural com telemetria U4.5', () => {
  const seedA = 0x51a04401n;
  const seedB = 0x99b07702n;
  const setup = makeTransitSetup(seedA);
  try {
    const procId = findReachableProceduralGalaxy(setup.catalog);

    // Proxy cache keys isolate procedural seeds while unifying canonical galaxies
    assert.equal(proxyCacheKey('milky_way', seedA), 'milky_way');
    assert.equal(proxyCacheKey('andromeda', seedB), 'andromeda');
    assert.notEqual(proxyCacheKey(procId, seedA), proxyCacheKey(procId, seedB));

    const parent = new Group();
    const camera = new PerspectiveCamera();
    const pres = new HypercruisePresentation(parent);

    const target = setup.catalog.target(`galaxy/${procId}`)!;
    assert.equal(setup.controller.start(target, SAFE_DEPARTURE), 'started');

    // Step into cruise and verify enriched telemetry
    setup.controller.update(8);
    pres.update(setup.controller.state, camera, 0.1);
    const html = hypercruiseTelemetry(setup.controller.state!, target.displayName);
    assert.match(html, /TRANSIT/);
    assert.match(html, /progress/);
    assert.match(html, /DESTINO DA VIAGEM/);
    assert.match(html, /GALÁXIA DE DESTINO/);
    assert.match(html, /VELOCIDADE LOCAL/);
    assert.match(html, /0 m\/s · FRAME ANCORADO/);
    assert.ok(hypercruisePhaseLabel(setup.controller.state!.phase).length > 5);
    assert.ok(effectiveHypercruiseSpeed(setup.controller.state!.effectiveSpeedMps).length > 1);

    // Complete arrival into procedural galaxy
    for (let i = 0; i < 400 && setup.controller.active; i++) {
      setup.controller.update(0.2);
      pres.update(setup.controller.state, camera, 0.2);
    }
    assert.equal(setup.controller.active, false);
    assert.equal(setup.universe.activeGalaxy.id, procId);
    assert.equal(setup.universe.address.galaxyId, procId);
    assert.deepEqual(setup.universe.localVelocityMps, [0, 0, 0]);

    // Return to Milky Way / Sol
    const solTarget = setup.catalog.target('sol')!;
    assert.equal(setup.controller.start(solTarget, SAFE_DEPARTURE), 'started');
    for (let i = 0; i < 400 && setup.controller.active; i++) {
      setup.controller.update(0.2);
      pres.update(setup.controller.state, camera, 0.2);
    }
    assert.equal(setup.controller.active, false);
    assert.equal(setup.universe.activeGalaxy.id, 'milky_way');
    assert.equal(setup.universe.address.systemId, 'sol');

    // Cancellation in cruise -> emergency-deceleration -> coasting -> resume -> Andromeda arrival
    const andromedaTarget = setup.catalog.target('andromeda')!;
    assert.equal(setup.controller.start(andromedaTarget, SAFE_DEPARTURE), 'started');
    setup.controller.update(7);
    pres.update(setup.controller.state, camera, 0.1);
    setup.controller.cancel();
    for (let i = 0; i < 30 && setup.controller.state?.phase !== 'coasting'; i++) {
      setup.controller.update(0.1);
      pres.update(setup.controller.state, camera, 0.1);
    }
    assert.equal(setup.controller.state?.phase, 'coasting');
    const coastTelemetry = hypercruiseTelemetry(setup.controller.state!);
    assert.match(coastTelemetry, /PARADO EM TRÂNSITO/);

    assert.equal(setup.controller.start(andromedaTarget, SAFE_DEPARTURE), 'resumed');
    for (let i = 0; i < 400 && setup.controller.active; i++) {
      setup.controller.update(0.2);
      pres.update(setup.controller.state, camera, 0.2);
    }
    assert.equal(setup.controller.active, false);
    assert.equal(setup.universe.activeGalaxy.id, 'andromeda');
    pres.update(setup.controller.state, camera, 0.1);
    assert.equal(pres.root.visible, false, 'Presentation root must hide cleanly once transit completes');

    // Deterministic proxy descriptors across different seeds (seedA vs seedB vs seedA)
    const proxyA1 = pres.ensureGalaxyProxy(procId, seedA);
    const proxyB = pres.ensureGalaxyProxy(procId, seedB);
    assert.notEqual(proxyA1, proxyB, 'Different universe seeds must produce distinct procedural proxy instances');
    const descA = proxyA1.userData.descriptor;
    const descB = proxyB.userData.descriptor;
    assert.notEqual(descA.seed, descB.seed, 'Procedural galaxy descriptor seed must reflect universeSeed');

    pres.dispose();
  } finally {
    setup.dispose();
  }
});
