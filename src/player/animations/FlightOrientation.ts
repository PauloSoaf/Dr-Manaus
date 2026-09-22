import { Quaternion, Vector3, Matrix4 } from 'three/webgpu';

const tmpDir = new Vector3();
const tmpChest = new Vector3();
const tmpRight = new Vector3();
const tmpMatrix = new Matrix4();
const tmpQTarget = new Quaternion();
const worldDown = new Vector3(0, -1, 0);
const worldUp = new Vector3(0, 1, 0);
const tmpBankAxis = new Vector3();
const bankQ = new Quaternion();
const prevChest = new Vector3();
const targetZ = new Vector3();

/**
 * Computes the 3D visual orientation for flight based on velocity.
 * 
 * Target Coordinate System:
 * - Local +Y (Head axis) points towards the flight velocity.
 * - Local -Z (Chest axis) points towards the ground (`worldDown`) as much as possible, 
 *   ensuring the character flies "belly down".
 */
export function computeFlightOrientation(
  velocity: Vector3,
  currentOrientation: Quaternion,
  dt: number,
  bank: number,
  speedMode: string,
  outQuaternion: Quaternion,
  facingYaw = 0
): void {
  const speedSq = velocity.lengthSq();
  
  if (speedSq < 1.0) {
    // Too slow for aerodynamic flight alignment. Fallback to upright facing yaw.
    tmpQTarget.setFromAxisAngle(worldUp, facingYaw);
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
        tmpChest.set(0, 0, -1).applyAxisAngle(worldUp, facingYaw);
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
    tmpQTarget.setFromRotationMatrix(tmpMatrix);
  }

  // Determine responsiveness based on speed mode
  let response = 8;
  switch (speedMode) {
    case 'fast': response = 10; break;
    case 'super': response = 14; break;
    case 'mega': response = 18; break;
  }

  // Smooth approach to target orientation using slerp
  const t = 1 - Math.exp(-dt * response);
  
  // Choose shortest path for slerp
  if (outQuaternion.dot(tmpQTarget) < 0) {
    tmpQTarget.x *= -1;
    tmpQTarget.y *= -1;
    tmpQTarget.z *= -1;
    tmpQTarget.w *= -1;
  }
  outQuaternion.slerp(tmpQTarget, t);

  // Apply bank if provided
  if (Math.abs(bank) > 0.01) {
    // Determine the axis to bank around. In flight, it's the Y axis (head). On ground, it's the Z axis?
    // Wait, bank is applied to the rootOrientation. 
    // In local space, banking is rotating around +Y.
    // Wait, if we apply it after slerping the global quaternion, we should rotate around the *local* Y axis.
    tmpBankAxis.set(0, 1, 0).applyQuaternion(outQuaternion);
    bankQ.setFromAxisAngle(tmpBankAxis, -bank * 0.4); 
    outQuaternion.premultiply(bankQ);
  }
}
