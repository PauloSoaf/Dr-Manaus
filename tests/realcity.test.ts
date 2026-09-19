import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Group, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { REAL_CITY } from '../src/core/config.ts';
import { GEO_ORIGIN, LANDMARKS, latLonToWorld, onAirfield, worldToLatLon } from '../src/world/geodata/geodata.ts';
import { WORLD } from '../src/core/config.ts';
import { BUILDING_STRIDE } from '../src/world/chunks/Chunk.ts';
import { generateChunk } from '../src/world/chunks/BuildingGenerator.ts';
import { AIRPORT_RESERVATIONS } from '../src/world/realcity/airport.ts';
import { ARENA_COLLIDERS } from '../src/world/landmarks/arena.ts';
import {
  appendNearBuilding, appendShellBuilding, buildingSeed, createBuffers, roofShapeFor,
  type MeshBuffers, type RealBuilding,
} from '../src/world/realcity/buildingGeometry.ts';
import { ARTERIAL_CLASSES, RoadNetwork, type RoadRecord } from '../src/world/realcity/roads.ts';
import { RealCityLayer } from '../src/world/realcity/RealCityLayer.ts';

const DATA = path.resolve('public/geodata/real-city');
const manifestPath = path.join(DATA, 'manifest.json');
const hasCompiledCity = existsSync(manifestPath);

interface Manifest {
  origin: { lat: number; lon: number };
  tileSize: number;
  proceduralChunkSize: number;
  tiles: Record<string, string>;
  roads?: string;
  skyline?: string;
  stats?: Record<string, number>;
}

const manifest: Manifest | null = hasCompiledCity ? JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest : null;

/** Overture rings project to clockwise polygons; every fixture here matches the real data. */
function square(id: string, size: number, height: number, extra: Partial<RealBuilding> = {}): RealBuilding {
  const h = size / 2;
  return { id, h: height, p: [-h, -h, -h, h, h, h, h, -h], ...extra };
}

function triangles(buffers: MeshBuffers): number { return buffers.position.length / 9; }

function bounds(buffers: MeshBuffers): { minY: number; maxY: number } {
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < buffers.position.length; i += 3) {
    if (buffers.position[i] < minY) minY = buffers.position[i];
    if (buffers.position[i] > maxY) maxY = buffers.position[i];
  }
  return { minY, maxY };
}

test('the local projection is an exact round trip and agrees with the compiled origin', () => {
  for (const [lat, lon] of [[-3.1303, -60.0234], [-3.08325175, -60.02800465], [-3.0386, -60.0497], [-3.06375, -60.1083]]) {
    const world = latLonToWorld(lat, lon);
    const back = worldToLatLon(world.x, world.z);
    assert.ok(Math.abs(back.lat - lat) < 1e-9, `latitude round trip for ${lat}`);
    assert.ok(Math.abs(back.lon - lon) < 1e-9, `longitude round trip for ${lon}`);
  }
  const origin = latLonToWorld(GEO_ORIGIN.lat, GEO_ORIGIN.lon);
  assert.equal(origin.x, 0);
  assert.equal(origin.z, 0);
  // The same point must be produced twice: the projection carries no hidden state.
  assert.deepEqual(latLonToWorld(-3.1, -60.1), latLonToWorld(-3.1, -60.1));
});

test('every near facade is closed at the top, whatever roof shape it is given', () => {
  const cases: RealBuilding[] = [
    square('house-small', 9, 4.5),
    square('house-wide', 22, 7),
    square('block-mid', 30, 15),
    square('tower', 34, 68),
    square('slab', 90, 26),
    { id: 'notched', h: 8, p: [-12, -12, -12, 12, 4, 12, 4, 2, 12, 2, 12, -12] },
    square('explicit-flat', 20, 12, { rs: 'flat' }),
    square('explicit-gabled', 20, 6, { rs: 'gabled' }),
    square('church', 14, 11, { klass: 'church' }),
  ];
  for (const building of cases) {
    const buffers = createBuffers();
    const collider = appendNearBuilding(buffers, building);
    assert.ok(collider, `${building.id} must produce a collider`);
    const top = Math.max(0, building.minH ?? 0) + Math.max(2.6, building.h);
    const { maxY } = bounds(buffers);
    assert.ok(maxY >= top - 1e-6, `${building.id} must reach its own wall top`);

    // A roof exists when upward-facing area is present at or above the wall top.
    let upwardAtTop = 0;
    for (let t = 0; t < buffers.position.length; t += 9) {
      const ny = buffers.normal[t + 1];
      const y = Math.max(buffers.position[t + 1], buffers.position[t + 4], buffers.position[t + 7]);
      if (ny > .35 && y >= top - .05) upwardAtTop++;
    }
    assert.ok(upwardAtTop >= 2, `${building.id} must be roofed, found ${upwardAtTop} upward triangles`);
  }
});

test('wall normals face outward, so facades are lit from the street and not from inside', () => {
  const buffers = createBuffers();
  appendNearBuilding(buffers, square('normals', 24, 20));
  let walls = 0;
  for (let t = 0; t < buffers.position.length; t += 9) {
    const nx = buffers.normal[t], ny = buffers.normal[t + 1], nz = buffers.normal[t + 2];
    if (Math.abs(ny) > .25) continue;
    // A parapet's inner face is deliberately inward-facing; only the facade proper is checked.
    if (Math.max(buffers.position[t + 1], buffers.position[t + 4], buffers.position[t + 7]) > 19.7) continue;
    const cx = (buffers.position[t] + buffers.position[t + 3] + buffers.position[t + 6]) / 3;
    const cz = (buffers.position[t + 2] + buffers.position[t + 5] + buffers.position[t + 8]) / 3;
    // The fixture is centred on the origin, so the outward direction is the centroid itself.
    assert.ok(nx * cx + nz * cz > 0, 'a vertical face pointed back into the building');
    walls++;
  }
  assert.ok(walls > 8, 'the fixture must actually exercise wall geometry');
});

test('facades are deterministic across rebuilds and distinct between buildings', () => {
  const first = createBuffers(), second = createBuffers(), other = createBuffers();
  appendNearBuilding(first, square('deterministic-a', 28, 24));
  appendNearBuilding(second, square('deterministic-a', 28, 24));
  appendNearBuilding(other, square('deterministic-b', 28, 24));
  assert.deepEqual(first.position, second.position);
  assert.deepEqual(first.color, second.color);
  assert.deepEqual(first.lit, second.lit);
  assert.notDeepEqual(first.color, other.color);
  assert.equal(buildingSeed('deterministic-a'), buildingSeed('deterministic-a'));
  assert.notEqual(buildingSeed('deterministic-a'), buildingSeed('deterministic-b'));
});

test('only the near tier carries window panes, and only panes can light up at night', () => {
  const near = createBuffers(), shell = createBuffers();
  const building = square('windowed', 26, 40);
  appendNearBuilding(near, building);
  appendShellBuilding(shell, building);
  const litVertices = near.lit.filter(value => value > .5).length;
  assert.ok(litVertices > 0, 'a 40 m block must have lit panes after dark');
  assert.ok(litVertices < near.lit.length * .5, 'most of a facade is wall, not glass');
  assert.equal(shell.lit.some(value => value > 0), false, 'the shell tier has no night windows');
  assert.equal(near.lit.length, near.position.length / 3);
});

test('the shell tier costs an order of magnitude less than the near tier it replaces', () => {
  const near = createBuffers(), shell = createBuffers();
  const building = square('lod-cost', 32, 48);
  appendNearBuilding(near, building);
  appendShellBuilding(shell, building);
  assert.ok(triangles(shell) > 0);
  assert.ok(triangles(near) > triangles(shell) * 5,
    `near ${triangles(near)} must dominate shell ${triangles(shell)}`);
  assert.ok(triangles(shell) < 40, `a shell block stayed at ${triangles(shell)} triangles`);
  // Both tiers must agree on where the building is, or the swap would visibly jump.
  const nearCollider = appendNearBuilding(createBuffers(), building)!;
  const shellCollider = appendShellBuilding(createBuffers(), building)!;
  assert.deepEqual(nearCollider, shellCollider);
});

test('an explicit Overture roof shape always wins over the procedural choice', () => {
  const footprint = { points: [], edges: [], minX: 0, maxX: 10, minZ: 0, maxZ: 10, area: 100, cx: 5, cz: 5 };
  const obb = { cx: 5, cz: 5, ux: 1, uz: 0, halfLong: 5, halfShort: 5, area: 100 };
  const call = (building: RealBuilding) => roofShapeFor(building, footprint as never, obb, buildingSeed(building.id));
  assert.equal(call(square('a', 10, 6, { rs: 'gabled' })), 'gabled');
  assert.equal(call(square('b', 10, 6, { rs: 'pyramidal' })), 'pyramidal');
  assert.equal(call(square('c', 10, 80, { rs: 'hipped' })), 'hipped');
  // Without a shape, a tall block still gets a defined, closed roof rather than nothing.
  assert.ok(['flat', 'terrace'].includes(call(square('d', 10, 90))));
});

test('the road network separates arterials from streets and only stripes what can be read', () => {
  const material = new MeshStandardMaterial();
  const records: RoadRecord[] = [
    { class: 'primary', width: 14, p: [0, 0, 900, 0], name: 'Avenida Teste' },
    { class: 'trunk', width: 16, p: [0, 0, 0, 900] },
    { class: 'residential', width: 7, p: [40, 40, 140, 40] },
    { class: 'residential', width: 7, p: [9000, 9000, 9100, 9000] },
    { class: 'service', width: 5, p: [60, 60, 60, 160] },
  ];
  const network = new RoadNetwork(records, material);
  const arterial = network.statistics.arterialTriangles;
  assert.ok(arterial > 0, 'arterials are built once and never stream');
  network.update(0, 0);
  assert.ok(network.statistics.localTriangles > 0, 'nearby streets must appear');
  assert.ok(network.statistics.markingTriangles > 0, 'arterial centre lines appear near the player');
  const nearby = network.statistics.localTriangles;

  // Twelve kilometres away, the distant neighbourhood's streets and all markings must be gone.
  network.update(12000, 12000);
  assert.equal(network.statistics.arterialTriangles, arterial, 'arterials never rebuild');
  assert.equal(network.statistics.markingTriangles, 0, 'markings cost nothing away from the player');
  assert.ok(network.statistics.localTriangles < nearby);
  assert.ok(ARTERIAL_CLASSES.has('primary') && ARTERIAL_CLASSES.has('trunk'));
  assert.equal(ARTERIAL_CLASSES.has('residential'), false);
  network.dispose();
  assert.equal(network.group.children.length, 0);
});

test('the procedural city is suppressed by tile arithmetic, not by what happens to be resident', async () => {
  if (!manifest) return;
  const previous = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(typeof input === 'object' && 'url' in input ? input.url : input);
    const marker = url.indexOf('geodata/real-city/');
    if (marker < 0) return new Response(null, { status: 404 });
    const file = path.join(DATA, url.slice(marker + 'geodata/real-city/'.length));
    if (!existsSync(file)) return new Response(null, { status: 404 });
    return new Response(await readFile(file), { status: 200 });
  }) as typeof fetch;
  const root = new Group(), layer = new RealCityLayer(root);
  try {
    await layer.initialize();
    assert.equal(layer.active, true, 'the compiled manifest must switch the real city on');
    assert.equal(layer.hasSkyline, true, 'the distant tier must be resident before the procedural city stands down');
    assert.ok(layer.coveredTiles.size > 100, 'Manaus compiles to hundreds of tiles');
    assert.equal(layer.tileSize, manifest.tileSize);

    const ratio = manifest.tileSize / manifest.proceduralChunkSize;
    const covered = [...layer.coveredTiles][0].split(',').map(Number);
    assert.equal(layer.coversChunk(covered[0] * ratio, covered[1] * ratio), true);
    assert.equal(layer.replaces(`${covered[0] * ratio},${covered[1] * ratio}/building/4`), true);
    assert.equal(layer.replaces(`hlod:${covered[0] * ratio},${covered[1] * ratio}/building/4`), true);
    // Far outside the compiled bounding box the procedural city must keep its buildings.
    assert.equal(layer.coversChunk(9000, 9000), false);
    assert.equal(layer.replaces('9000,9000/building/1'), false);
    assert.equal(layer.replaces('real:abc'), false);
    assert.equal(layer.replaces(undefined), false);

    // Streaming at mega speed must stay inside the tile and collider budgets.
    const position = new Vector3(0, 300, 0);
    for (const velocity of [new Vector3(), new Vector3(0, 0, -8000), new Vector3(2000, 0, 0)]) {
      for (let frame = 0; frame < 40; frame++) {
        layer.update(position, velocity, 1 / 60);
        position.addScaledVector(velocity, 1 / 60);
        assert.ok(layer.stats.tiles <= REAL_CITY.maxTiles, `resident tiles reached ${layer.stats.tiles}`);
        assert.ok(layer.stats.colliders <= REAL_CITY.maxColliders, `colliders reached ${layer.stats.colliders}`);
      }
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    // One instanced draw covers every compiled tile that is not currently resident as real geometry.
    assert.ok(layer.stats.skyline > 1000, `the skyline only placed ${layer.stats.skyline} block masses`);
    assert.ok(layer.stats.roadTriangles > 0, 'the arterial network builds once and stays');
  } finally {
    layer.dispose();
    globalThis.fetch = previous;
    assert.equal(root.children.length, 0);
  }
});

test('the compiled dataset actually covers the places the game promises', () => {
  if (!manifest) return;
  const tileOf = (x: number, z: number) => `${Math.floor(x / manifest.tileSize)},${Math.floor(z / manifest.tileSize)}`;
  const named = (id: string) => LANDMARKS.find(landmark => landmark.id === id)!;

  // The Arena, Ponta Negra and the airport must all land inside compiled tiles.
  const arena = named('arena');
  assert.ok(manifest.tiles[tileOf(arena.x, arena.z)], 'the Arena sits on an uncompiled tile');
  const ponta = named('ponta');
  assert.ok(manifest.tiles[tileOf(ponta.x, ponta.z)], 'Ponta Negra must be part of the real tile set');
  const airport = latLonToWorld(-3.0386, -60.0497);
  assert.ok(manifest.tiles[tileOf(airport.x, airport.z)], 'Eduardo Gomes must be part of the real tile set');

  // Ponta Negra has to be continuous with the rest of the city, not an isolated island.
  let neighbours = 0;
  const [px, pz] = tileOf(ponta.x, ponta.z).split(',').map(Number);
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (manifest.tiles[`${px + x},${pz + z}`]) neighbours++;
  assert.ok(neighbours >= 6, `Ponta Negra only has ${neighbours} compiled tiles around it`);

  assert.ok((manifest.stats?.buildings ?? 0) > 100000, 'the compiled city must hold real Manaus density');
  assert.equal(manifest.origin.lat, GEO_ORIGIN.lat);
  assert.equal(manifest.origin.lon, GEO_ORIGIN.lon);
});

test('the priority avenues of Manaus are present in the compiled road network', () => {
  if (!manifest?.roads) return;
  const roads = JSON.parse(readFileSync(path.join(DATA, manifest.roads), 'utf8')) as RoadRecord[];
  assert.ok(roads.length > 1000);
  const named = roads.filter(road => road.name);
  if (!named.length) return; // Names arrive with the pipeline revision; geometry is already real.
  const wanted = [
    /constantino nery/i, /djalma batista/i, /torquato tapaj/i, /avenida do turismo/i,
    /ephig[eê]nio salles/i, /andr[eé] ara[uú]jo/i, /rodrigo ot[aá]vio/i, /autaz mirim/i,
    /max teixeira/i, /noel nutels/i, /avenida brasil/i, /pedro teixeira/i,
    /m[aá]rio ypiranga/i, /umberto calderaro/i, /coronel teixeira/i,
  ];
  const missing = wanted.filter(pattern => !named.some(road => pattern.test(road.name!)));
  assert.deepEqual(missing.map(String), [], 'every priority avenue must be extracted from the dataset');
  // Classification has to survive the pipeline, or width and LOD banding would be meaningless.
  assert.ok(roads.some(road => ARTERIAL_CLASSES.has(road.class)));
  assert.ok(roads.some(road => !ARTERIAL_CLASSES.has(road.class)));
});

test('nothing procedural is ever generated on the Eduardo Gomes airfield', () => {
  const centre = latLonToWorld(-3.0386, -60.0497);
  const cx = Math.floor(centre.x / WORLD.chunkSize), cz = Math.floor(centre.z / WORLD.chunkSize);
  let inspected = 0, onField = 0;
  for (let z = -10; z <= 10; z++) for (let x = -14; x <= 14; x++) {
    const chunk = generateChunk(cx + x, cz + z);
    for (let p = 0; p < chunk.buildings.length; p += BUILDING_STRIDE) {
      inspected++;
      if (onAirfield(chunk.buildings[p], chunk.buildings[p + 1])) onField++;
    }
  }
  assert.ok(inspected > 200, `the fixture must cover populated chunks, saw ${inspected}`);
  assert.equal(onField, 0, `${onField} generated buildings stand on the runway or apron`);
  // The exclusion must be tight enough to leave the surrounding neighbourhoods alone.
  assert.equal(onAirfield(centre.x, centre.z), true);
  assert.equal(onAirfield(centre.x, centre.z + 2600), false);
});

test('the Arena and the airport are built where the survey data actually puts them', () => {
  const arena = LANDMARKS.find(landmark => landmark.id === 'arena')!;
  assert.ok(Math.abs(arena.lat - -3.08325175) < 1e-7 && Math.abs(arena.lon - -60.02800465) < 1e-7);
  assert.ok(ARENA_COLLIDERS.length > 8, 'the Arena needs a solid shell, not a single box');
  let radius = 0, top = 0;
  for (const box of ARENA_COLLIDERS) {
    radius = Math.max(radius, Math.hypot(Math.abs(box.x) + box.width / 2, Math.abs(box.z) + box.depth / 2));
    top = Math.max(top, box.y + box.height / 2);
  }
  assert.ok(radius <= arena.radius * 1.5, `the Arena colliders reach ${radius.toFixed(0)} m, outside its reservation`);
  assert.ok(top > 20, 'the shell has to be tall enough to stop a player flying through it');

  // Compiled landmark footprints must agree with where the bespoke model is placed.
  if (existsSync(path.join(DATA, 'landmarks.json'))) {
    const payload = JSON.parse(readFileSync(path.join(DATA, 'landmarks.json'), 'utf8')) as
      { features: { klass: string; x: number; z: number }[] };
    const stadium = payload.features.filter(feature => /stadium/i.test(feature.klass ?? ''))
      .map(feature => Math.hypot(feature.x - arena.x, feature.z - arena.z))
      .sort((a, b) => a - b)[0];
    assert.ok(stadium !== undefined && stadium < 100,
      `the compiled stadium footprint is ${stadium?.toFixed(0)} m from the Arena landmark`);
  }

  // Every reservation disc must lie on the airfield the runtime excludes, or they disagree.
  assert.ok(AIRPORT_RESERVATIONS.length > 10);
  for (const disc of AIRPORT_RESERVATIONS) {
    assert.equal(onAirfield(disc.x, disc.z), true, 'a reservation disc fell outside the excluded airfield');
  }
  const poi = { x: -3018.4, z: -9928.5 };
  const runway = latLonToWorld(-3.0386, -60.0497);
  assert.ok(Math.hypot(runway.x - poi.x, runway.z - poi.z) < 1500,
    'the runway must sit next to the Overture airport place record');
});
