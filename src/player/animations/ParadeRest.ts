import { Quaternion, Vector3 } from 'three/webgpu';

// Public-domain parade-rest reference credited in docs/animation-credits.md.
// Shoulders level, elbows behind the torso, wrists together at the lower back.
function arm(side: number): [Quaternion, Quaternion] {
  const upperRest = new Vector3(side * .03, -.31, -.007);
  const lowerRest = new Vector3(side * .01, -.295, -.009);
  const shoulder = new Vector3(side * .275, 1.64, 0);
  const direction = new Vector3(side * .25, 1.35, .12).sub(shoulder).normalize();
  const upper = new Quaternion().setFromUnitVectors(upperRest.clone().normalize(), direction);
  const elbow = shoulder.addScaledVector(direction, upperRest.length());
  const wristDirection = new Vector3(side * .015, 1.20, .20).sub(elbow).normalize().applyQuaternion(upper.clone().invert());
  return [upper, new Quaternion().setFromUnitVectors(lowerRest.normalize(), wristDirection)];
}
const left = arm(-1), right = arm(1);
export const PARADE_REST = [left[0], right[0], left[1], right[1]];
