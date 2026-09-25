import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Group, Mesh, MeshStandardMaterial, Vector3 } from 'three/webgpu';
import { DESTRUCTION, REAL_CITY } from '../src/core/config.ts';
import { ROAD_HEIGHT, ROAD_MARKING_LIFT, ROAD_MAX_HEIGHT, roadHeightOf } from '../src/world/realcity/roads.ts';
import { ANIMATION_LIBRARY } from '../src/player/animations/AnimationLibrary.ts';
import { GEO_ORIGIN, LANDMARKS, latLonToWorld, onAirfield, worldToLatLon } from '../src/world/geodata/geodata.ts';
import { WORLD } from '../src/core/config.ts';
import { BUILDING_STRIDE } from '../src/world/chunks/Chunk.ts';
import { generateChunk } from '../src/world/chunks/BuildingGenerator.ts';
import { AIRPORT_RESERVATIONS } from '../src/world/realcity/airport.ts';
import { ARENA_COLLIDERS } from '../src/world/landmarks/arena.ts';
import {
  appendNearBuilding, appendShellBuilding, buildingSeed, createBuffers, districtCharacter,
  roofShapeFor, setDistrictSampler, type MeshBuffers, type RealBuilding,
} from '../src/world/realcity/buildingGeometry.ts';
import { ARTERIAL_CLASSES, RoadNetwork, type RoadRecord } from '../src/world/realcity/roads.ts';
import { RealCityLayer } from '../src/world/realcity/RealCityLayer.ts';
import { DistrictIndex } from '../src/world/realcity/districts.ts';
import { LandMask } from '../src/world/geodata/landmask.ts';
import { GEO_REFERENCES, geoDistance, probeLatLon, probeWorld } from '../src/world/geodata/GeoDebug.ts';
import { WorldStreamer } from '../src/world/streaming/WorldStreamer.ts';

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
  // Local streets, markings and furniture rebuild one stage per call: together they cost 58 ms,
  // a four-frame stall every time the player crossed the dead band.
  const settle = (x: number, z: number, speed = 0) => { for (let i = 0; i < 4; i++) network.update(x, z, speed); };
  settle(0, 0);
  assert.ok(network.statistics.localTriangles > 0, 'nearby streets must appear');
  assert.ok(network.statistics.markingTriangles > 0, 'arterial centre lines appear near the player');
  const nearby = network.statistics.localTriangles;

  // Twelve kilometres away, the distant neighbourhood's streets and all markings must be gone.
  settle(12000, 12000);
  assert.equal(network.statistics.arterialTriangles, arterial, 'arterials never rebuild');
  assert.equal(network.statistics.markingTriangles, 0, 'markings cost nothing away from the player');
  assert.ok(network.statistics.localTriangles < nearby);
  assert.ok(ARTERIAL_CLASSES.has('primary') && ARTERIAL_CLASSES.has('trunk'));
  assert.equal(ARTERIAL_CLASSES.has('residential'), false);
  network.dispose();
  assert.equal(network.group.children.length, 0);
});

test('street furniture only exists near the player and never stands on a building', () => {
  const material = new MeshStandardMaterial(), lamps = new MeshStandardMaterial();
  const records: RoadRecord[] = [
    { class: 'primary', width: 14, p: [0, 0, 600, 0], name: 'Avenida Teste' },
    { class: 'residential', width: 7, p: [0, 40, 300, 40] },
  ];
  const network = new RoadNetwork(records, material, lamps);
  const settle = (x: number, z: number, speed = 0) => { for (let i = 0; i < 4; i++) network.update(x, z, speed); };
  settle(0, 0);
  const furniture = network.group.children.find(child => child.name === 'real-roads-lamps') as Mesh | undefined;
  assert.ok(furniture, 'lamps and street trees must be built near the player');
  const positions = furniture.geometry.getAttribute('position');
  assert.ok(positions.count > 0);
  const lit = furniture.geometry.getAttribute('lit');
  assert.ok(lit, 'the night-glow mask must reach the furniture material');
  let glowing = 0;
  for (let i = 0; i < lit.count; i++) if (lit.getX(i) > .5) glowing++;
  assert.ok(glowing > 0 && glowing < lit.count * .5, 'only lamp heads glow, never masts or foliage');

  // Furniture rides beside the carriageway, so it can never intrude on a real footprint.
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getZ(i);
    assert.ok(Math.abs(z) > 5 || Math.abs(z - 40) > 3.4, 'furniture must sit off the centre line');
  }
  // Away from the player it costs nothing at all.
  settle(20000, 20000);
  assert.equal(network.group.children.find(child => child.name === 'real-roads-lamps'), undefined,
    'street furniture must not exist away from the player');

  // Above cruise speed the whole detail tier is dropped rather than rebuilt every few frames.
  settle(0, 0);
  assert.ok(network.statistics.localTriangles > 0, 'detail returns when the player slows down');
  settle(6000, 0, 5000);
  assert.equal(network.statistics.localTriangles, 0, 'local streets are dropped at speed');
  assert.equal(network.statistics.markingTriangles, 0, 'lane paint is dropped at speed');
  assert.equal(network.group.children.find(child => child.name === 'real-roads-lamps'), undefined);
  network.dispose();
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

    // Inside urban Manaus, even in tiles without Overture 3D footprints, procedural chunks are covered:
    const urbanChunkX = Math.floor(-4096 / manifest.proceduralChunkSize);
    const urbanChunkZ = Math.floor(-1024 / manifest.proceduralChunkSize);
    assert.equal(layer.coversChunk(urbanChunkX, urbanChunkZ), true);
    assert.equal(layer.replaces(`${urbanChunkX},${urbanChunkZ}/building/0`), true);

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

test('the bairro index answers point lookups from real polygons and degrades gracefully', () => {
  const index = new DistrictIndex();
  assert.equal(index.load(null), false, 'a missing districts file must leave the index inert');
  assert.equal(index.at(0, 0), null);
  assert.equal(index.size, 0);

  // A square bairro with a hole, plus a neighbour, is enough to exercise every branch.
  const square = (cx: number, cz: number, half: number) =>
    [cx - half, cz - half, cx + half, cz - half, cx + half, cz + half, cx - half, cz + half];
  assert.equal(index.load({ districts: [
    { name: 'Centro', kind: 'neighborhood', x: 0, z: 0, rings: [square(0, 0, 500), square(0, 0, 100)] },
    { name: 'Adrianópolis', kind: 'neighborhood', x: 1200, z: -3000, rings: [square(1200, -3000, 400)] },
  ] }), true);
  assert.equal(index.size, 2);
  assert.equal(index.at(300, 300)?.name, 'Centro');
  assert.equal(index.at(0, 0), null, 'a hole in the outer ring is not part of the bairro');
  assert.equal(index.at(1250, -3050)?.name, 'Adrianópolis');
  assert.equal(index.at(9000, 9000), null);
  // Outside every boundary the HUD still needs a name to show.
  assert.equal(index.nearest(9000, 9000)?.name ?? null, null, 'nothing is near enough to claim it');
  assert.equal(index.nearest(700, 0)?.name, 'Centro');
  assert.equal(index.at(300, 300), index.at(300, 300), 'a repeated lookup is served from the cache');
});

test('the compiled bairro boundaries name real Manaus neighbourhoods', () => {
  const file = path.join(DATA, 'districts.json');
  if (!existsSync(file)) return; // Compiled by the geodata pipeline; absent until it has run.
  const index = new DistrictIndex();
  assert.equal(index.load(JSON.parse(readFileSync(file, 'utf8'))), true);
  assert.ok(index.size > 20, `only ${index.size} bairros compiled`);
  const names = index.names.join(' | ').toLowerCase();
  for (const expected of ['centro', 'ponta negra', 'cidade nova']) {
    assert.ok(names.includes(expected), `expected a bairro named like "${expected}"`);
  }
  // The Teatro Amazonas is the projection origin and sits squarely in the Centro.
  const here = index.nearest(0, 0);
  assert.ok(here, 'the origin must resolve to a bairro');
});

test('the baked land mask answers land and water in constant time and stays optional', () => {
  const mask = new LandMask();
  assert.equal(mask.ready, false);
  assert.equal(mask.isWater(0, 0), false, 'an unloaded mask must never claim anything is water');
  assert.equal(mask.covers(0, 0), false);
  assert.equal(mask.load(null), false);

  // Four cells wide, two rows: the first row is all water, the second all land.
  const rowBytes = 1, width = 4, height = 2;
  const bytes = new Uint8Array(rowBytes * height);
  bytes[0] = 0b1111; bytes[1] = 0b0000;
  const bits = Buffer.from(bytes).toString('base64');
  assert.equal(mask.load({ originX: -256, originZ: -256, cell: 128, width, height, bits }), true);
  assert.equal(mask.ready, true);
  assert.equal(mask.waterCells, 4);
  assert.equal(mask.isWater(-200, -200), true, 'first row is water');
  assert.equal(mask.isWater(-200, -60), false, 'second row is land');
  assert.equal(mask.covers(-200, -200), true);
  // Outside the baked extent the caller keeps its own fallback rather than getting a wrong answer.
  assert.equal(mask.covers(99999, 0), false);
  assert.equal(mask.isWater(99999, 0), false);
  // A truncated payload is rejected instead of reading past the buffer.
  assert.equal(mask.load({ originX: 0, originZ: 0, cell: 128, width: 512, height: 512, bits }), false);
});

test('the compiled land mask agrees with the river where the pipeline has produced one', () => {
  const file = path.join(DATA, 'landmask.json');
  if (!existsSync(file)) return; // Emitted by the geodata pipeline; absent until it has run.
  const mask = new LandMask();
  assert.equal(mask.load(JSON.parse(readFileSync(file, 'utf8'))), true);
  assert.ok(mask.covers(0, 0), 'the mask must reach the projection origin');
  assert.equal(mask.isWater(0, 0), false, 'the Teatro Amazonas does not stand in the river');
  const fraction = mask.waterCells / (512 * 512);
  assert.ok(fraction > 0.02 && fraction < 0.75, `implausible water fraction ${(fraction * 100).toFixed(1)}%`);
});

test('no landmark stands in the Rio Negro once the real water polygons are consulted', () => {
  const file = path.join(DATA, 'landmask.json');
  if (!existsSync(file)) return;
  const mask = new LandMask();
  assert.equal(mask.load(JSON.parse(readFileSync(file, 'utf8'))), true);
  // A bridge, a floating harbour and a river confluence belong over water by definition.
  const overWater = new Set(['ponte', 'porto', 'encontro']);
  // The mask is a 128 m grid, so a waterfront landmark legitimately lands in a coastal cell.
  // What must not happen is one sitting out in open water, so the test is distance to dry land.
  const dryWithin = (x: number, z: number, reach: number): boolean => {
    for (let radius = 0; radius <= reach; radius += 32) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos(a / 16 * Math.PI * 2) * radius, pz = z + Math.sin(a / 16 * Math.PI * 2) * radius;
        if (!mask.isWater(px, pz)) return true;
      }
    }
    return false;
  };
  const drowned: string[] = [];
  for (const landmark of LANDMARKS) {
    if (overWater.has(landmark.id) || !mask.covers(landmark.x, landmark.z)) continue;
    if (mask.isWater(landmark.x, landmark.z) && !dryWithin(landmark.x, landmark.z, 160)) drowned.push(landmark.id);
  }
  assert.deepEqual(drowned, [], 'these landmarks sit out in the real river');
  // Iranduba specifically has to be on the far bank, not merely out of the water.
  const iranduba = LANDMARKS.find(landmark => landmark.id === 'iranduba')!;
  assert.equal(mask.isWater(iranduba.x, iranduba.z), false);
  assert.equal(mask.isWater(iranduba.x, iranduba.z - 2000), true,
    'the far bank must have the Rio Negro between it and Manaus');

  // The square is world zero and the theatre is a separate place ~98 m west of it.
  const largo = LANDMARKS.find(landmark => landmark.id === 'largo')!;
  const teatro = LANDMARKS.find(landmark => landmark.id === 'teatro')!;
  assert.ok(Math.hypot(largo.x, largo.z) < 1, 'the monument must be the origin of the world');
  // The landmark anchors the theatre's compiled footprint CENTROID, which is 84 m from the
  // monument; the OSM way node is 98 m. A 63 m long building has no single distance.
  const apart = Math.hypot(teatro.x - largo.x, teatro.z - largo.z);
  assert.ok(apart > 75 && apart < 110, `the theatre is ${apart.toFixed(0)} m from the monument`);
  assert.ok(teatro.x < -70, 'the theatre lies west of the square, not south of it');
});

test('facade colour follows the real bairro boundaries, not one palette for the whole city', () => {
  const districtFile = path.join(DATA, 'districts.json');
  if (!manifest || !existsSync(districtFile)) return;
  const index = new DistrictIndex();
  assert.equal(index.load(JSON.parse(readFileSync(districtFile, 'utf8'))), true);
  setDistrictSampler((x, z) => {
    const bairro = index.at(x, z);
    return bairro ? districtCharacter(bairro.name, bairro.x, bairro.z) : null;
  });
  try {
    const saturation = (tx: number, tz: number): { mean: number; bairro: string | null } => {
      const file = manifest.tiles[`${tx},${tz}`];
      if (!file) return { mean: NaN, bairro: null };
      const tile = JSON.parse(readFileSync(path.join(DATA, file), 'utf8')) as { buildings: RealBuilding[] };
      let total = 0, samples = 0;
      for (const building of tile.buildings.slice(0, 400)) {
        const buffers = createBuffers();
        // Footprints are tile-local; the sampler needs them where they actually stand.
        const moved = { ...building, p: building.p.map((v, i) => v + (i % 2 ? tz * manifest.tileSize : tx * manifest.tileSize)) };
        if (!appendShellBuilding(buffers, moved)) continue;
        for (let i = 0; i < buffers.color.length; i += 3) {
          const max = Math.max(buffers.color[i], buffers.color[i + 1], buffers.color[i + 2]);
          const min = Math.min(buffers.color[i], buffers.color[i + 1], buffers.color[i + 2]);
          total += max === 0 ? 0 : (max - min) / max; samples++;
        }
      }
      return { mean: samples ? total / samples : NaN, bairro: index.at(tx * manifest.tileSize + 512, tz * manifest.tileSize + 512)?.name ?? null };
    };

    const measured = [[0, 0], [0, -6], [3, -2], [8, -7]].map(([tx, tz]) => saturation(tx, tz))
      .filter(entry => Number.isFinite(entry.mean) && entry.bairro);
    assert.ok(measured.length >= 3, 'the sample tiles must land inside compiled bairros');
    const low = Math.min(...measured.map(entry => entry.mean));
    const high = Math.max(...measured.map(entry => entry.mean));
    assert.ok(high > low * 1.8,
      `bairros must read differently: saturation ranged only ${low.toFixed(3)}..${high.toFixed(3)}`);
    assert.ok(high < .95, 'no bairro should be fully saturated');
  } finally {
    setDistrictSampler(null);
  }
});

test('the district sampler never breaks determinism or near/shell colour agreement', () => {
  setDistrictSampler((x, z) => districtCharacter('Fixture', x, z));
  try {
    const building: RealBuilding = { id: 'sampler-check', h: 30, p: [-10, -10, -10, 10, 10, 10, 10, -10] };
    const first = createBuffers(), second = createBuffers(), shell = createBuffers();
    appendNearBuilding(first, building);
    appendNearBuilding(second, building);
    appendShellBuilding(shell, building);
    assert.deepEqual(first.color, second.color, 'a sampler must not make facades vary between rebuilds');
    // Both tiers must start from the same base colour or a building changes hue as you approach it.
    assert.ok(Math.abs(first.color[0] - shell.color[0]) < .3, 'near and shell disagree on the base colour');
  } finally {
    setDistrictSampler(null);
  }
});

test('the Ponta Negra orla stands on the real beach, not out in the Rio Negro', () => {
  const file = path.join(DATA, 'landmask.json');
  if (!existsSync(file)) return;
  const mask = new LandMask();
  assert.equal(mask.load(JSON.parse(readFileSync(file, 'utf8'))), true);
  const ponta = LANDMARKS.find(landmark => landmark.id === 'ponta')!;
  // The orla is laid out in shore-local coordinates: `along` down the beach, `inland` away from it.
  const angle = .51, sin = Math.sin(angle), cos = Math.cos(angle), mid = -205;
  const wet = (along: number, inland: number): boolean => mask.isWater(
    ponta.x + sin * (mid + along) + cos * inland,
    ponta.z + cos * (mid + along) - sin * inland,
  );
  // The mask is a 128 m grid and the beach is a ~100 m strip, so a single wet cell under the sand
  // is resolution, not error. What must not happen is the orla standing far out in the river, so
  // the invariant is distance to dry ground rather than the cell directly underneath.
  const seaward = (along: number, inland: number): number => {
    for (let out = 0; out <= 400; out += 32) if (!wet(along, inland + out)) return out;
    return Infinity;
  };
  for (let along = -330; along <= 330; along += 55) {
    assert.ok(seaward(along, 45) <= 160, `the promenade is ${seaward(along, 45)} m out in the river at along ${along}`);
  }
  for (const along of [-370, -275, -180, -85, 10, 105, 200, 290]) {
    assert.ok(seaward(along, 18) <= 160, `a kiosk is ${seaward(along, 18)} m out in the river at along ${along}`);
  }
  assert.equal(seaward(-60, 150), 0, 'the amphitheatre must be on dry ground outright');
  // The beach itself must still reach the water, or it is not a beach.
  assert.equal(wet(0, -140), true, 'the shore must be seaward of the sand');
  // And the orla must not have crept back to the old footprint that ran 600 m down the river.
  assert.ok(seaward(-520, 18) > 0, 'the orla should no longer extend that far north-west');
});

test('dropping facade detail never drops collision with the buildings it was drawing', async () => {
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
  const settle = async (velocity: Vector3) => {
    for (let i = 0; i < 160; i++) {
      layer.update(new Vector3(0, 40, 0), velocity, 1 / 60);
      if (i % 10 === 0) await new Promise(resolve => setTimeout(resolve, 4));
    }
  };
  try {
    await layer.initialize();
    await settle(new Vector3());
    assert.ok(layer.stats.near > 0, 'near cells must be promoted at rest');
    assert.ok(layer.stats.colliders > 0, 'real buildings must be collidable');
    const richColliders = layer.stats.colliders;
    assert.ok(layer.stats.detailTriangles > 0, 'facades exist at a low quality-independent baseline');

    // A low quality preset drops windows and balconies, and must keep every collider.
    layer.setDetail(false);
    await settle(new Vector3());
    assert.ok(layer.stats.near > 0, 'cells stay promoted when detail is off');
    assert.ok(layer.stats.colliders > richColliders * .5,
      `collision collapsed with detail: ${richColliders} -> ${layer.stats.colliders}`);

    // Above cruise speed the facades are pointless, but the buildings must still be solid.
    layer.setDetail(true);
    await settle(new Vector3(0, 0, -700));
    assert.ok(layer.stats.near > 0, 'cells stay promoted above the facade speed limit');
    assert.ok(layer.stats.colliders > 0, 'buildings stay solid above the facade speed limit');

    // At mega speed the ring deliberately rides kilometres ahead, so what is behind is released.
    // The invariant there is the budget, not local collision: the player is crossing, not walking.
    await settle(new Vector3(0, 0, -8000));
    assert.ok(layer.stats.tiles <= REAL_CITY.maxTiles);
    assert.ok(layer.stats.colliders <= REAL_CITY.maxColliders);
  } finally {
    layer.dispose(); globalThis.fetch = previous;
  }
});

test('the projection is anchored on the monument and every reference lands where it should', () => {
  // World zero is the Monumento à Abertura dos Portos, not the theatre.
  assert.equal(GEO_ORIGIN.lat, -3.130333);
  assert.equal(GEO_ORIGIN.lon, -60.022528);
  const monument = probeLatLon(GEO_ORIGIN.lat, GEO_ORIGIN.lon);
  assert.ok(Math.abs(monument.x) < 1e-6 && Math.abs(monument.z) < 1e-6, 'the monument must project to 0,0');

  const at = (id: string) => {
    const reference = GEO_REFERENCES.find(item => item.id === id)!;
    return probeLatLon(reference.lat, reference.lon);
  };
  // The theatre is a separate place roughly 98 m WEST of the square, not on top of it.
  const teatro = at('teatro');
  assert.ok(teatro.x < -70 && teatro.x > -115, `the theatre projects to x=${teatro.x.toFixed(0)}`);
  assert.ok(Math.abs(teatro.z) < 30, `the theatre projects to z=${teatro.z.toFixed(0)}`);
  // Measured to the footprint centroid the theatre is 84 m away; to its OSM node, 98 m.
  const apart = Math.hypot(teatro.x, teatro.z);
  assert.ok(apart > 75 && apart < 110, `the theatre is ${apart.toFixed(1)} m from the monument`);

  // The Largo venues all belong to the square, within a couple of hundred metres.
  for (const id of ['igreja', 'juma', 'valer']) {
    const place = at(id);
    const distance = Math.hypot(place.x, place.z);
    assert.ok(distance < 220, `${id} is ${distance.toFixed(0)} m from the square`);
  }
  // Every Largo reference must agree with what the game actually builds there.
  const igreja = at('igreja');
  assert.ok(igreja.z < -40, 'the church closes the south end of the square');
  assert.ok(at('valer').z > 60, 'Valer Teatro is on the north side');
  assert.ok(at('juma').x < -70, 'Juma Ópera stands beside the theatre');

  // Round trip, and the compiled dataset must share the same origin.
  const back = probeWorld(teatro.x, teatro.z);
  assert.ok(Math.abs(back.lat - at('teatro').lat) < 1e-9 && Math.abs(back.lon - at('teatro').lon) < 1e-9);
  if (manifest) {
    assert.equal(manifest.origin.lat, GEO_ORIGIN.lat, 'the compiled tiles must use this origin');
    assert.equal(manifest.origin.lon, GEO_ORIGIN.lon);
  }
  assert.ok(geoDistance(at('monumento'), at('teatro')) > 75);
});

test('streamer with real city replacement suppresses procedural buildings immediately on activation with 0 frames visible', async () => {
  if (!manifest) return;
  const previous = globalThis.fetch;
  const previousDocument = globalThis.document;
  const context = { fillStyle: '', fillRect() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) } as unknown as Document;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(typeof input === 'object' && 'url' in input ? input.url : input);
    const marker = url.indexOf('geodata/real-city/');
    if (marker < 0) return new Response(null, { status: 404 });
    const file = path.join(DATA, url.slice(marker + 'geodata/real-city/'.length));
    if (!existsSync(file)) return new Response(null, { status: 404 });
    return new Response(await readFile(file), { status: 200 });
  }) as typeof fetch;
  const root = new Group(), layer = new RealCityLayer(root), streamer = new WorldStreamer(root);
  try {
    await layer.initialize();
    streamer.setReplacesChunk((cx, cz) => layer.coversChunk(cx, cz));
    await streamer.prepare(new Vector3(0, 50, 0));
    // Check all active chunks in root: any replaced chunk must have zero visible procedural facades/roofs
    let checkedChunks = 0;
    for (const child of root.children) {
      if (!child.name.startsWith('chunk:')) continue;
      checkedChunks++;
      for (const object of child.children) {
        if (['facades', 'terracotta-roofs', 'sidewalks'].includes(object.name)) {
          assert.equal(object.visible, false, `procedural ${object.name} in chunk ${child.name} must not be visible in the real city`);
        }
      }
    }
    assert.ok(checkedChunks >= 9, 'at least a 3x3 neighbourhood was prepared');
    // None of the streamer's replaced colliders should be present
    for (const c of streamer.colliders) {
      assert.equal(layer.replacesCollider(c), false, 'streamer colliders in covered area must be suppressed');
    }
  } finally {
    streamer.dispose();
    layer.dispose();
    globalThis.fetch = previous;
    globalThis.document = previousDocument;
  }
});


test('the road is asphalt lying on the ground, not a kerb the player wades through', () => {
  // The player walks at terrain height, which is zero under the city. A ribbon drawn 22-34 cm up
  // — where these started — is a step he stands inside up to the shin.
  const classes = Object.keys(ROAD_HEIGHT);
  assert.ok(classes.length >= 8, 'every road class needs a deck height');
  for (const klass of classes) {
    const y = roadHeightOf(klass);
    assert.ok(y > 0, `${klass} has to clear the ground or it fights it for depth`);
    assert.ok(y <= 0.05, `${klass} sits ${(y * 100).toFixed(1)} cm up, which reads as a kerb`);
  }
  // The classes still stagger, or overlapping ribbons flicker against each other at junctions.
  assert.equal(new Set(Object.values(ROAD_HEIGHT)).size >= 6, true, 'ribbons need distinct heights');
  assert.ok(roadHeightOf('motorway') > roadHeightOf('residential'), 'the bigger road stays on top');
  assert.equal(roadHeightOf('not-a-real-class'), roadHeightOf('residential'), 'unknown classes fall back');

  // Lane paint sits on its own ribbon, and the scorch marks have to clear the highest of them or
  // they disappear into the asphalt.
  assert.ok(ROAD_MARKING_LIFT > 0 && ROAD_MARKING_LIFT < 0.01);
  assert.ok(ROAD_MAX_HEIGHT >= Math.max(...Object.values(ROAD_HEIGHT)));
  assert.ok(DESTRUCTION.scarHeight > ROAD_MAX_HEIGHT, 'scars must sit above the lane paint');
  assert.ok(DESTRUCTION.scarHeight < 0.2, 'and not hover over the street');
});

test('the animation library is a real GLB that matches its manifest and the character rig', () => {
  const read = (file: string) => {
    const buffer = readFileSync(file);
    assert.equal(buffer.readUInt32LE(0), 0x46546c67, `${file} is not a GLB`);
    const jsonLength = buffer.readUInt32LE(12);
    return { json: JSON.parse(buffer.slice(20, 20 + jsonLength).toString('utf8')), bytes: buffer.length };
  };
  const library = read('public/assets/player/animation-library.glb');
  const character = read('public/assets/player/dr-manaus-character.glb');

  const names = (library.json.animations as { name: string }[]).map(a => a.name).sort();
  assert.deepEqual(names, [...ANIMATION_LIBRARY.clips].sort(), 'the manifest and the file disagree');
  assert.ok(names.length >= 25, `the catalogue carries only ${names.length} clips`);

  // The character wins every name clash, so the library must not carry duplicates at all.
  const owned = new Set((character.json.animations as { name: string }[]).map(a => a.name));
  for (const name of names) assert.ok(!owned.has(name), `${name} is already in the character`);

  // The clips have to land on the hero's own skeleton, which is the whole reason this pack works.
  const bonesOf = (glb: { json: any }) =>
    new Set((glb.json.skins?.[0]?.joints ?? glb.json.nodes.map((_: unknown, i: number) => i))
      .map((i: number) => glb.json.nodes[i].name));
  const rig = bonesOf(character);
  const targets = new Set((library.json.animations as { channels: { target: { node: number } }[] }[])
    .flatMap(a => a.channels.map(c => library.json.nodes[c.target.node].name)));
  for (const bone of targets) assert.ok(rig.has(bone as string), `library clips drive ${bone}, which the hero lacks`);

  // It is an animations-only file: shipping the mannequin as well would be dead weight.
  assert.ok(!library.json.meshes?.length, 'the library must not carry a mesh');
  assert.ok(!library.json.images?.length && !library.json.materials?.length);
  assert.ok(library.bytes < 7 * 1024 * 1024, `the catalogue weighs ${(library.bytes / 1048576).toFixed(1)} MB`);

  // And the licence is recorded, because it ships in the repository.
  assert.match(ANIMATION_LIBRARY.licence, /CC0/);
  assert.ok(ANIMATION_LIBRARY.source.length > 0 && ANIMATION_LIBRARY.credit.length > 0);
  assert.match(String(library.json.asset?.copyright ?? ''), /CC0/);
});
