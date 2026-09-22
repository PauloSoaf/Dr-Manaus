# Character animations

Walk, sprint, airborne jump, jump start (vault), jab and cross keyframes: Quaternius, Universal Animation Library Standard & Universal Animation Library 2, CC0 1.0.

- Author: https://quaternius.com/packs/universalanimationlibrary.html
- Universal Animation Library 2: https://quaternius.com/packs/universalanimationlibrary2.html
- Original downloads: https://opengameart.org/content/universal-animation-library
- Secondary reference (CC0): [KayKit Character Animations](https://opengameart.org/content/kaykit-character-animations)
- License: https://creativecommons.org/publicdomain/zero/1.0/

## Animation Architecture & Layered AnimationController

`src/player/animations/AnimationController.ts` orchestrates skeletal pose composition through decoupled layers:
1. **BaseLocomotionLayer**: Walk, run, sprint cadence scaled with character size ($cadence \propto 1 / \sqrt{size}$).
2. **JumpLayer**: Grounded -> JumpRise -> JumpApex -> DoubleJumpFlip -> Fall -> Landing. Double Jump executes an agile 360° flip with decoupled physics (the collision capsule stays upright; the visual mesh completes a mathematically exact identity rotation with 0 cumulative quaternion drift). Flip duration scales moderately with scale ($duration \propto size^{0.16}$).
3. **FlightLayer**: Full 3D aerodynamic orientation driven by velocity vector ($forward = \text{normalize}(velocity)$) with roll banking. Flight poses:
   - Hover (Parade Rest: hands meet behind hips, straight legs, vertical posture).
   - Fast / Super / Mega: aerodynamic forward alignment, stabilized limbs, expanded cosmic aura.
   - Braking & Takeoff launch transitions.
4. **CombatLayer & Bone Masking**: Data-oriented combat state machine (`CombatMove`) supporting concurrent flight and combat:
   - In flight, the upper body plays punches/strikes while the lower body and hips maintain flight vector orientation.
   - Attacks include Flying Punch, Flying Kick, Meteor Punch (downward aerial dive causing ground craters), and Kinetic Strike (at velocities $> 800$ m/s with supersonic shockwave ring, debris, and structural damage).
   - Swept attack collision between previous hand position and current hand position prevents tunneling through buildings at supersonic speeds.
5. **AdditiveLayer**: Breathing micro-motion and subtle head tracking.
6. **TitanLayer & TitanGroundSupport**:
   - Footprint area support and grace periods prevent giant/titan forms from triggering false fall animations when crushing buildings underfoot.
   - Visual fall animation for titans is only triggered when vertical velocity is strongly negative and fall distance exceeds $15\%$ of character height.
   - Titan footsteps trigger swept footstep volume crushing and seismic camera impulses on contact keyframes.

## Soft Targeting & Hit Stop

- `src/player/combat/SoftTargeting.ts`: Subtle assist cone ($10^\circ \text{ to } 18^\circ$) scoring targets by angle, distance, and priority (enemy > destructible target > vehicle > building) without hard lock-on or snapping camera rotation.
- `src/player/combat/HitStopSystem.ts`: Impact weight simulation using brief local combat freezes ($15\text{ms}$ light punch, $30\text{ms}$ heavy kick, $50\text{ms}$ meteor punch, $65\text{ms}$ kinetic strike) without pausing world streaming or physics maintenance.

## Regenerate from the Standard ZIP

```sh
node scripts/import-quaternius.mjs "path/to/AnimationLibrary_Godot_Standard.glb"
```

## Hover posture and fast-flight camera references

- Free posture reference: [Parade Rest, EJ Hersom / US Department of Defense](https://commons.wikimedia.org/wiki/File:Parade_Rest_(14712101932).jpg), marked public domain on Commons. Used as a posture reference; the photograph is not packaged in the game. Arms are solved to meet behind the lower back, with symmetric shoulders and separated, straight legs.
- [Unity Cinemachine Third Person Follow](https://docs.unity.cn/Packages/com.unity.cinemachine@3.1/manual/CinemachineThirdPersonFollow.html): subject-relative distance and damped camera rig.
- [Unreal Spring Arm](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/USpringArmComponent): bounded camera lag and collision handling.
