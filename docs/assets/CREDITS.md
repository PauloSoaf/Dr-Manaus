# Asset credits and provenance

Every third-party asset shipped in `public/assets` is listed here with its source, author, licence and
what was derived from it. Source downloads live in the git-ignored `artifacts/` tree; the shipped files
are rebuilt from them by the scripts named below.

## Character animation

Built by `scripts/assets/build-character-animations.mjs` into
`public/assets/player/dr-manaus-character.glb` (core clips) and
`public/assets/player/animation-library.glb` (social and pedestrian clips). Per-clip provenance,
crop windows and measurements are in `src/player/animations/clipCatalog.json`.

| Source | Author | Licence | URL | Used for |
| --- | --- | --- | --- | --- |
| Universal Base Characters [Standard] | Quaternius | CC0 1.0 | https://quaternius.com/packs/universalbasecharacters.html | Hero mesh, 65-bone rig, bind pose |
| Universal Animation Library [Standard] | Quaternius | CC0 1.0 | https://quaternius.com/packs/universalanimationlibrary.html | Idle, walk, jog, sprint, jumps, roll, punches, crouch, sit, drive, talk, casting, pushing |
| Universal Animation Library 2 [Standard] | Quaternius | CC0 1.0 | https://quaternius.com/packs/universalanimationlibrary2.html | Fold-arms hover, hook, ninja jump, slide, climb, phone, yes/no, carry, rail, get-up |
| Ultimate Modular Men (Animations.fbx) | Quaternius | CC0 1.0 | https://quaternius.com/packs/ultimatemodularcharacters.html | Front kicks, guarded punches, strafe/back/forward combat runs, wave, hit reactions |
| KayKit Character Animations 1.1 | Kay Lousberg | CC0 1.0 | https://kaylousberg.com/game-assets/character-animations | Push kick, directional dodges, magic raise/summon, ground spawn (teleport arrival), cheering |
| CMU Graphics Lab Motion Capture Database | Carnegie Mellon University (NSF EIA-0196217) | Free to use in products; the data itself may not be resold | http://mocap.cs.cmu.edu/ | Side kick (135_11), roundhouse (135_07), jumping spin kick (88_06), karate guard stance (135_04) |

### Derivation applied

- All clips are retargeted onto the hero's 65-bone Universal rig. Same-skeleton UAL clips use the
  local-delta transfer; every other source uses world-space retargeting with reference-posture
  alignment (`scripts/assets/lib/retarget.mjs`).
- CMU takes are cropped to single moves, turned to face forward, and resampled from 120 to 30 fps.
- Spinning kicks have their body yaw extracted as root motion; strikes are turned so they land on
  the character's forward axis.
- Cross-rig clips get a constant floor calibration so contact frames rest on the floor.
- Loops are closed by spreading the end-to-start mismatch; static tracks are reduced to one key.
- The interact reach is mirrored to make a right-hand version.

The earlier `Kick_Left`/`Kick_Right` clips were a broken import of the Modular Men kicks: the old
build applied the source's local-frame rotation delta in the target's frame, which only works when
both bones share axes, so the knee folded about the wrong axis. Those clips are no longer shipped.

## Tooling references

- Duplicate-rig canonicalisation follows Station-Sciences/bot-crossing (MIT).
- ASF/AMC parsing follows the Acclaim specification as used by the CMU database.

<!-- vehicles:begin -->
## Vehicles

Source: **Kenney Car Kit 3.1** by Kenney (www.kenney.nl) - https://kenney.nl/assets/car-kit - licence CC0 1.0.
Built by `scripts/assets/build-vehicles.mjs` into `public/assets/vehicles/` (GLB + `vehicles.json`).

| id | Kenney source file | category | derivation applied |
| --- | --- | --- | --- |
| hatch | hatchback-sports.glb | Hatch compacto | uniform scale ×1.55; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| sedan | sedan.glb | Sedã popular | uniform scale ×1.55; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| sedan_exec | sedan-sports.glb | Sedã executivo | uniform scale ×1.55; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| suv | suv.glb | SUV | uniform scale ×1.6; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| pickup | truck.glb | Picape | uniform scale ×1.6; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| sports | race.glb | Esportivo | uniform scale ×1.55; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting; open-wheel single-seater (no roof or door panels, centred driver seat) |
| taxi | taxi.glb | Táxi | uniform scale ×1.55; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| security | police.glb | Carro de segurança | uniform scale ×1.55; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting; fixed livery (not tintable) |
| van | van.glb | Van | uniform scale ×1.6; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| cargo | delivery.glb | Utilitário de carga | uniform scale ×1.65; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| luxury | suv-luxury.glb | Carro de luxo | uniform scale ×1.6; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| future | race-future.glb | Conceito futurista | uniform scale ×1.55; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting; open-wheel single-seater (no roof or door panels, centred driver seat) |
| flatbed | truck-flat.glb | Caminhonete de carroceria | uniform scale ×1.65; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |
| ambulance | ambulance.glb | Ambulância | uniform scale ×1.65; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting; fixed livery (not tintable) |
| firetruck | firetruck.glb | Caminhão de bombeiros | uniform scale ×1.7; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting; fixed livery (not tintable) |
| garbage | garbage-truck.glb | Caminhão de lixo | uniform scale ×1.7; glass split; driver/passenger door panels cut from the shell; interior, seats, dashboard and steering wheel added; paint split for tinting |

No antique car exists in the pack; the category "Carro antigo" is listed as `missingCategories` in the manifest.
<!-- vehicles:end -->
