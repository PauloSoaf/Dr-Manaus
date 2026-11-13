/**
 * Cosmological Navigation and Relativistic Anchor Transitions.
 *
 * Implements cosmological exploration services for large-scale cosmic web structures,
 * major galaxy clusters, and the observer-relative observable horizon.
 *
 * Enforces the fundamental cosmological invariant:
 * - Every observer point in the universe defines its own observable horizon sphere.
 * - The observable horizon is NOT a physical barrier or end of space.
 * - Moving between cosmic anchors translates the observable horizon with the observer.
 */

import type { CosmologicalAddress, BigInt3 } from '../spatial/UniverseAddress';
import type { Vec3 } from '../spatial/units';
import {
  evaluateObservableHorizon,
  cosmologicalDistanceMpc,
  KNOWN_COSMIC_ANCHORS,
  OBSERVABLE_HORIZON_MPC,
  type CosmicAnchor,
  type ObservableHorizonDescriptor,
} from './CosmologicalStructure';
import type { UniversalNavigationTarget } from '../travel/UniversalNavigationTarget';
import { COSMOLOGICAL_CELL_SIZE_MPC, MPC_M } from '../galaxy/ProceduralGalaxyGenerator';

export interface CosmologicalNavigationState {
  readonly target: UniversalNavigationTarget;
  readonly isHorizon: boolean;
  readonly isAnchor: boolean;
  readonly anchor?: CosmicAnchor;
  readonly distanceMpc?: number;
  readonly comovingDistanceM?: number;
  readonly horizonState: ObservableHorizonDescriptor;
  readonly observationalOnly: boolean;
}

/**
 * Returns the curated Cosmic Anchor descriptor by ID, if present.
 */
export function getCosmicAnchorDescriptor(id: string): CosmicAnchor | undefined {
  return KNOWN_COSMIC_ANCHORS.find(a => a.id === id);
}

/**
 * Checks whether a target represents the observer-relative observable horizon.
 */
export function isObserverRelativeHorizon(target: UniversalNavigationTarget): boolean {
  return target.kind === 'observable-horizon' || target.objectId === 'observable-horizon';
}

/**
 * Evaluates the cosmological navigation state for a target from the perspective of an observer.
 */
export function evaluateCosmologicalNavigation(
  target: UniversalNavigationTarget,
  observerAddress: CosmologicalAddress
): CosmologicalNavigationState {
  const horizonState = evaluateObservableHorizon(observerAddress);
  const isHorizon = isObserverRelativeHorizon(target);
  const anchor = getCosmicAnchorDescriptor(target.objectId);
  const isAnchor = Boolean(anchor || target.kind === 'cluster' || target.kind === 'cosmic-anchor');

  let distanceMpc: number | undefined;
  let comovingDistanceM: number | undefined;

  if (isHorizon) {
    distanceMpc = OBSERVABLE_HORIZON_MPC;
    comovingDistanceM = OBSERVABLE_HORIZON_MPC * MPC_M;
  } else if (anchor) {
    const targetAddr: CosmologicalAddress = {
      cell: { x: 0n, y: 0n, z: 0n },
      localMpc: anchor.positionMpc,
    };
    distanceMpc = cosmologicalDistanceMpc(observerAddress, targetAddr);
    comovingDistanceM = distanceMpc * MPC_M;
  } else if (target.address && !('sector' in target.address)) {
    distanceMpc = cosmologicalDistanceMpc(observerAddress, target.address);
    comovingDistanceM = distanceMpc * MPC_M;
  }

  return {
    target,
    isHorizon,
    isAnchor,
    anchor,
    distanceMpc,
    comovingDistanceM,
    horizonState,
    observationalOnly: true, // Cosmological anchors and horizon are large-scale observational structures
  };
}

/**
 * Resolves a safe cosmological emergence address near a cosmic anchor for translocations.
 */
export function resolveCosmologicalAnchorArrival(
  anchor: CosmicAnchor,
  safeOffsetMpc: Vec3 = [0.1, 0.1, 0.1]
): CosmologicalAddress {
  const targetX = anchor.positionMpc[0] + safeOffsetMpc[0];
  const targetY = anchor.positionMpc[1] + safeOffsetMpc[1];
  const targetZ = anchor.positionMpc[2] + safeOffsetMpc[2];

  // Convert to cosmic cell and bounded local Mpc offset
  const cellX = BigInt(Math.floor(targetX / COSMOLOGICAL_CELL_SIZE_MPC));
  const cellY = BigInt(Math.floor(targetY / COSMOLOGICAL_CELL_SIZE_MPC));
  const cellZ = BigInt(Math.floor(targetZ / COSMOLOGICAL_CELL_SIZE_MPC));

  const localX = targetX - Number(cellX) * COSMOLOGICAL_CELL_SIZE_MPC;
  const localY = targetY - Number(cellY) * COSMOLOGICAL_CELL_SIZE_MPC;
  const localZ = targetZ - Number(cellZ) * COSMOLOGICAL_CELL_SIZE_MPC;

  return {
    cell: { x: cellX, y: cellY, z: cellZ },
    localMpc: [localX, localY, localZ],
    epoch: 0,
    comovingDistanceM: Math.hypot(targetX, targetY, targetZ) * MPC_M,
  };
}

