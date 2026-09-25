import { Quaternion, Vector3, Matrix4 } from 'three/webgpu';

const tmpDir = new Vector3();
const tmpChest = new Vector3();
const tmpRight = new Vector3();
const tmpMatrix = new Matrix4();
const tmpQTarget = new Quaternion();
const tmpQAero = new Quaternion();
const tmpQUpright = new Quaternion();
const worldDown = new Vector3(0, -1, 0);
const worldUp = new Vector3(0, 1, 0);
const tmpBankAxis = new Vector3();
const bankQ = new Quaternion();
const prevChest = new Vector3();
const targetZ = new Vector3();

export type FlightMode = 'hover' | 'cruise' | 'fast' | 'braking';

export const FLIGHT_ORIENTATION = {
  /** At or below this speed the body is fully upright, whatever it was doing a moment ago. */
  uprightSpeed: 3,
  /** Above this, with the throttle still open, the body is fully aerodynamic. */
  aeroSpeed: 30,
  /**
   * How much further up the speed range the recovery reaches once the player stops asking for
   * speed. Letting go at cruise has to start lifting the chest immediately, not at 3 m/s.
   */
  brakeSpan: 150,
  /** Anything slower than this fraction of the current speed counts as a deliberate stop. */
  brakeRatio: 0.55,
} as const;

const finite = (value: number, fallback = 0): number => (Number.isFinite(value) ? value : fallback);
const clamp01 = (value: number): number => (value > 1 ? 1 : value < 0 ? 0 : value);
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * How upright the body should be right now: 0 is belly-down flight, 1 is standing in the air.
 *
 * The blend is driven by intent as much as by speed. Under power the body stays aerodynamic all
 * the way down to 30 m/s. The moment the player stops asking for speed, the window opens to
 * 180 m/s, so the chest is already coming up while the velocity is still bleeding off — which is
 * the whole point: the rotation happens *during* the deceleration, not after it.
 */
export function uprightBlend(speed: number, desiredSpeed: number): number {
  const v = Math.max(0, finite(speed));
  const want = Math.max(0, finite(desiredSpeed));
  const braking = clamp01(1 - want / Math.max(v, 0.001));
  const upper = FLIGHT_ORIENTATION.aeroSpeed + braking * FLIGHT_ORIENTATION.brakeSpan;
  return 1 - smoothstep(FLIGHT_ORIENTATION.uprightSpeed, upper, v);
}

/** The named phase, for the animation layer and the debug overlay. */
export function flightModeFor(speed: number, desiredSpeed: number, speedMode = 'normal'): FlightMode {
  const v = Math.max(0, finite(speed));
  const want = Math.max(0, finite(desiredSpeed));
  if (v < FLIGHT_ORIENTATION.uprightSpeed && want < FLIGHT_ORIENTATION.uprightSpeed) return 'hover';
  if (want < v * FLIGHT_ORIENTATION.brakeRatio) return 'braking';
  if (v < FLIGHT_ORIENTATION.aeroSpeed) return 'hover';
  return speedMode === 'fast' || speedMode === 'super' || speedMode === 'mega' ? 'fast' : 'cruise';
}

/**
 * Computes the 3D visual orientation for flight based on velocity.
 *
 * Target Coordinate System:
 * - Local +Y (Head axis) points towards the flight velocity.
 * - Local -Z (Chest axis) points towards the ground (`worldDown`) as much as possible,
 *   ensuring the character flies "belly down".
 *
 * `upright` blends that aerodynamic target against simply standing at `facingYaw`. The blend is
 * applied to the *target* rather than to the result, so the body always travels one smooth arc
 * instead of racing between two poses.
 */
export function computeFlightOrientation(
  velocity: Vector3,
  currentOrientation: Quaternion,
  dt: number,
  bank: number,
  speedMode: string,
  outQuaternion: Quaternion,
  facingYaw = 0,
  upright = 0,
): void {
  const speedSq = velocity.lengthSq();
  const lift = clamp01(finite(upright));

  tmpQUpright.setFromAxisAngle(worldUp, finite(facingYaw));

  if (speedSq < 1.0 || lift >= 0.999) {
    // Too slow for aerodynamic flight alignment, or fully recovered. Stand at the facing yaw.
    tmpQTarget.copy(tmpQUpright);
  } else {
    // Main flight alignment
    tmpDir.copy(velocity).normalize();

    // The chest should point down
    // Project worldDown onto the plane perpendicular to the flight direction.
    // chest = worldDown - direction * dot(worldDown, direction)
    const dotDown = worldDown.dot(tmpDir);
    tmpChest.copy(worldDown).addScaledVector(tmpDir, -dotDown);

    if (tmpChest.lengthSq() < 1e-6) {
      // We are flying exactly straight up or straight down.
      // Use the previous chest orientation projected onto the new plane.
      prevChest.set(0, 0, -1).applyQuaternion(currentOrientation);
      const dotPrev = prevChest.dot(tmpDir);
      tmpChest.copy(prevChest).addScaledVector(tmpDir, -dotPrev);

      if (tmpChest.lengthSq() < 1e-6) {
        // Fallback if still degenerate (e.g. character was upside down somehow)
        tmpChest.set(0, 0, -1).applyAxisAngle(worldUp, finite(facingYaw));
        const dotFallback = tmpChest.dot(tmpDir);
        tmpChest.addScaledVector(tmpDir, -dotFallback);
      }
    }

    tmpChest.normalize();

    // Now we have:
    // targetY = tmpDir (head)
    // targetZ = -tmpChest (back, since chest is -Z)
    // targetX = targetY x targetZ (right)
    tmpRight.crossVectors(tmpDir, tmpChest).negate().normalize(); // tmpDir is +Y, -tmpChest is +Z. cross(Y, Z) = X.

    targetZ.copy(tmpChest).negate();

    tmpMatrix.makeBasis(tmpRight, tmpDir, targetZ);
    tmpQAero.setFromRotationMatrix(tmpMatrix);

    if (lift <= 0.001) {
      tmpQTarget.copy(tmpQAero);
    } else {
      if (tmpQAero.dot(tmpQUpright) < 0) tmpQUpright.set(-tmpQUpright.x, -tmpQUpright.y, -tmpQUpright.z, -tmpQUpright.w);
      tmpQTarget.copy(tmpQAero).slerp(tmpQUpright, lift);
    }
  }

  // Determine responsiveness based on speed mode. Righting the body is always a little brisker
  // than banking it, so a stop reads as deliberate rather than as drift.
  let response = 8;
  switch (speedMode) {
    case 'fast': response = 10; break;
    case 'super': response = 14; break;
    case 'mega': response = 18; break;
  }
  response += lift * 6;

  // Smooth approach to target orientation using slerp
  const t = 1 - Math.exp(-Math.max(0, finite(dt)) * response);

  // Choose shortest path for slerp
  if (outQuaternion.dot(tmpQTarget) < 0) {
    tmpQTarget.x *= -1;
    tmpQTarget.y *= -1;
    tmpQTarget.z *= -1;
    tmpQTarget.w *= -1;
  }
  outQuaternion.slerp(tmpQTarget, t);

  // Apply bank if provided. An upright body does not bank, so it fades out with the recovery.
  const banking = finite(bank) * (1 - lift);
  if (Math.abs(banking) > 0.01) {
    // In local space, banking is rotating around +Y (the head axis).
    tmpBankAxis.set(0, 1, 0).applyQuaternion(outQuaternion);
    bankQ.setFromAxisAngle(tmpBankAxis, -banking * 0.4);
    outQuaternion.premultiply(bankQ);
  }
}
