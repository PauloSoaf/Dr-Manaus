/**
 * Who draws a given piece of the real road network.
 *
 * Every stretch of road has exactly one renderer. Without this the compiled Overture segment for
 * the Ponte Rio Negro was drawn as a flat ribbon at road height AND as a bespoke deck by the
 * landmark, so the player saw two bridges a kilometre apart. A segment handed to a landmark is
 * still part of the drivable graph — traffic crosses the same structure the player is standing on
 * — it is only the *rendering* that moves.
 */
export type RoadOwner = 'real-road' | 'landmark-bridge' | 'airport';

interface OwnershipRule {
  owner: RoadOwner;
  /** Matched against the Overture `names.primary` of the segment, trimmed. */
  name: RegExp;
}

/**
 * Keyed on the name the dataset actually publishes, not on a guessed heading or bounding box, so
 * the rule survives a recompile and a test can prove the segments still exist.
 */
export const OWNERSHIP_RULES: readonly OwnershipRule[] = [
  { owner: 'landmark-bridge', name: /^ponte sobre o rio negro$/i },
];

export interface OwnableRoad { name?: string }

export function roadOwner(road: OwnableRoad): RoadOwner {
  const name = (road.name ?? '').trim();
  if (!name) return 'real-road';
  for (const rule of OWNERSHIP_RULES) if (rule.name.test(name)) return rule.owner;
  return 'real-road';
}

/** True when the generic road renderer must stand down because a landmark draws this stretch. */
export function drawnByLandmark(road: OwnableRoad): boolean {
  return roadOwner(road) !== 'real-road';
}
