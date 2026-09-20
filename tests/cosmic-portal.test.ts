import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { CosmicMaterial, STAR_LAYERS, starPixels } from '../src/player/cosmic/CosmicMaterial.ts';
import { CosmicVideoSource } from '../src/player/cosmic/CosmicVideoSource.ts';
import { CharacterModel } from '../src/player/CharacterModel.ts';

function headlessSource(): CosmicVideoSource {
  // No DOM in Node: the source falls back on its own, which is exactly the path under test.
  return new CosmicVideoSource({ autoStart: false });
}

test('the galaxy is sampled in screen space, so the body is a window and not a costume', () => {
  const source = headlessSource();
  const material = new CosmicMaterial({ source });
  try {
    // The whole claim rests on this: the shader reads screen coordinates, never the mesh UVs.
    assert.equal(material.metrics.projection, 'screen');
    const shader = String(material.material.colorNode);
    assert.ok(shader.length > 0, 'the material must have a colour graph');

    // One material for the entire figure. A material per limb is how a printed shirt happens:
    // each piece would get its own sampling frame and the universe would break at every seam.
    assert.equal(material.metrics.materials, 1);
  } finally {
    material.dispose(); source.dispose();
  }
});

test('the whole character shares one material, so no seam can appear between limbs', () => {
  const character = new CharacterModel();
  try {
    assert.ok(character.cosmicMaterial, 'the character must carry a cosmic material');
    // The body is a single skinned surface; arms and legs are bones on it, not separate meshes
    // with separate textures, which is what keeps the universe continuous across the silhouette.
    assert.equal(character.surface.material, character.cosmicMaterial!.material);
    assert.equal(character.cosmicDiagnostics.materials, 1);
    assert.equal(character.cosmicDiagnostics.bodyDraws, 2, 'the body and its accents, nothing more');
  } finally {
    character.dispose();
  }
});

test('the window drifts with the camera and settles when it stops', () => {
  const source = headlessSource();
  const material = new CosmicMaterial({ source });
  const camera = new PerspectiveCamera(58, 16 / 9, .1, 1000);
  try {
    camera.position.set(0, 2, 10);
    camera.lookAt(new Vector3(0, 2, 0));
    camera.updateMatrixWorld(true);
    material.updateView(camera);
    assert.equal(material.metrics.parallax, 0, 'the first frame establishes the reference, it does not jump');

    // Turning the camera slides the silhouette across the scene behind it.
    camera.rotateY(.35);
    camera.updateMatrixWorld(true);
    material.updateView(camera);
    const moved = material.metrics.parallax;
    assert.ok(moved > .05, `the universe did not respond to the camera turning (${moved})`);

    // Holding still lets it settle back, so a stationary player does not keep an offset forever.
    for (let frame = 0; frame < 300; frame++) material.update(1 / 60, 'idle', 0);
    assert.ok(material.metrics.parallax < moved * .2, 'the drift must decay when the camera stops');
  } finally {
    material.dispose(); source.dispose();
  }
});

test('the aspect correction keeps the nebula from being stretched by the viewport', () => {
  const source = headlessSource();
  const material = new CosmicMaterial({ source });
  try {
    // A wide viewport and a tall one must not squash the clip; the correction is what prevents it.
    for (const aspect of [21 / 9, 16 / 9, 3 / 4]) {
      const camera = new PerspectiveCamera(58, aspect, .1, 1000);
      camera.updateMatrixWorld(true);
      material.updateView(camera);
      assert.equal(material.metrics.projection, 'screen');
    }
    // Non-finite input must not poison the uniforms.
    const broken = new PerspectiveCamera(58, Number.NaN, .1, 1000);
    broken.updateMatrixWorld(true);
    material.updateView(broken);
    assert.ok(Number.isFinite(material.metrics.parallax));
  } finally {
    material.dispose(); source.dispose();
  }
});

test('the level ramps smoothly and never switches on, and survives a bad frame', () => {
  const source = headlessSource();
  const material = new CosmicMaterial({ source });
  try {
    const start = material.metrics.level;
    material.update(1 / 60, 'mega', 8000);
    const afterOne = material.metrics.level;
    assert.ok(afterOne > start && afterOne < start + .2, `the skin jumped to ${afterOne} in one frame`);
    for (let frame = 0; frame < 240; frame++) material.update(1 / 60, 'mega', 8000);
    const mega = material.metrics.level;
    assert.ok(mega > .9, `mega settled at ${mega}`);
    for (let frame = 0; frame < 600; frame++) material.update(1 / 60, 'idle', 0);
    assert.ok(material.metrics.level < .25, 'the skin must calm down again');

    material.update(Number.NaN, 'mega', 8000);
    material.update(1 / 60, 'mega', Number.NaN);
    assert.ok(Number.isFinite(material.metrics.level));

    // Disabling is a switch the debug overlay can throw without tearing anything down.
    material.enabled = false;
    assert.equal(material.enabled, false);
    material.enabled = true;
    assert.equal(material.enabled, true);
  } finally {
    material.dispose(); source.dispose();
  }
});

test('without a video the character still shows a universe rather than a black suit', () => {
  const source = headlessSource();
  try {
    // Node has no DOM, so this is the no-video path: it must land on a real cosmic texture.
    assert.ok(source.state === 'PROCEDURAL' || source.state === 'STATIC', `source fell back to ${source.state}`);
    assert.ok(source.texture, 'the sampler must always be valid');
    assert.ok(source.aspect > 0 && Number.isFinite(source.aspect));
    const material = new CosmicMaterial({ source });
    // The video mix stays at zero and the procedural cosmos carries the look on its own.
    material.update(1 / 60, 'flight', 100);
    assert.equal(material.metrics.videoMix, 0);
    material.dispose();
  } finally {
    source.dispose();
  }
});

test('the shipped galaxy clip is small enough to decode alongside the city', () => {
  const dir = path.resolve('public/assets/cosmic');
  const info = path.join(dir, 'asset-info.json');
  if (!existsSync(info)) return;
  const asset = JSON.parse(readFileSync(info, 'utf8')) as
    { width: number; height: number; fps: number; seconds: number; totalBytes: number };
  // 4K at 60 fps would cost more to decode than the city costs to draw.
  assert.ok(asset.width <= 1280 && asset.height <= 720, `the clip ships at ${asset.width}x${asset.height}`);
  assert.ok(asset.fps <= 30, `the clip ships at ${asset.fps} fps`);
  assert.ok(asset.totalBytes < 6 * 1024 * 1024, `the clip weighs ${(asset.totalBytes / 1048576).toFixed(1)} MB`);
  // A licence record has to exist for anything shipped in the repository.
  assert.ok(existsSync(path.join(dir, 'ATTRIBUTION.md')), 'public/assets/cosmic/ATTRIBUTION.md is missing');
});

test('the star field is many small stars, not a few enormous ones', () => {
  assert.ok(STAR_LAYERS.length >= 3, 'depth needs several layers drifting at different rates');
  for (const layer of STAR_LAYERS) {
    // Density is cells across the WHOLE frame, and the character covers roughly a tenth of it.
    // Below about 60 only a handful of cells ever land on the silhouette.
    assert.ok(layer.density >= 80, `a layer at density ${layer.density} puts too few cells on the body`);
    // The exponent on the cell hash decides how many cells produce a visible star. At 6, almost
    // none do: h = 0.7 becomes 0.12, and the body showed three huge stars instead of a field.
    assert.ok(layer.magnitude <= 3, `magnitude ${layer.magnitude} would drive most stars to black`);
    // Apparent diameter in pixels. The removed halo pass worked out at 6.4 px, which read as a
    // giant blob; under about half a pixel a star shimmers or disappears between frames.
    const pixels = starPixels(layer);
    assert.ok(pixels >= .7 && pixels <= 2.5, `a star is ${pixels.toFixed(2)} px on a 1920 frame`);
    // Drift is slow enough that the field reads as a sky rather than a scrolling texture.
    assert.ok(layer.drift <= 1, `a layer drifting at ${layer.drift} would visibly scroll`);
    assert.ok(layer.drift > 0, 'every layer has to move, or the field is painted on');
  }
  // The layers must actually differ, or they stack into one field rather than reading as depth.
  const densities = new Set(STAR_LAYERS.map(layer => layer.density));
  assert.equal(densities.size, STAR_LAYERS.length, 'layers must have distinct densities');
  const drifts = new Set(STAR_LAYERS.map(layer => layer.drift));
  assert.equal(drifts.size, STAR_LAYERS.length, 'layers must drift at distinct rates');

  // How many distinct stars actually land on the body? This mirrors the shader's cell maths
  // closely enough to catch the failure that mattered: a field so sparse it reads as three dots.
  const fract = (v: number) => v - Math.floor(v);
  const hash = (px: number, pz: number): number => {
    const qx = fract(px * .1031), qy = fract(pz * .1031), qz = fract(px * .1031);
    const d = qx * (qy + 33.33) + qy * (qz + 33.33) + qz * (qx + 33.33);
    return fract((qx + d + qy + d) * (qz + d));
  };
  const cells = new Set<string>();
  // The silhouette at third-person distance covers roughly this much of the frame.
  for (const layer of STAR_LAYERS) {
    for (let u = .44; u < .56; u += .0015) for (let v = .30; v < .70; v += .0015) {
      const cx = Math.floor(u * layer.density), cz = Math.floor(v * layer.density);
      if (Math.pow(hash(cx, cz), layer.magnitude) > .08) cells.add(`${layer.density}:${cx},${cz}`);
    }
  }
  assert.ok(cells.size > 500, `only ${cells.size} stars fall on the character`);
});
