# Character animations

Walk, sprint, airborne jump, jump start (vault) and jab keyframes: Quaternius, Universal Animation Library Standard, CC0 1.0.

- Author: https://quaternius.com/packs/universalanimationlibrary.html
- Original download: https://opengameart.org/content/universal-animation-library
- License: https://creativecommons.org/publicdomain/zero/1.0/

`src/player/animations/quaternius.json` contains retargeted rotations for the existing 11-bone character (66 KB). Source meshes, textures and unused clips are excluded. Root motion is discarded so collision physics owns movement. Hands retain the simplified rig. The kick is procedural.

Regenerate from the Standard ZIP:

```sh
node scripts/import-quaternius.mjs "path/to/AnimationLibrary_Godot_Standard.glb"
```

Controls: F5 cycles rear, shoulder and first person. Space jumps, then double jumps; moving toward a reachable low ledge while jumping boosts the jump for parkour with normal swept collision. Shift runs; B runs at 120 m/s; V arms mega speed (650 m/s while holding B). Ground speeds scale with size, capped at 3000 m/s. Above 420 m/s the pre-movement sweep destroys contacted obstacles and refreshes colliders with bounded collapse work.

X toggles energy/melee. In melee, left click punches and right click kicks. Contact is delayed to match the animation and uses a forward collision query. Reach and damage scale with character size.
