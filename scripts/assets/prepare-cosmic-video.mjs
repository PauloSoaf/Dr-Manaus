/** Offline adaptation of licensed stock footage; runtime never contacts the source. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [original, output = 'public/assets/cosmic', startText = '2'] = process.argv.slice(2);
if (!original) throw new Error('Usage: COSMIC_SOURCE_URL=... COSMIC_SOURCE_LICENCE=... node scripts/assets/prepare-cosmic-video.mjs ORIGINAL [OUTPUT_DIR] [START_SECONDS]');
// ffmpeg is told to strip every tag below, so provenance survives only if it is captured HERE.
// The first run of this script shipped a clip nobody could licence; that must not repeat.
const sourceUrl = process.env.COSMIC_SOURCE_URL;
const sourceLicence = process.env.COSMIC_SOURCE_LICENCE;
if (!sourceUrl || !sourceLicence) {
  throw new Error('Set COSMIC_SOURCE_URL and COSMIC_SOURCE_LICENCE so the asset can be attributed. '
    + 'Optionally COSMIC_SOURCE_AUTHOR and COSMIC_SOURCE_ID.');
}
const start = Number(startText);
if (!Number.isFinite(start) || start < 0) throw new Error('START_SECONDS must be nonnegative');
const destination = path.resolve(output);
mkdirSync(destination, { recursive: true });
function resolveFFmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  if (spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0) return 'ffmpeg';
  const result = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8', windowsHide: true });
  if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  throw new Error('Install ffmpeg or run python -m pip install --user imageio-ffmpeg; alternatively set FFMPEG_PATH.');
}
const ffmpeg = resolveFFmpeg();
function run(args) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'warning', '-y', ...args], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.status}`);
}
// A 9-second interval becomes an 8-second circular sequence. Its final second
// blends into the preceding source second, so the last/first frames remain adjacent.
const grade = 'colorchannelmixer=rr=0.65:rb=0.85:gg=0.65:gb=0.15:br=0.2:bb=1.65,eq=contrast=1.12:saturation=1.3:gamma=1.08';
const filter = `[0:v]fps=24,scale=960:540:force_original_aspect_ratio=increase,crop=960:540,setsar=1,${grade},split=2[tail][head];[tail]trim=start=1:end=9,setpts=PTS-STARTPTS,fps=24,settb=1/24[a];[head]trim=start=0:end=1,setpts=PTS-STARTPTS,fps=24,settb=1/24[b];[a][b]xfade=transition=fade:duration=1:offset=7,format=yuv420p[v]`;
const mp4 = path.join(destination, 'galaxy.mp4');
run(['-ss', String(start), '-t', '9', '-i', path.resolve(original), '-filter_complex', filter, '-map', '[v]', '-an', '-t', '8', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '1800k', '-bufsize', '3600k', '-profile:v', 'high', '-level', '3.1', '-g', '48', '-keyint_min', '24', '-movflags', '+faststart', '-map_metadata', '-1', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', mp4]);
run(['-i', mp4, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '31', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', '-g', '48', '-map_metadata', '-1', path.join(destination, 'galaxy.webm')]);
run(['-ss', '2', '-i', mp4, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '88', path.join(destination, 'fallback.webp')]);
const files = Object.fromEntries(['galaxy.mp4', 'galaxy.webm', 'fallback.webp'].map(file => [file, statSync(path.join(destination, file)).size]));
const total = Object.values(files).reduce((sum, size) => sum + size, 0);
if (total > 3 * 1024 * 1024) throw new Error(`Assets exceed 3 MiB: ${total}. Reduce bitrate/CRF before committing.`);
const metadata = { width: 960, height: 540, fps: 24, seconds: 8, sourceStart: start, blendSeconds: 1, audio: false,
  source: { url: sourceUrl, licence: sourceLicence, author: process.env.COSMIC_SOURCE_AUTHOR ?? null,
    id: process.env.COSMIC_SOURCE_ID ?? null, preparedAt: new Date().toISOString() }, codecs: { mp4: 'H.264 High / yuv420p', webm: 'VP9 / yuv420p' }, files, totalBytes: total };
writeFileSync(path.join(destination, 'asset-info.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
