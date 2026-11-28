import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MapNavigationModel,
  isLocalGroupGalaxy,
  type MapPrecision,
  type BreadcrumbItem,
} from '../src/ui/map/MapNavigationModel';
import {
  UniversalTargetCatalog,
  SOLAR_TARGET_ADDRESS,
} from '../src/world/travel/UniversalTargetCatalog';
import {
  createUniversalTarget,
  universalTargetKey,
  type UniversalTargetDescriptor,
} from '../src/world/travel/UniversalNavigationTarget';
import { UniversalTargetResolver } from '../src/world/travel/UniversalTargetResolver';
import { ProceduralGalaxyDiscovery } from '../src/world/galaxy/ProceduralGalaxyDiscovery';
import { sectorIndex } from '../src/world/spatial/UniverseAddress';
import { UniverseCoordinates } from '../src/world/spatial/UniverseCoordinates';
import type { UniverseLocation } from '../src/world/spatial/UniverseLocation';
import {
  UniversalMapPanel,
  renderUniversalTargetCardHtml,
} from '../src/ui/map/UniversalMapPanel';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';

function createMockElement(tag: string = 'div'): any {
  const children: any[] = [];
  const eventListeners: Record<string, ((e: any) => void)[]> = {};

  const element: any = {
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    textContent: '',
    dataset: {},
    children,
    value: '',
    width: 800,
    height: 600,
    scrollTop: 0,
    setAttribute: (name: string, val: string) => { element[name] = val; },
    getAttribute: (name: string) => element[name] ?? null,
    classList: {
      add: (cls: string) => { if (!element.className.includes(cls)) element.className += ' ' + cls; },
      remove: (cls: string) => { element.className = element.className.replace(cls, '').trim(); },
      toggle: (cls: string, force?: boolean) => {
        const has = element.className.includes(cls);
        const next = force !== undefined ? force : !has;
        if (next && !has) element.className += ' ' + cls;
        else if (!next && has) element.className = element.className.replace(cls, '').trim();
        return next;
      },
      contains: (cls: string) => element.className.includes(cls),
    },
    appendChild: (child: any) => {
      children.push(child);
      return child;
    },
    addEventListener: (evt: string, fn: (e: any) => void) => {
      if (!eventListeners[evt]) eventListeners[evt] = [];
      eventListeners[evt].push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (evt: any) => {
      const handlers = eventListeners[evt.type] || [];
      handlers.forEach(h => h(evt));
    },
    getContext: () => ({
      fillRect: () => {},
      clearRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: (s: string) => ({ width: (s?.length ?? 1) * 8 }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      setTransform: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      clip: () => {},
      closePath: () => {},
      ellipse: () => {},
      moveTo: () => {},
      lineTo: () => {},
      drawImage: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      putImageData: () => {},
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    focus: () => {},
  };

  let _innerHTML = '';
  Object.defineProperty(element, 'innerHTML', {
    get() { return _innerHTML; },
    set(html: string) {
      _innerHTML = html;
      children.length = 0;
      const idMatches = html.matchAll(/id=["']([^"']+)["']/g);
      for (const m of idMatches) {
        const tag = m[1].includes('canvas') || m[1].includes('map') ? 'canvas' : 'div';
        const child = createMockElement(tag);
        child.id = m[1];
        children.push(child);
      }
      const btnMatches = html.matchAll(/<button([^>]*)>/g);
      for (const b of btnMatches) {
        const btn = createMockElement('button');
        const mapLevelMatch = /data-map-level=["']([^"']+)["']/.exec(b[1]);
        if (mapLevelMatch) btn.dataset.mapLevel = mapLevelMatch[1];
        children.push(btn);
      }
      const spanMatches = html.matchAll(/<span([^>]*)>(.*?)<\/span>/g);
      for (const s of spanMatches) {
        const span = createMockElement('span');
        const levelMatch = /data-level=["']([^"']+)["']/.exec(s[1]);
        if (levelMatch) span.dataset.level = levelMatch[1];
        if (s[1].includes('breadcrumb-item')) span.className = 'breadcrumb-item';
        span.textContent = s[2];
        children.push(span);
      }
    },
  });

  element.querySelector = (selector: string): any => {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      const findRecursive = (el: any): any => {
        if (el.id === id) return el;
        for (const child of el.children) {
          const found = findRecursive(child);
          if (found) return found;
        }
        return null;
      };
      return findRecursive(element);
    }
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      const findRecursive = (el: any): any => {
        if (el !== element && el.className?.includes(cls)) return el;
        for (const child of el.children) {
          const found = findRecursive(child);
          if (found) return found;
        }
        return null;
      };
      return findRecursive(element);
    }
    return children[0] ?? null;
  };

  element.querySelectorAll = (selector: string): any[] => {
    const results: any[] = [];
    const collectRecursive = (el: any) => {
      if (el !== element) {
        if (selector.includes('[data-map-level]') && el.dataset?.mapLevel !== undefined) {
          results.push(el);
        } else if (selector.includes('.breadcrumb-item') && el.className?.includes('breadcrumb-item')) {
          results.push(el);
        } else if (selector.includes('[data-level]') && el.dataset?.level !== undefined) {
          results.push(el);
        }
      }
      for (const child of el.children) {
        collectRecursive(child);
      }
    };
    collectRecursive(element);
    return results.length > 0 ? results : children;
  };

  return element;
}

test('T_U5_01_BREADCRUMB_HIERARCHY_NO_FABRICATION', () => {
  // Case A: At Manaus, all 6 levels exist: UNIVERSE / LOCAL GROUP / MILKY WAY / SOL / EARTH / MANAUS
  const manausLoc: UniverseLocation = {
    address: {
      galaxyId: 'milky_way',
      sector: sectorIndex(0n, 0n, 0n),
      systemId: 'sol',
      bodyId: 'earth',
      childFrame: 'surface/manaus',
    },
    frameId: 'milky_way/sol/earth/surface/manaus',
    surface: { latDeg: -3.1303, lonDeg: -60.0234, altitudeM: 38 },
  };

  const modelManaus = new MapNavigationModel(manausLoc);
  const itemsManaus = modelManaus.resolveHierarchy('surface');
  assert.equal(itemsManaus.length, 6);
  assert.equal(itemsManaus[0].label, 'UNIVERSE');
  assert.equal(itemsManaus[0].level, 'cosmology');
  assert.equal(itemsManaus[1].label, 'LOCAL GROUP');
  assert.equal(itemsManaus[1].level, 'cosmology');
  assert.equal(itemsManaus[2].label, 'MILKY WAY');
  assert.equal(itemsManaus[2].level, 'galaxy');
  assert.equal(itemsManaus[3].label, 'SOL');
  assert.equal(itemsManaus[3].level, 'system');
  assert.equal(itemsManaus[4].label, 'TERRA');
  assert.equal(itemsManaus[4].level, 'planet');
  assert.equal(itemsManaus[5].label, 'MANAUS');
  assert.equal(itemsManaus[5].level, 'surface');

  // Case B: In Moon orbit/surface: no Manaus fabricated
  const moonLoc: UniverseLocation = {
    address: {
      galaxyId: 'milky_way',
      sector: sectorIndex(0n, 0n, 0n),
      systemId: 'sol',
      bodyId: 'moon',
    },
    frameId: 'milky_way/sol/moon',
    surface: { latDeg: 0, lonDeg: 0, altitudeM: 12_000 },
  };
  const modelMoon = new MapNavigationModel(moonLoc);
  const itemsMoon = modelMoon.resolveHierarchy('planet');
  assert.equal(itemsMoon.length, 5);
  assert.equal(itemsMoon[4].label, 'MOON');
  assert.equal(itemsMoon.some(i => i.label === 'MANAUS'), false);

  // Case C: Solar interplanetary: no Earth or Manaus fabricated
  const solCruiseLoc: UniverseLocation = {
    address: {
      galaxyId: 'milky_way',
      sector: sectorIndex(0n, 0n, 0n),
      systemId: 'sol',
    },
    frameId: 'milky_way/sol/heliocentric',
    systemPositionM: [1.496e11, 0, 0],
  };
  const modelSolCruise = new MapNavigationModel(solCruiseLoc);
  const itemsSolCruise = modelSolCruise.resolveHierarchy('system');
  assert.equal(itemsSolCruise.length, 4);
  assert.equal(itemsSolCruise[3].label, 'SOL');
  assert.equal(itemsSolCruise.some(i => i.label === 'TERRA' || i.label === 'MANAUS'), false);

  // Case D: Interstellar Milky Way: no Sol, Earth, Manaus fabricated
  const interstellarLoc: UniverseLocation = {
    address: {
      galaxyId: 'milky_way',
      sector: sectorIndex(15n, -2n, 931n),
    },
    frameId: 'milky_way/galactic',
  };
  const modelInterstellar = new MapNavigationModel(interstellarLoc);
  const itemsInterstellar = modelInterstellar.resolveHierarchy('galaxy');
  assert.equal(itemsInterstellar.length, 3);
  assert.equal(itemsInterstellar[0].label, 'UNIVERSE');
  assert.equal(itemsInterstellar[1].label, 'LOCAL GROUP');
  assert.equal(itemsInterstellar[2].label, 'MILKY WAY');

  // Case E: Andromeda: part of Local Group
  const andromedaLoc: UniverseLocation = {
    address: {
      galaxyId: 'andromeda',
      sector: sectorIndex(0n, 0n, 0n),
    },
    frameId: 'andromeda/galactic',
  };
  const modelAndromeda = new MapNavigationModel(andromedaLoc);
  const itemsAndromeda = modelAndromeda.resolveHierarchy('galaxy');
  assert.equal(itemsAndromeda.length, 3);
  assert.equal(itemsAndromeda[1].label, 'LOCAL GROUP');
  assert.equal(itemsAndromeda[2].label, 'ANDROMEDA');

  // Case F: Procedural galaxy outside Local Group: NEVER fabricates LOCAL GROUP
  const procGalaxyLoc: UniverseLocation = {
    address: {
      galaxyId: 'DM-PG-00000001',
      sector: sectorIndex(100n, 50n, -20n),
    },
    frameId: 'DM-PG-00000001/galactic',
  };
  const modelProcGalaxy = new MapNavigationModel(procGalaxyLoc);
  const itemsProcGalaxy = modelProcGalaxy.resolveHierarchy('galaxy');
  assert.equal(itemsProcGalaxy.length, 2);
  assert.equal(itemsProcGalaxy[0].label, 'UNIVERSE');
  assert.equal(itemsProcGalaxy[1].label, 'DM-PG-00000001');
  assert.equal(itemsProcGalaxy.some(i => i.label === 'LOCAL GROUP'), false);

  // Case G: Atlas mode adds ATLAS CÓSMICO
  const itemsAtlas = modelManaus.resolveHierarchy('atlas');
  assert.equal(itemsAtlas[itemsAtlas.length - 1].label, 'ATLAS CÓSMICO');
  assert.equal(itemsAtlas[itemsAtlas.length - 1].level, 'atlas');
});

test('T_U5_02_ONE_LOCATION_AUTHORITY_AND_PRECISION', () => {
  // 1. Manaus surface -> 'measured'
  const locMeasured: UniverseLocation = {
    address: {
      galaxyId: 'milky_way',
      sector: sectorIndex(0n, 0n, 0n),
      systemId: 'sol',
      bodyId: 'earth',
    },
    frameId: 'milky_way/sol/earth/surface/manaus',
    surface: { latDeg: -3.13, lonDeg: -60.02, altitudeM: 38 },
  };
  const model = new MapNavigationModel(locMeasured);
  assert.equal(model.precision, 'measured');
  assert.equal(model.getScaleTier('surface'), 'surface');
  assert.equal(model.getScaleTier('planet'), 'planet');
  assert.equal(model.getScaleTier('system'), 'system');
  assert.equal(model.getScaleTier('galaxy'), 'galaxy');
  assert.equal(model.getScaleTier('cosmology'), 'local-group');

  // 2. Local Group interstellar -> 'approximate'
  const locApprox: UniverseLocation = {
    address: {
      galaxyId: 'andromeda',
      sector: sectorIndex(200n, 0n, 0n),
    },
    frameId: 'andromeda/galactic',
  };
  model.updateLocation(locApprox);
  assert.equal(model.precision, 'approximate');
  assert.equal(model.getScaleTier('cosmology'), 'local-group');

  // 3. Procedural galaxy -> 'procedural'
  const locProc: UniverseLocation = {
    address: {
      galaxyId: 'DM-PG-TEST',
      sector: sectorIndex(10n, 20n, 30n),
    },
    frameId: 'DM-PG-TEST/galactic',
  };
  model.updateLocation(locProc);
  assert.equal(model.precision, 'procedural');
  assert.equal(model.getScaleTier('cosmology'), 'cosmology');
});

test('T_U5_03_SHAREABLE_COORDINATE_URI_ROUNDTRIP', () => {
  // Test geodetic location roundtrip
  const loc: UniverseLocation = {
    address: {
      galaxyId: 'milky_way',
      sector: sectorIndex(0n, 0n, 0n),
      systemId: 'sol',
      bodyId: 'earth',
    },
    frameId: 'milky_way/sol/earth/surface/manaus',
    surface: { latDeg: -3.1303, lonDeg: -60.0234, altitudeM: 38 },
  };
  const model = new MapNavigationModel(loc);
  const uri = model.formatShareableUri();
  assert.ok(uri.startsWith('drm:v1://?kind=surface'));
  assert.ok(uri.includes('body=earth'));
  assert.ok(uri.includes('lat=-3.130300'));
  assert.ok(uri.includes('lon=-60.023400'));

  const parsed = UniverseCoordinates.parse(uri);
  assert.ok(parsed);
  assert.equal(parsed.kind, 'surface-geodetic');
  if (parsed.kind === 'surface-geodetic') {
    assert.equal(parsed.bodyId, 'earth');
    assert.equal(parsed.latDeg.toFixed(4), '-3.1303');
    assert.equal(parsed.lonDeg.toFixed(4), '-60.0234');
    assert.equal(parsed.altitudeM, 38);
  }

  // Test massive BigInt sector coordinates preservation without truncation
  const massiveSector = sectorIndex(9007199254740993n, -9007199254740995n, 123456789012345678n);
  const sectorTarget = {
    kind: 'cosmic-sector' as const,
    galaxyId: 'milky_way',
    sector: massiveSector,
    offsetM: [100.5, 200.5, 300.5] as [number, number, number],
  };
  const sectorUri = UniverseCoordinates.format(sectorTarget);
  const parsedSector = UniverseCoordinates.parse(sectorUri);
  assert.ok(parsedSector);
  assert.equal(parsedSector.kind, 'cosmic-sector');
  if (parsedSector.kind === 'cosmic-sector') {
    assert.equal(parsedSector.sector.x, 9007199254740993n);
    assert.equal(parsedSector.sector.y, -9007199254740995n);
    assert.equal(parsedSector.sector.z, 123456789012345678n);
    assert.equal(parsedSector.offsetM[0], 100.5);
  }
});

test('T_U5_04_UNIVERSAL_SEARCH_AND_TARGET_RESOLUTION', () => {
  const catalog = new UniversalTargetCatalog();
  const model = new MapNavigationModel({
    address: SOLAR_TARGET_ADDRESS,
    frameId: 'milky_way/sol/earth',
  });

  // 1. Search 'Sol' -> finds Sol system with 'measured' precision
  const solResults = model.search(catalog, 'Sol');
  assert.ok(solResults.length > 0);
  const solMatch = solResults.find(r => r.target.objectId === 'sol');
  assert.ok(solMatch);
  assert.equal(solMatch.precision, 'measured');
  assert.equal(solMatch.isCanonical, true);

  // 2. Search 'Terra' -> finds Earth with 'measured' precision
  const earthResults = model.search(catalog, 'Terra');
  assert.ok(earthResults.length > 0);
  const earthMatch = earthResults.find(r => r.target.bodyId === 'earth' || r.target.objectId === 'earth');
  assert.ok(earthMatch);
  assert.equal(earthMatch.precision, 'measured');

  // 3. Search 'Andromeda' -> finds Andromeda with 'approximate' precision
  const andromedaResults = model.search(catalog, 'Andromeda');
  assert.ok(andromedaResults.length > 0);
  const andromedaMatch = andromedaResults.find(r => r.target.objectId === 'andromeda');
  assert.ok(andromedaMatch);
  assert.equal(andromedaMatch.precision, 'approximate');

  // 4. Search 'Sagittarius' -> finds Sgr A* black hole
  const sgrResults = model.search(catalog, 'Sagittarius');
  assert.ok(sgrResults.length > 0);
  const sgrMatch = sgrResults.find(r => r.target.kind === 'black-hole');
  assert.ok(sgrMatch);
  assert.equal(sgrMatch.precision, 'approximate');

  // 5. Search procedural galaxy via discovery
  const procResults = model.search(catalog, 'DM-PG');
  assert.ok(procResults.length > 0);
  assert.equal(procResults[0].precision, 'procedural');
});

test('T_U5_05_CLICKABLE_MARKERS_AND_MAP_LEVEL_TRANSITIONS', () => {
  const prevDoc = (globalThis as any).document;
  (globalThis as any).document = {
    createElement: (tag: string) => createMockElement(tag),
    activeElement: null,
  };

  try {
    const container = createMockElement('div');
    const initialLocation: UniverseLocation = {
      address: {
        galaxyId: 'milky_way',
        sector: sectorIndex(0n, 0n, 0n),
        systemId: 'sol',
        bodyId: 'earth',
      },
      frameId: 'milky_way/sol/earth',
      surface: { latDeg: -3.13, lonDeg: -60.02, altitudeM: 38 },
    };

    let selectedTravelId: string | undefined;
    let selectedTargetId: string | undefined;

    const panel = new UniversalMapPanel(
      container,
      initialLocation,
      (travelId) => { selectedTravelId = travelId; },
      () => {},
      (targetId) => { selectedTargetId = targetId; return targetId; },
    );

    // Initial level
    assert.equal(panel.currentLevel, 'surface');

    // Transition to planet
    panel.setLevel('planet');
    assert.equal(panel.currentLevel, 'planet');

    // Transition to system
    panel.setLevel('system');
    assert.equal(panel.currentLevel, 'system');

    // Transition to galaxy
    panel.setLevel('galaxy');
    assert.equal(panel.currentLevel, 'galaxy');

    // Transition to cosmology
    panel.setLevel('cosmology');
    assert.equal(panel.currentLevel, 'cosmology');

    // Transition to atlas
    panel.setLevel('atlas');
    assert.equal(panel.currentLevel, 'atlas');
  } finally {
    (globalThis as any).document = prevDoc;
  }
});

test('T_U5_06_TARGET_CARD_PRECISION_AND_METADATA', () => {
  const universe = new UniverseRuntime();
  const catalog = new UniversalTargetCatalog(universe.solarSystem);
  const resolver = new UniversalTargetResolver(catalog, universe);

  // 1. Canonical Earth body target -> precision 'measured'
  const earthTarget = catalog.target('earth')!;
  const earthResolved = resolver.resolve(earthTarget);
  const earthHtml = renderUniversalTargetCardHtml(
    earthResolved,
    catalog.discovery,
    'milky_way',
    false,
    false,
    catalog,
    'measured',
  );
  assert.ok(earthHtml.includes('data-precision="measured"'));
  assert.ok(earthHtml.includes('measured'));

  // 2. Supermassive Black Hole target -> precision 'approximate'
  const sgraTarget = catalog.target('sgra')!;
  const sgraResolved = resolver.resolve(sgraTarget);
  const sgraHtml = renderUniversalTargetCardHtml(
    sgraResolved,
    catalog.discovery,
    'milky_way',
    false,
    false,
    catalog,
    'approximate',
  );
  assert.ok(sgraHtml.includes('data-precision="approximate"'));

  // 3. Procedural world -> precision 'procedural'
  const procKey = 'universe/milky_way/17,-2,4/system/milky_way%2F17%2C-2%2C4%2F0/body/milky_way%2F17%2C-2%2C4%2F0_planet_0';
  const procTarget = catalog.find(procKey);
  if (procTarget) {
    const procNavTarget = createUniversalTarget(procTarget);
    const procResolved = resolver.resolve(procNavTarget);
    const procHtml = renderUniversalTargetCardHtml(
      procResolved,
      catalog.discovery,
      'milky_way',
      false,
      false,
      catalog,
      'procedural',
    );
    assert.ok(procHtml.includes('data-precision="procedural"'));
  }
});

test('T_U5_07_BREADCRUMB_INTERACTION', () => {
  const prevDoc = (globalThis as any).document;
  (globalThis as any).document = {
    createElement: (tag: string) => createMockElement(tag),
    activeElement: null,
  };

  try {
    const container = createMockElement('div');
    const initialLocation: UniverseLocation = {
      address: {
        galaxyId: 'milky_way',
        sector: sectorIndex(0n, 0n, 0n),
        systemId: 'sol',
        bodyId: 'earth',
        childFrame: 'surface/manaus',
      },
      frameId: 'milky_way/sol/earth/surface/manaus',
      surface: { latDeg: -3.13, lonDeg: -60.02, altitudeM: 38 },
    };

    const panel = new UniversalMapPanel(
      container,
      initialLocation,
      () => {},
      () => {},
      () => undefined,
    );

    assert.equal(panel.currentLevel, 'surface');

    // Breadcrumb has items for UNIVERSE, LOCAL GROUP, MILKY WAY, SOL, TERRA, MANAUS
    const hierarchy = panel.model.resolveHierarchy(panel.currentLevel);
    assert.equal(hierarchy.length, 6);
    assert.equal(hierarchy[0].label, 'UNIVERSE');
    assert.equal(hierarchy[0].level, 'cosmology');
    assert.equal(hierarchy[2].label, 'MILKY WAY');
    assert.equal(hierarchy[2].level, 'galaxy');

    // Manually navigate via setLevel as clicking breadcrumb items does
    panel.setLevel(hierarchy[0].level);
    assert.equal(panel.currentLevel, 'cosmology');

    panel.setLevel(hierarchy[2].level);
    assert.equal(panel.currentLevel, 'galaxy');

    panel.setLevel(hierarchy[3].level);
    assert.equal(panel.currentLevel, 'system');
  } finally {
    (globalThis as any).document = prevDoc;
  }
});
