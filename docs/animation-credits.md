# Player character and animation pipeline

The shipped player asset is `public/assets/player/dr-manaus-character.glb`. It contains the native **Superhero Male FullBody** mesh from Quaternius Universal Base Characters, one 65-joint skeleton, and the selected gameplay animations. The runtime does not recreate bones, skin weights, or bind matrices.

## Asset sources

- **Universal Base Characters (Standard)** by Quaternius supplies the adult Superhero Male mesh, skeleton, weights, and bind pose.
- **Universal Animation Library (Standard)** and **Universal Animation Library 2 (Standard)** by Quaternius supply locomotion, jumping, parkour, punches, hit reactions, and utility clips.
- **Ultimate Modular Men Pack** by Quaternius supplies the authored `Kick_Left` and `Kick_Right` clips. The Standard UAL downloads do not contain kicks, so no unrelated slide, roll, or hook is relabelled as one.
- The Quaternius download pages identify these game assets as free for personal and commercial projects. The source downloads used for this build include their license files and stay under the ignored `artifacts/animations/source` directory.

## Build architecture

`scripts/build-player-character.mjs` performs all retargeting once at build time:

1. Loads Superhero Male as the canonical mesh and rig.
2. Loads only the selected UAL1 and UAL2 clips.
3. Converts each source rest-pose rotation into the canonical character rest pose.
4. Redirects every animation channel to the canonical bone with the same name.
5. Samples and world-space retargets the two CC0 FBX kick clips to the same canonical rig.
6. Removes duplicate scenes, rigs, materials, textures, and unused properties.
7. Writes one final GLB for `GLTFLoader` and `AnimationMixer`.

The duplicate-rig canonicalization follows the technique documented by Station Sciences in `bot-crossing/tools/build-crew.mjs`. The runtime crossfade and one-shot queue follow the public `kaykit_char` examples: both actions are enabled and played before `crossFadeTo`, while `LoopOnce` completion returns to locomotion through the mixer's `finished` event.

At runtime, `CharacterAsset.ts` clones the native skinned scene with `SkeletonUtils`, and `CharacterModel.ts` replaces each skinned mesh material with the one shared `CosmicMaterial`. `visualRoot` owns scale and sole alignment. `flightRoot` owns flight orientation and the external double-jump rotation. The animation mixer alone owns skeleton transforms.

## Validation

Run:

```text
npm run assets:player
npm run validate:player
npm test
npm run build
```

The Animation Lab is available at `?animationLab=1` and includes a ground grid, skeleton helper, clip selector, play/pause, speed, scrubber, and front/side/back views.

References:

- https://quaternius.com/packs/universalbasecharacters.html
- https://quaternius.com/packs/universalanimationlibrary.html
- https://quaternius.com/packs/universalanimationlibrary2.html
- https://quaternius.com/packs/ultimatemodularcharacters.html
- https://github.com/sketchpunklabs/kaykit_char
- https://github.com/Station-Sciences/bot-crossing
- https://threejs.org/examples/webgl_animation_skinning_blending.html
