import fs from 'node:fs';
import path from 'node:path';

/**
 * Extracts the Ponte Rio Negro deck centreline from the compiled road network.
 *
 * The crossing exists in Overture as two `trunk` carriageways with the same name, running in
 * opposite directions. Averaging them at matched arc length gives the deck centreline, and their
 * separation gives the deck width — they run about 7 m apart over the navigation span and fan out
 * to nearly 60 m into the interchange ramps, which a fixed-width deck cannot represent.
 *
 * Re-run this whenever the projection origin changes: the bundled centreline is in world metres.
 */
const root = process.cwd();
const roadsFile = path.join(root, 'public', 'geodata', 'real-city', 'roads.json');
const outFile = path.join(root, 'src', 'world', 'geodata', 'bridge.json');
const NAME = /^ponte sobre o rio negro$/i;
const SAMPLES = 96;

const roads = JSON.parse(fs.readFileSync(roadsFile, 'utf8'));
const parts = roads.filter(road => NAME.test((road.name ?? '').trim()));
if (parts.length !== 2) throw new Error(`Esperava duas pistas da ponte, encontrei ${parts.length}.`);

function length(p) {
  let total = 0;
  for (let k = 2; k < p.length; k += 2) total += Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]);
  return total;
}

function at(p, t) {
  const total = length(p);
  let want = t * total, walked = 0;
  for (let k = 2; k < p.length; k += 2) {
    const step = Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]);
    if (walked + step >= want) {
      const f = step ? (want - walked) / step : 0;
      return [p[k - 2] + (p[k] - p[k - 2]) * f, p[k - 1] + (p[k + 1] - p[k - 1]) * f];
    }
    walked += step;
  }
  return [p[p.length - 2], p[p.length - 1]];
}

const [a, b] = parts;
const centerline = [], halfWidth = [];
for (let i = 0; i <= SAMPLES; i++) {
  const t = i / SAMPLES, A = at(a.p, t), B = at(b.p, 1 - t);
  centerline.push(Number(((A[0] + B[0]) / 2).toFixed(2)), Number(((A[1] + B[1]) / 2).toFixed(2)));
  const separation = Math.hypot(A[0] - B[0], A[1] - B[1]);
  halfWidth.push(Number((separation / 2 + a.width * .5 + 1.5).toFixed(2)));
}

const payload = {
  name: 'Ponte sobre o Rio Negro',
  source: 'Overture transportation, both carriageways averaged at matched arc length',
  carriageways: 2, width: a.width, centerline, halfWidth,
};
fs.writeFileSync(outFile, JSON.stringify(payload));

const total = length(centerline);
console.log(`Ponte: ${SAMPLES + 1} amostras, ${total.toFixed(0)} m, largura ${(Math.min(...halfWidth) * 2).toFixed(1)}..${(Math.max(...halfWidth) * 2).toFixed(1)} m`);
console.log(`  extremos (${centerline[0]}, ${centerline[1]}) -> (${centerline[centerline.length - 2]}, ${centerline[centerline.length - 1]})`);
console.log(`  ${JSON.stringify(payload).length} bytes em ${path.relative(root, outFile)}`);
