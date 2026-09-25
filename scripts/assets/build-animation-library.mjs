/**
 * Builds the optional animation library the character can borrow clips from.
 *
 * Source: Quaternius "Universal Animation Library 2 [Standard]", CC0 1.0 Public Domain. Its rig is
 * the same 65-bone skeleton the player character uses — same bone names, one for one — so its
 * clips play on the hero without retargeting.
 *
 * The shipped file is derived, not the download: meshes, skins, materials and textures are
 * dropped, clips the character already owns are dropped, and the binary buffer is rebuilt so it
 * holds only the keyframes that survived. Without that last step the file keeps all 7.7 MB of the
 * original buffer no matter what the JSON references.
 *
 *   node scripts/assets/build-animation-library.mjs [path-to-UAL2_Standard.glb]
 *
 * With no argument it reads the zip in the repository root.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_GLB = 'public/assets/player/animation-library.glb';
const OUT_MANIFEST = 'src/player/animations/libraryManifest.json';
const ZIP = 'Quaternius_UniversalAnimationLibrary2.zip';
const ZIP_ENTRY = 'Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb';
const CHARACTER = 'public/assets/player/dr-manaus-character.glb';

function readGlb(file) { return parseGlb(fs.readFileSync(file)); }

function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.slice(20, 20 + jsonLength).toString('utf8'));
  let offset = 20 + jsonLength;
  let bin = Buffer.alloc(0);
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === 0x004e4942) bin = buffer.slice(offset + 8, offset + 8 + length);
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  return { json, bin };
}

function writeGlb(file, json, bin) {
  const jsonText = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = (4 - (jsonText.length % 4)) % 4;
  const binPad = (4 - (bin.length % 4)) % 4;
  const jsonChunk = Buffer.concat([jsonText, Buffer.alloc(jsonPad, 0x20)]);
  const binChunk = Buffer.concat([bin, Buffer.alloc(binPad, 0)]);
  const total = 12 + 8 + jsonChunk.length + (binChunk.length ? 8 + binChunk.length : 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const parts = [header, jsonHeader, jsonChunk];
  if (binChunk.length) {
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binChunk.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
    parts.push(binHeader, binChunk);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat(parts));
}

/**
 * Reads one entry out of a zip. Shelling out to `unzip` is not reliable here: the entry name
 * contains brackets it reads as a wildcard class, and the MSYS build re-parses the Windows
 * command line, so the argument never arrives intact.
 */
function readZipEntry(zipFile, entryName) {
  const zip = fs.readFileSync(zipFile);
  // End of central directory: scan back for its signature, past any trailing comment.
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0 && i > zip.length - 66_000; i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`${zipFile} has no end-of-central-directory record`);
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);

  for (let entry = 0; entry < count; entry++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('corrupt central directory');
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.slice(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (name === entryName) {
      const localNameLength = zip.readUInt16LE(localOffset + 26);
      const localExtraLength = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = zip.slice(start, start + compressedSize);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`${entryName} uses compression method ${method}`);
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${entryName} is not in ${zipFile}`);
}

function sourceBuffer() {
  const given = process.argv[2];
  if (given) return { buffer: fs.readFileSync(given), label: given };
  if (!fs.existsSync(ZIP)) {
    throw new Error(`Neither a path argument nor ${ZIP} was found. Pass the UAL2_Standard.glb path.`);
  }
  return { buffer: readZipEntry(ZIP, ZIP_ENTRY), label: `${ZIP}:${ZIP_ENTRY}` };
}

const { buffer: sourceBytes, label: sourceLabel } = sourceBuffer();
const library = parseGlb(sourceBytes);
const character = readGlb(CHARACTER);

// The clips must play on the character's own skeleton, so the bone names have to agree exactly.
const characterBones = new Set(character.json.skins[0].joints.map(i => character.json.nodes[i].name));
const libraryBones = library.json.skins?.[0]?.joints.map(i => library.json.nodes[i].name) ?? [];
const mismatched = libraryBones.filter(name => !characterBones.has(name));
if (libraryBones.length !== characterBones.size || mismatched.length) {
  throw new Error(
    `The library rig does not match the character: ${libraryBones.length} bones vs ${characterBones.size}` +
    (mismatched.length ? `, unmatched: ${mismatched.slice(0, 8).join(', ')}` : ''),
  );
}

const owned = new Set(character.json.animations.map(a => a.name));
const kept = library.json.animations.filter(a => a.name && !owned.has(a.name) && a.name !== 'A_TPose');
const dropped = library.json.animations.length - kept.length;

// Only the keyframe accessors survive, and the buffer is rebuilt around them.
const bin = [];
let cursor = 0;
const bufferViews = [];
const accessors = [];
const remap = new Map();
function keep(index) {
  if (remap.has(index)) return remap.get(index);
  const accessor = library.json.accessors[index];
  const view = library.json.bufferViews[accessor.bufferView];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  const bytes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[accessor.componentType];
  const length = accessor.count * size * bytes;
  const slice = library.bin.slice(start, start + length);
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { bin.push(Buffer.alloc(pad, 0)); cursor += pad; }
  bin.push(slice);
  bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: length });
  cursor += length;
  const next = accessors.length;
  accessors.push({
    bufferView: bufferViews.length - 1, componentType: accessor.componentType,
    count: accessor.count, type: accessor.type,
    ...(accessor.normalized ? { normalized: true } : {}),
    ...(accessor.min ? { min: accessor.min } : {}), ...(accessor.max ? { max: accessor.max } : {}),
  });
  remap.set(index, next);
  return next;
}

const animations = kept.map(animation => ({
  name: animation.name,
  samplers: animation.samplers.map(sampler => ({
    input: keep(sampler.input), output: keep(sampler.output),
    ...(sampler.interpolation ? { interpolation: sampler.interpolation } : {}),
  })),
  channels: animation.channels.map(channel => ({ sampler: channel.sampler, target: { ...channel.target } })),
}));

// The node hierarchy stays so the clips have something to resolve their targets against; every
// mesh, skin, material and texture goes.
const nodes = library.json.nodes.map(node => {
  const copy = { ...node };
  delete copy.mesh; delete copy.skin; delete copy.camera;
  return copy;
});

const out = {
  asset: {
    version: '2.0',
    generator: 'DR Manaus build-animation-library',
    copyright: 'Quaternius Universal Animation Library 2 (Standard) — CC0 1.0 Public Domain',
  },
  scene: library.json.scene ?? 0,
  scenes: library.json.scenes,
  nodes,
  animations,
  accessors,
  bufferViews,
  buffers: [{ byteLength: cursor }],
};

const binary = Buffer.concat(bin);
out.buffers[0].byteLength = binary.length;
writeGlb(OUT_GLB, out, binary);

const manifest = {
  source: 'Quaternius Universal Animation Library 2 [Standard]',
  licence: 'CC0 1.0 Universal (Public Domain Dedication)',
  url: 'https://quaternius.com/',
  clips: animations.map(a => a.name).sort(),
};
fs.mkdirSync(path.dirname(OUT_MANIFEST), { recursive: true });
fs.writeFileSync(OUT_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

const before = sourceBytes.length;
console.log(`source: ${sourceLabel}`);
console.log(`library rig matches the character: ${libraryBones.length} bones, one for one`);
console.log(`clips kept ${animations.length}, dropped ${dropped} (already in the character, or the T-pose)`);
console.log(`${OUT_GLB}  ${(fs.statSync(OUT_GLB).size / 1048576).toFixed(2)} MB` +
  (before ? ` (from ${(before / 1048576).toFixed(2)} MB)` : ''));
console.log(`${OUT_MANIFEST}  ${manifest.clips.length} names`);
