import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GLSLNodeBuilder, Group, InstancedMesh, Matrix4, Mesh, PerspectiveCamera, Scene, Vector3, WebGPURenderer, WGSLNodeBuilder,
  type Object3D,
} from 'three/webgpu';
import { MoonSurfaceGenerator } from '../src/world/planet/MoonSurface';
import { PlanetGlobe, buildPlanetTileMesh } from '../src/world/planet/PlanetGlobe';
import { PlanetRockScatter, ROCK_SCATTER, rockTile, rockTileLevel } from '../src/world/planet/PlanetRockScatter';
import { DETAIL_CELLS_M, DETAIL_PERIOD_M, detailVisibleWithinM, detailWeight } from '../src/world/planet/PlanetSurfaceDetail';
import { planetSurfaceRadius } from '../src/world/planet/PlanetSurface';
import { planetTile } from '../src/world/planet/PlanetTileAddress';
import { createPlanetProviders } from '../src/world/providers/PlanetProviderRegistry';
import { UniverseRuntime } from '../src/world/runtime/UniverseRuntime';
import type { Vec3 } from '../src/world/spatial/units';

/** Builds the real node material of a mesh into shader source, without a GPU. */
function buildShader(mesh: Object3D, backend: 'wgsl' | 'glsl') {
  const canvas = { style: {}, width: 4, height: 4, getContext: () => null, addEventListener() {}, removeEventListener() {} };
  const renderer = new WebGPURenderer({ canvas: canvas as unknown as HTMLCanvasElement, forceWebGL: backend === 'glsl' });
  const Builder = backend === 'wgsl' ? WGSLNodeBuilder : GLSLNodeBuilder;
  const builder = new (Builder as unknown as new (object: Object3D, renderer: WebGPURenderer) => Record<string, any>)(mesh, renderer);
  // Instancing asks the device for its uniform-block limit; the WebGPU minimum is enough here.
  builder.getUniformBufferLimit = () => 65_536;
  builder.scene = new Scene();
  builder.camera = new PerspectiveCamera();
  builder.material = (mesh as Mesh).material;
  const warnings: string[] = [];
  const warn = console.warn, error = console.error;
  console.warn = console.error = (...args: unknown[]) => { warnings.push(args.join(' ')); };
  try { builder.build(); } finally { console.warn = warn; console.error = error; }
  return { vertex: builder.vertexShader as string, fragment: builder.fragmentShader as string, warnings };
}

const moonDirection = (latDeg: number, lonDeg: number): Vec3 => {
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
};
const onGround = (direction: Vec3, heightM: number): Vec3 => {
  const r = planetSurfaceRadius(MoonSurfaceGenerator, direction) + heightM;
  return [direction[0] * r, direction[1] * r, direction[2] * r];
};

test('the close-range planet shader and the rock shader build for WebGPU and WebGL 2', t => {
  const globe = new PlanetGlobe('moon');
  t.after(() => globe.dispose());
  const tile = buildPlanetTileMesh(planetTile('moon', 0, 2, 1, 1), MoonSurfaceGenerator);
  globe.add('tile', tile);
  const ground = globe.root.children.find(child => child instanceof Mesh && child.geometry === tile.geometry)!;
  const rocks = new InstancedMesh(tile.geometry, globe.rockMaterial, 1);
  for (const backend of ['wgsl', 'glsl'] as const) {
    const shader = buildShader(ground, backend);
    assert.deepEqual(shader.warnings, [], `${backend} ground warnings`);
    assert.ok(shader.vertex.includes('detailCoord'), `${backend} passes the detail coordinate`);
    assert.ok(shader.fragment.length > 5_000, `${backend} fragment carries the detail octaves`);
    assert.deepEqual(buildShader(rocks, backend).warnings, [], `${backend} rock warnings`);
  }
});

test('detail coordinates continue across tile edges, so the pattern has no seams', () => {
  const left = buildPlanetTileMesh(planetTile('moon', 2, 6, 20, 31), MoonSurfaceGenerator);
  const right = buildPlanetTileMesh(planetTile('moon', 2, 6, 21, 31), MoonSurfaceGenerator);
  const size = 17;
  const a = left.geometry.getAttribute('detailCoord'), b = right.geometry.getAttribute('detailCoord');
  const pa = left.geometry.getAttribute('position'), pb = right.geometry.getAttribute('position');
  for (let row = 0; row < size; row++) {
    const i = row * size + size - 1, j = row * size;
    for (let axis = 0; axis < 3; axis++) {
      const worldGap = (pa.array[i * 3 + axis] + left.centre[axis]) - (pb.array[j * 3 + axis] + right.centre[axis]);
      assert.ok(Math.abs(worldGap) < .5, 'the two vertices are the same point');
      const wrapped = ((a.array[i * 3 + axis] - b.array[j * 3 + axis]) / DETAIL_PERIOD_M);
      const gapM = Math.abs(wrapped - Math.round(wrapped)) * DETAIL_PERIOD_M;
      assert.ok(gapM < .5, `edge detail differs by ${gapM} m`);
    }
  }
  for (const cell of DETAIL_CELLS_M) assert.equal(DETAIL_PERIOD_M % (cell * 256), 0, `${cell} m octave tiles with the period`);
});

test('each detail octave fades in smoothly as the camera approaches', () => {
  for (const cell of DETAIL_CELLS_M) {
    const end = detailVisibleWithinM(cell);
    assert.equal(detailWeight(cell, end / 2), 1);
    assert.equal(detailWeight(cell, end), 0);
    let previous = 1;
    for (let d = end / 2; d <= end; d += end / 40) {
      const weight = detailWeight(cell, d);
      assert.ok(weight <= previous && weight >= 0);
      previous = weight;
    }
  }
});

test('rocks are fixed on the lunar ground, deterministic and small enough to walk through', () => {
  const level = rockTileLevel(MoonSurfaceGenerator.radiusM);
  const address = planetTile('moon', 0, level, 2 ** (level - 1), 2 ** (level - 1));
  const rocks = rockTile(MoonSurfaceGenerator, address);
  assert.ok(rocks.length > 10 && rocks.length < ROCK_SCATTER.cellsPerSide ** 2 / 2, `${rocks.length} rocks`);
  assert.deepEqual(rockTile(MoonSurfaceGenerator, address), rocks);
  for (const rock of rocks) {
    assert.ok(rock.sizeM <= ROCK_SCATTER.maxSizeM);
    const r = Math.hypot(...rock.position);
    const gap = r - planetSurfaceRadius(MoonSurfaceGenerator, [rock.position[0] / r, rock.position[1] / r, rock.position[2] / r]);
    assert.ok(gap >= 0 && gap < rock.sizeM, `rock sits on the ground (${gap.toFixed(2)} m above, ${rock.sizeM.toFixed(2)} m wide)`);
  }
});

test('rocks stream around a walking observer, vanish high above and stay out of craters', t => {
  const globe = new PlanetGlobe('moon');
  const scatter = new PlanetRockScatter(MoonSurfaceGenerator, globe.rockMaterial);
  t.after(() => { scatter.dispose(); globe.dispose(); });
  const direction = moonDirection(0.674, 23.47);
  const here = onGround(direction, 2);
  for (let frame = 0; frame < 200; frame++) scatter.update(here);
  const settled = scatter.stats;
  assert.ok(settled.visible && settled.rocks > 300 && settled.tiles < 120, JSON.stringify(settled));
  // Every rock around the observer is within the scatter radius plus a tile.
  const positions: Vector3[] = [];
  for (const mesh of scatter.group.children as InstancedMesh[]) {
    const matrix = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      if (matrix.determinant() !== 0) positions.push(new Vector3().setFromMatrixPosition(matrix).add(mesh.position));
    }
  }
  assert.ok(positions.every(p => p.distanceTo(new Vector3(...here)) < ROCK_SCATTER.radiusM + ROCK_SCATTER.tileM * 2.5));
  // Walking 3 km releases what is left behind.
  for (let step = 1; step <= 60; step++) {
    const walked = onGround(moonDirection(0.674, 23.47 + step * 0.0017), 2);
    for (let frame = 0; frame < 4; frame++) scatter.update(walked);
  }
  assert.ok(scatter.stats.tiles <= settled.tiles + 40, `${scatter.stats.tiles} tiles after walking`);
  for (let frame = 0; frame < 200; frame++) scatter.update(here);
  // A published crater clears its own space and nothing else.
  const victim = positions[Math.floor(positions.length / 2)];
  scatter.setExclusions([{ minBodyFixedM: [victim.x - 3, victim.y - 3, victim.z - 3], maxBodyFixedM: [victim.x + 3, victim.y + 3, victim.z + 3] }]);
  const remaining: Vector3[] = [];
  for (const mesh of scatter.group.children as InstancedMesh[]) {
    const matrix = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      if (matrix.determinant() !== 0) remaining.push(new Vector3().setFromMatrixPosition(matrix).add(mesh.position));
    }
  }
  assert.ok(remaining.every(p => p.distanceTo(victim) > 2.9));
  assert.ok(remaining.length > positions.length * .9);
  scatter.update(onGround(direction, ROCK_SCATTER.maxAltitudeM + 50));
  assert.equal(scatter.stats.visible, false);
});

test('only the body underfoot grows rocks, and disposal removes them', t => {
  const universe = new UniverseRuntime({ streaming: false, epochS: 0 });
  const providers = createPlanetProviders(new Group(), universe, undefined, false);
  const moon = providers.get('moon')!;
  t.after(() => { for (const p of providers.values()) p.dispose(); universe.dispose(); });
  const here = onGround(moonDirection(26.1, 3.6), 2);
  moon.updateSurfaceDetail(here);
  assert.equal(moon.rockStats, undefined, 'nothing is built while the provider is off');
  moon.setStreamingMode('surface');
  moon.setVisible(true);
  for (let frame = 0; frame < 200; frame++) moon.updateSurfaceDetail(here);
  assert.ok(moon.rockStats!.visible && moon.rockStats!.rocks > 300);
  const rocks = moon.globe.root.children.find(child => child.name === 'moon-surface-rocks')!;
  moon.updateSurfaceDetail(null);
  assert.equal(moon.rockStats!.visible, false);
  moon.dispose();
  assert.equal(rocks.parent, null);
});
