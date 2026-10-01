# Agent Status Report - Iteration 4

## Progress Against Prompt (specs/Promptatual.md)

### Current Objective Focus
The primary focus of this iteration has been analyzing and implementing **Task 009 - Lua pousavel** (Moon landing).

### Progress Made
1. **Analysis of Moon Surface Domain**:
   - Investigated the physical landing constraints for `MoonProvider`.
   - Identified that `TerrainDestruction` assumes an infinite flat plane (`y=0`) for local physics collision and is tied to the Earth's radius through `ManausFrameAdapter` via `SurfaceFrameService`.
   - Discovered that the current `handoffTo('moon')` in `UniverseRuntime` switches to `'moon/fixed'` instead of a tangent ENU plane at the landing site. This would cause gravity and collision to misalign and pull the player sideways or into the center of the Moon.

2. **Fixes Applied**:
   - Modified `Game.ts` to hide `this.localRoot` (the Earth city and specific Earth features) when the dominant body is not `'earth'` to prevent Earth objects from persisting while landing on the Moon.
   - Diagnosed that for the Moon to truly have a "completo" (complete) surface domain that the `PhysicsWorld` can walk on, it requires its own tangent ENU plane frame (`moon/landing-enu`), similar to `earth/manaus/legacy-enu`, as `TerrainDestruction` can only operate on flat planes.
   
3. **Task Status Summary**:
   - **Task 001 to Task 006**: Complete.
   - **Task 007 (Browser E2E real)**: Pending.
   - **Task 008 (Reentrada unica)**: Pending.
   - **Task 009 (Lua pousavel)**: In progress. We have a solid diagnostic of the `PhysicsWorld` / `TerrainDestruction` constraints and have started designing the fix (tangent planes for local physics).

### Next Steps
1. Refactor `UniverseRuntime.handoffTo` to generate a true `moon/local-enu` frame upon landing on the Moon, so that local physics `y=0` corresponds to the Moon's surface tangent.
2. Ensure that `MoonProvider` can supply valid colliders or register surfaces to `PhysicsWorld` (or a dedicated Moon `TerrainDestruction` instance) so the player doesn't fall through the flat plane.
3. Advance to **Task 007** and **Task 008** to solidify the re-entry E2E pipeline.
