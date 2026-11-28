/**
 * Builds the pedestrian body pack: Quaternius' Superhero Female body (same 65-bone Universal rig as
 * the hero, CC0) plus the kit's hairstyles baked into the head bone's local space, so the runtime can
 * parent any hairstyle to any NPC's `Head` bone. Male pedestrians reuse the hero's own mesh, which
 * is already loaded at boot.
 *
 *   node scripts/assets/build-npc-bodies.mjs
 *
 * Output: public/assets/npc/npc-bodies.glb
 *   - `npc_female` armature with the skinned body, eyes and eyebrows (materials stripped; the game
 *     dresses pedestrians with its own palette materials)
 *   - `hair_<style>` static meshes in Head-bone space: long, buns, buzzed, buzzed_female,
 *     simple_parted, beard
 */
import { existsSync, mkdirSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, mergeDocuments } from '@gltf-transform/functions';
import { Matrix4, Vector3 } from 'three';

const ROOT = 'artifacts/animations/source/extracted/quaternius-base-characters/Universal Base Characters[Standard]';
const FEMALE = `${ROOT}/Base Characters/Godot - UE/Superhero_Female_FullBody.gltf`;
const HAIR_DIR = `${ROOT}/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;
const STYLES = { long: 'Hair_Long', buns: 'Hair_Buns', buzzed: 'Hair_Buzzed', buzzed_female: 'Hair_BuzzedFemale', simple_parted: 'Hair_SimpleParted', beard: 'Hair_Beard' };
const OUT = 'public/assets/npc/npc-bodies.glb';

if (!existsSync(FEMALE)) { console.log('build-npc-bodies: source pack absent; keeping the shipped file.'); process.exit(0); }

const io = new NodeIO();
const doc = await io.read(FEMALE);
const root = doc.getRoot();
for (const texture of root.listTextures()) texture.dispose();
for (const material of root.listMaterials()) material.dispose();
// Name the armature so the runtime can find it.
const scene = root.getDefaultScene() ?? root.listScenes()[0];
for (const node of scene.listChildren()) if (node.listChildren().some(c => c.getName() === 'root')) node.setName('npc_female');

const buffer = root.listBuffers()[0];
for (const [style, file] of Object.entries(STYLES)) {
  const hairDoc = await io.read(`${HAIR_DIR}/${file}.gltf`);
  const hairRoot = hairDoc.getRoot();
  const skin = hairRoot.listSkins()[0];
  const joints = skin.listJoints();
  const headIndex = joints.findIndex(j => j.getName() === 'Head');
  if (headIndex < 0) throw new Error(`${file}: no Head joint`);
  const ibm = new Matrix4().fromArray(skin.getInverseBindMatrices().getElement(headIndex, []));
  const normalMatrix = new Matrix4().copy(ibm).invert().transpose();
  const meshNode = hairRoot.listNodes().find(n => n.getMesh());
  const sourcePrim = meshNode.getMesh().listPrimitives()[0];
  const pos = sourcePrim.getAttribute('POSITION'), nor = sourcePrim.getAttribute('NORMAL'), uv = sourcePrim.getAttribute('TEXCOORD_0');
  const count = pos.getCount();
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3);
  const v = new Vector3(), e = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    pos.getElement(i, e); v.fromArray(e).applyMatrix4(ibm); v.toArray(positions, i * 3);
    if (nor) { nor.getElement(i, e); v.fromArray(e).transformDirection(normalMatrix); v.toArray(normals, i * 3); }
  }
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(sourcePrim.getIndices().getArray())).setBuffer(buffer));
  if (nor) prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer));
  if (uv) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(Float32Array.from(uv.getArray())).setBuffer(buffer));
  const mesh = doc.createMesh(`hair_${style}`).addPrimitive(prim);
  scene.addChild(doc.createNode(`hair_${style}`).setMesh(mesh));
  console.log(`  hair_${style}: ${count} vertices, ${prim.getIndices().getCount() / 3} triangles`);
}
void mergeDocuments;
root.getAsset().copyright = 'Quaternius Universal Base Characters [Standard] - CC0 1.0 (https://quaternius.com)';
await doc.transform(dedup(), prune({ keepAttributes: false }));
mkdirSync('public/assets/npc', { recursive: true });
await io.write(OUT, doc);
console.log(`build-npc-bodies: ${OUT}`);
