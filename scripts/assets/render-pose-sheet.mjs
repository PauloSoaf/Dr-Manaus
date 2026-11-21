/**
 * Renders a clip of a skinned glTF into a PNG contact sheet (columns = frames, rows = views).
 *
 *   node scripts/assets/render-pose-sheet.mjs --glb public/assets/player/dr-manaus-character.glb \
 *     --clip Kick_Right --frames 8 --views front,side,top --out artifacts/qa/kick.png
 *   --times 0.1,0.3,0.5   explicit clip times in seconds instead of evenly spaced frames
 *   --rest                render the bind pose (no clip)
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadGltf, renderClipSheet } from './lib/pose-renderer.mjs';

const argv = process.argv.slice(2), args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const next = argv[i + 1];
  args[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? 'true' : next;
}
const gltf = await loadGltf(args.glb ?? 'public/assets/player/dr-manaus-character.glb');
const clip = args.rest ? null : gltf.animations.find(c => c.name === args.clip);
if (!args.rest && !clip) {
  console.error(`clip not found: ${args.clip}\navailable: ${gltf.animations.map(c => c.name).join(', ')}`);
  process.exit(1);
}
const frames = Number(args.frames ?? 8);
const times = args.times ? args.times.split(',').map(Number)
  : clip ? Array.from({ length: frames }, (_, i) => (clip.duration * i) / Math.max(1, frames - 1)) : [0];
const views = (args.views ?? 'front,side').split(',');
const sheet = renderClipSheet(gltf.scene, clip, {
  times, views, panelWidth: Number(args.w ?? 170), panelHeight: Number(args.h ?? 230), heightMeters: Number(args.meters ?? 2.6),
});
const out = args.out ?? `artifacts/qa/${args.clip ?? 'rest'}.png`;
mkdirSync(dirname(out), { recursive: true });
sheet.save(out);
console.log(`${out}  ${clip ? `${clip.name} ${clip.duration.toFixed(2)}s` : 'rest'}  times=${times.map(t => t.toFixed(2)).join(',')}`);
