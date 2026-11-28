import type { Vec3 } from '../spatial/units';
import {
  GRAVITATIONAL_CONSTANT,
  SPEED_OF_LIGHT,
  schwarzschildRadiusM,
  kerrHorizonRadiusM,
  iscoRadiusM,
  photonSphereRadiusM,
  type BlackHoleDescriptor,
} from './BlackHoleDescriptor';

/**
 * Proximity classification zones relative to a black hole.
 */
export type BlackHoleProximityZone =
  | 'distant'       // r > 100 * rs: Newtonian / negligible
  | 'influence'     // 10 * rs < r <= 100 * rs: Trajectory curvature detectable
  | 'strong-field'  // r_isco < r <= 10 * rs: Severe gravitational pull, lensing strong
  | 'isco-zone'     // r_+ < r <= r_isco: Unstable orbits, maximum emergency thrust needed
  | 'captured';     // r <= r_+: Inside Kerr event horizon, conventional escape impossible

/**
 * Real-time relativistic telemetry of an entity near a black hole.
 */
export interface BlackHoleProximityState {
  readonly blackHoleId: string;
  readonly distanceM: number;
  readonly radiusRs: number; // Normalized to Schwarzschild radius (r / r_s)
  readonly zone: BlackHoleProximityZone;
  readonly effectiveAccelerationMps2: number;
  readonly accelerationVectorMps2: Vec3;
  readonly escapeVelocityMps: number;
  readonly timeDilationFactor: number; // sqrt(1 - rs / r), clamped to [0, 1]
  readonly lensingIntensity01: number; // [0, 1] optical distortion intensity
  readonly frameDraggingVelocityMps: number; // Lense-Thirring frame dragging
  readonly isCaptured: boolean;
  readonly canEscapeNormally: boolean;
}

/**
 * Paczyński-Wiita pseudo-Newtonian gravitational acceleration:
 * a(r) = GM / (r - rs)^2 for r > rs.
 * Perfectly reproduces Schwarzschild ISCO at 3*rs and models the steep
 * relativistic potential barrier near the event horizon without solving full Einstein tensors per frame.
 */
export function paczynskiWiitaAccelerationMps2(massKg: number, distanceM: number): number {
  if (massKg <= 0 || !Number.isFinite(massKg) || !Number.isFinite(distanceM)) return 0;
  const rs = schwarzschildRadiusM(massKg);
  // Clamping for numerical stability just outside horizon
  const rEffective = Math.max(distanceM - rs, rs * 0.001);
  return (GRAVITATIONAL_CONSTANT * massKg) / (rEffective * rEffective);
}

/**
 * Standard Newtonian gravitational acceleration:
 * a(r) = GM / r^2.
 */
export function newtonianAccelerationMps2(massKg: number, distanceM: number): number {
  if (massKg <= 0 || distanceM <= 0 || !Number.isFinite(distanceM)) return 0;
  return (GRAVITATIONAL_CONSTANT * massKg) / (distanceM * distanceM);
}

/**
 * Newtonian escape velocity: v_esc = sqrt(2GM / r) = c * sqrt(rs / r).
 * At r = rs, v_esc = c.
 */
export function blackHoleEscapeVelocityMps(massKg: number, distanceM: number): number {
  if (massKg <= 0 || distanceM <= 0 || !Number.isFinite(distanceM)) return 0;
  const rs = schwarzschildRadiusM(massKg);
  if (distanceM <= rs) return SPEED_OF_LIGHT;
  return Math.min(SPEED_OF_LIGHT, SPEED_OF_LIGHT * Math.sqrt(rs / distanceM));
}

/**
 * Relativistic gravitational time dilation factor:
 * gamma_t = sqrt(1 - rs / r) for r > rs.
 * Approaches 0 at the horizon (time freezes relative to coordinate observer).
 */
export function gravitationalTimeDilation(massKg: number, distanceM: number): number {
  if (massKg <= 0 || distanceM <= 0 || !Number.isFinite(distanceM)) return 1.0;
  const rs = schwarzschildRadiusM(massKg);
  if (distanceM <= rs) return 0.0;
  return Math.sqrt(Math.max(0, 1.0 - rs / distanceM));
}

/**
 * Lense-Thirring frame dragging equatorial velocity:
 * v_drag = (2 * a* * G^2 * M^2) / (c^3 * r^2).
 */
export function lenseThirringVelocityMps(massKg: number, spin01: number, distanceM: number): number {
  if (massKg <= 0 || spin01 <= 0 || distanceM <= 0) return 0;
  const rs = schwarzschildRadiusM(massKg);
  if (distanceM <= rs * 0.5) return SPEED_OF_LIGHT;
  const aStar = Math.min(Math.max(spin01, 0), 0.998);
  const factor = (aStar * rs * rs * SPEED_OF_LIGHT) / (4 * distanceM * distanceM);
  return Math.min(SPEED_OF_LIGHT, factor);
}

/**
 * Evaluates the comprehensive relativistic telemetry for an observer/ship relative to a black hole.
 */
export function evaluateBlackHoleProximity(
  positionM: Vec3,
  blackHole: BlackHoleDescriptor
): BlackHoleProximityState {
  const dx = positionM[0] - blackHole.positionM[0];
  const dy = positionM[1] - blackHole.positionM[1];
  const dz = positionM[2] - blackHole.positionM[2];
  const distanceM = Math.hypot(dx, dy, dz);

  const rs = blackHole.schwarzschildRadiusM;
  const rHorizon = blackHole.eventHorizonRadiusM;
  const rIsco = blackHole.iscoRadiusM;
  const radiusRs = distanceM / Math.max(rs, 1.0);

  // Unit vector from observer pointing towards the singularity
  const invDist = distanceM > 0 ? 1 / distanceM : 0;
  const toCenterNorm: Vec3 = [-dx * invDist, -dy * invDist, -dz * invDist];

  // Zone determination
  let zone: BlackHoleProximityZone = 'distant';
  let isCaptured = false;

  if (distanceM <= rHorizon) {
    zone = 'captured';
    isCaptured = true;
  } else if (distanceM <= rIsco) {
    zone = 'isco-zone';
  } else if (distanceM <= 10 * rs) {
    zone = 'strong-field';
  } else if (distanceM <= 100 * rs) {
    zone = 'influence';
  } else {
    zone = 'distant';
  }

  // Effective relativistic acceleration
  const effectiveAcc = isCaptured
    ? 1e9 // Extreme inward singularity draw
    : paczynskiWiitaAccelerationMps2(blackHole.massKg, distanceM);

  const accVector: Vec3 = [
    toCenterNorm[0] * effectiveAcc,
    toCenterNorm[1] * effectiveAcc,
    toCenterNorm[2] * effectiveAcc,
  ];

  // Optical gravitational lensing intensity [0, 1]
  // Far field (> 60 rs): 0
  // Scaling up between 60 rs and photon sphere (1.5 rs)
  let lensingIntensity01 = 0;
  if (distanceM <= 60 * rs) {
    const t = (60 * rs - distanceM) / (60 * rs - blackHole.photonSphereRadiusM);
    lensingIntensity01 = Math.min(1.0, Math.max(0, t));
  }

  const escapeVel = blackHoleEscapeVelocityMps(blackHole.massKg, distanceM);
  const timeDilation = gravitationalTimeDilation(blackHole.massKg, distanceM);
  const vDrag = lenseThirringVelocityMps(blackHole.massKg, blackHole.spin01, distanceM);
  const canEscapeNormally = !isCaptured && distanceM > rIsco;

  return {
    blackHoleId: blackHole.id,
    distanceM,
    radiusRs,
    zone,
    effectiveAccelerationMps2: effectiveAcc,
    accelerationVectorMps2: accVector,
    escapeVelocityMps: escapeVel,
    timeDilationFactor: timeDilation,
    lensingIntensity01,
    frameDraggingVelocityMps: vDrag,
    isCaptured,
    canEscapeNormally,
  };
}

/**
 * Integrates one simulation step of relativistic gravity and trajectory bending.
 * Updates velocity by applying Paczyński-Wiita acceleration and Lense-Thirring frame dragging.
 */
export function applyBlackHoleDynamics(
  positionM: Vec3,
  velocityMps: Vec3,
  dt: number,
  blackHole: BlackHoleDescriptor
): { nextPositionM: Vec3; nextVelocityMps: Vec3; proximity: BlackHoleProximityState } {
  const proximity = evaluateBlackHoleProximity(positionM, blackHole);

  if (proximity.isCaptured) {
    // Inside event horizon: inward velocity increases towards singularity, no outward movement
    const dx = positionM[0] - blackHole.positionM[0];
    const dy = positionM[1] - blackHole.positionM[1];
    const dz = positionM[2] - blackHole.positionM[2];
    const dist = Math.hypot(dx, dy, dz) || 1;
    const inwardSpeed = Math.min(SPEED_OF_LIGHT * 0.99, Math.hypot(...velocityMps) + 1000 * dt);

    const inwardVx = (-dx / dist) * inwardSpeed;
    const inwardVy = (-dy / dist) * inwardSpeed;
    const inwardVz = (-dz / dist) * inwardSpeed;

    const nextPos: Vec3 = [
      positionM[0] + inwardVx * dt,
      positionM[1] + inwardVy * dt,
      positionM[2] + inwardVz * dt,
    ];
    return {
      nextPositionM: nextPos,
      nextVelocityMps: [inwardVx, inwardVy, inwardVz],
      proximity,
    };
  }

  // Outside horizon: add gravitational acceleration
  const acc = proximity.accelerationVectorMps2;
  let vx = velocityMps[0] + acc[0] * dt;
  let vy = velocityMps[1] + acc[1] * dt;
  let vz = velocityMps[2] + acc[2] * dt;

  // Frame dragging orthogonal component if spinning
  if (blackHole.spin01 > 0.05 && proximity.frameDraggingVelocityMps > 10) {
    // Cross product of z-spin axis [0, 0, 1] with radial vector
    const rx = positionM[0] - blackHole.positionM[0];
    const ry = positionM[1] - blackHole.positionM[1];
    const rPlanar = Math.hypot(rx, ry) || 1;
    const dragDirX = -ry / rPlanar;
    const dragDirY = rx / rPlanar;
    const dragBlend = Math.min(1.0, dt * 0.5);
    vx += dragDirX * proximity.frameDraggingVelocityMps * dragBlend;
    vy += dragDirY * proximity.frameDraggingVelocityMps * dragBlend;
  }

  // Relativistic speed clamp (strictly subluminal for mass particles)
  const currentSpeed = Math.hypot(vx, vy, vz);
  const maxPhysicalSpeed = SPEED_OF_LIGHT * 0.999;
  if (currentSpeed > maxPhysicalSpeed) {
    const scale = maxPhysicalSpeed / currentSpeed;
    vx *= scale;
    vy *= scale;
    vz *= scale;
  }

  const nextPos: Vec3 = [
    positionM[0] + vx * dt,
    positionM[1] + vy * dt,
    positionM[2] + vz * dt,
  ];

  return {
    nextPositionM: nextPos,
    nextVelocityMps: [vx, vy, vz],
    proximity,
  };
}

/**
 * Evaluates whether an emergency escape maneuver (e.g. key 'X' or hero booster thrust)
 * can successfully overcome black hole attraction.
 * Returns true if player can break orbit; returns false if already inside event horizon or thrust insufficient.
 */
export function evaluateEmergencyEscape(
  proximity: BlackHoleProximityState,
  escapeThrustMps2: number
): { canEscape: boolean; reason: string } {
  if (proximity.isCaptured) {
    return {
      canEscape: false,
      reason: 'Captura confirmada: dentro do horizonte de eventos de Kerr, todas as geodésicas convergem para a singularidade.',
    };
  }

  if (escapeThrustMps2 <= 0) {
    return {
      canEscape: false,
      reason: 'Empuxo nulo: impossível contrapor aceleração gravitacional.',
    };
  }

  const requiredThrust = proximity.effectiveAccelerationMps2 * 1.2;
  if (escapeThrustMps2 >= requiredThrust) {
    return {
      canEscape: true,
      reason: 'Manobra de escape viável: empuxo supera atração relativística local.',
    };
  }

  return {
    canEscape: false,
    reason: `Empuxo insuficiente (${escapeThrustMps2.toFixed(0)} m/s² vs necessário ${requiredThrust.toFixed(0)} m/s²).`,
  };
}
