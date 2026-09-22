# Character animations

Walk, sprint, airborne jump, jump start (vault), jab and cross keyframes: Quaternius, Universal Animation Library Standard, CC0 1.0.

- Author: https://quaternius.com/packs/universalanimationlibrary.html
- Original download: https://opengameart.org/content/universal-animation-library
- License: https://creativecommons.org/publicdomain/zero/1.0/

`src/player/animations/quaternius.json` contains retargeted rotations for the existing 11-bone character (76 KB). Source meshes, textures and unused clips are excluded. Root motion is discarded so collision physics owns movement. Hands retain the simplified rig. Uppercut, front/side/roundhouse kicks and hover/cruise/boost flight are procedural animations on the same skeleton, with no additional draws. Hover uses an upright at-ease stance with hands behind the hips and almost straight legs. Normal flight trails the arms; acceleration extends one arm and boost both. Knee flexion uses negative local X (backward), with smooth takeoff, vertical inclination and turn banking.

Regenerate from the Standard ZIP:

```sh
node scripts/import-quaternius.mjs "path/to/AnimationLibrary_Godot_Standard.glb"
```

Controls: F5 cycles rear, shoulder and first person. Space jumps, then double jumps; moving toward a reachable low ledge while jumping boosts the jump for parkour with normal swept collision. Shift runs; B runs at 120 m/s; V arms mega speed (650 m/s while holding B). Ground speeds scale with size, capped at 3000 m/s. Above 420 m/s the pre-movement sweep destroys contacted obstacles and refreshes colliders with bounded collapse work.

F5 now cycles rear, shoulder, first person, front (facing the character), and backward first-person view. Looking backward does not change the movement heading.

X toggles energy/melee. In melee, left click cycles jab/cross/uppercut; right click cycles front/side/roundhouse kicks. These also animate in the air. Contact is delayed to match the animation and uses a forward collision query. Reach and damage scale with character size.
