/**
 * glTF writer for the vehicle pipeline. Takes node specs made of triangle soups and produces a GLB
 * with the shared `colormap` / `paint` / `glass` / `interior` materials (palette PNG embedded).
 */
import { createHash } from 'node:crypto';
import { Document, Logger, NodeIO, TextureInfo } from '@gltf-transform/core';
import { triCount, weldSoup } from './vehicle-geometry.mjs';
import { hexToLinear } from './vehicle-pipeline.mjs';

/**
 * spec = { name, translation?, rotation?, prims?: [{ soup, mat, uv?, color? }], children?: [spec] }
 */
export async function writeVehicleGlb({ name, paletteBytes, nodes }) {
  const doc = new Document();
  doc.createBuffer();
  doc.getRoot().getAsset().generator = 'DR-MANAUS build-vehicles (Kenney Car Kit, CC0)';
  const scene = doc.createScene(name);
  const buffer = doc.getRoot().listBuffers()[0];

  const texture = doc.createTexture('colormap').setImage(paletteBytes).setMimeType('image/png');
  const mats = {
    colormap: doc.createMaterial('colormap').setBaseColorTexture(texture).setMetallicFactor(0).setRoughnessFactor(0.85).setDoubleSided(true),
    paint: doc.createMaterial('paint').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0.1).setRoughnessFactor(0.5).setDoubleSided(true),
    glass: doc.createMaterial('glass').setBaseColorFactor([...hexToLinear('#9fb8c8'), 0.35]).setAlphaMode('BLEND').setMetallicFactor(0.2).setRoughnessFactor(0.1).setDoubleSided(true),
    interior: doc.createMaterial('interior').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.9).setDoubleSided(false),
  };
  const info = mats.colormap.getBaseColorTextureInfo();
  info.setMinFilter(TextureInfo.MinFilter.LINEAR).setMagFilter(TextureInfo.MagFilter.LINEAR)
    .setWrapS(TextureInfo.WrapMode.CLAMP_TO_EDGE).setWrapT(TextureInfo.WrapMode.CLAMP_TO_EDGE);

  const meshCache = new Map();
  const used = new Set();

  const makeAccessor = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer);

  function makeMesh(meshName, prims) {
    const welded = prims.filter((p) => p.soup && triCount(p.soup) > 0).map((p) => ({ p, w: weldSoup(p.soup, { withColor: !!p.color }) }));
    if (!welded.length) return null;
    const hash = createHash('sha1');
    for (const { p, w } of welded) {
      hash.update(p.mat);
      for (const arr of [w.positions, w.normals, w.uvs, w.indices]) hash.update(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
    }
    const key = hash.digest('hex');
    if (meshCache.has(key)) return meshCache.get(key);
    const mesh = doc.createMesh(meshName);
    for (const { p, w } of welded) {
      const prim = doc.createPrimitive().setMaterial(mats[p.mat]);
      prim.setAttribute('POSITION', makeAccessor(w.positions, 'VEC3'));
      prim.setAttribute('NORMAL', makeAccessor(w.normals, 'VEC3'));
      if (p.uv !== false) prim.setAttribute('TEXCOORD_0', makeAccessor(w.uvs, 'VEC2'));
      if (p.color && w.colors) prim.setAttribute('COLOR_0', makeAccessor(w.colors, 'VEC3'));
      const maxIndex = w.positions.length / 3;
      prim.setIndices(makeAccessor(maxIndex < 65535 ? Uint16Array.from(w.indices) : w.indices, 'SCALAR'));
      mesh.addPrimitive(prim);
    }
    meshCache.set(key, mesh);
    return mesh;
  }

  function addNode(parent, spec) {
    const node = doc.createNode(spec.name);
    if (spec.translation) node.setTranslation(spec.translation.map(Math.fround));
    if (spec.rotation) node.setRotation(spec.rotation.map(Math.fround));
    if (spec.prims) {
      const mesh = makeMesh(spec.name, spec.prims);
      if (mesh) node.setMesh(mesh);
    }
    for (const child of spec.children ?? []) addNode(node, child);
    if (parent === scene) scene.addChild(node); else parent.addChild(node);
    used.add(spec.name);
    return node;
  }

  for (const spec of nodes) addNode(scene, spec);

  const io = new NodeIO();
  io.setLogger(new Logger(Logger.Verbosity.ERROR));
  return await io.writeBinary(doc);
}
