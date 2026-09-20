# Cosmic skin footage

The character's skin samples a short galaxy clip in screen space. The files here are a derived,
re-encoded excerpt, not the original download.

## ⚠ Source not recorded — must be filled in before distribution

**The provenance of the original clip was not captured when these files were produced, and cannot
be recovered from them.** `scripts/assets/prepare-cosmic-video.mjs` takes the original as a command
line argument and passes `-map_metadata -1` to ffmpeg, which strips every embedded tag, so nothing
in `galaxy.mp4`, `galaxy.webm`, `fallback.webp` or `asset-info.json` identifies where it came from.

Whoever produced these files must complete the table below before the game is published or the
repository is made public. Until then, treat this asset as **unlicensed** — the derivation being
harmless does not make the source permissible.

| Field | Value |
| --- | --- |
| Source site | _unrecorded_ |
| Item / video ID | _unrecorded_ |
| Page URL | _unrecorded_ |
| Author | _unrecorded_ |
| Licence | _unrecorded_ |
| Downloaded on | _unrecorded_ |

The project was directed at footage from Pixabay (Pixabay Content License) or Pexels (Pexels
License), both of which permit free use and modification. **This is the intent, not a record** — do
not copy either licence name into the table without confirming which file was actually used.

## What is verifiable about these files

Produced by `scripts/assets/prepare-cosmic-video.mjs`, which is deterministic given the same input:

- 9 s taken from the original at `sourceStart`, rendered as an 8 s seamless loop; the final second
  cross-fades back into the first so the loop point is invisible.
- Scaled and cropped to 960 × 540 at 24 fps, then graded toward the game's blue-violet palette
  (`colorchannelmixer` plus a contrast/saturation lift).
- `galaxy.mp4` — H.264 High, yuv420p, CRF 20, capped at 1800 kbit/s, faststart.
- `galaxy.webm` — VP9, CRF 31, transcoded from the mp4.
- `fallback.webp` — a single frame, quality 88, shown before the clip decodes.
- No audio track. All metadata stripped. Total budget enforced at 3 MiB by the script itself.

Exact sizes are in `asset-info.json`.

## If the source cannot be established

Delete these three files and re-run the script against a clip whose licence you can record. The
game does not depend on them: `CosmicVideoSource` falls back to a procedural cosmos and the
character still reads as a window onto a universe, which is how it renders in tests and on any
browser that will not decode the video.
