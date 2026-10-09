import type { CelestialSystemRuntime } from '../celestial/CelestialSystemRuntime';
import type { Vec3 } from '../spatial/units';
import { createUniversalTarget, universalTargetKey, type UniversalNavigationTarget, type TargetSource } from './UniversalNavigationTarget';
import { SOLAR_TARGET_ADDRESS } from './UniversalTargetCatalog';
import type { ResolvedUniversalTarget } from './UniversalTargetResolver';

export interface NavigationLock {
  readonly bodyId: string;
  readonly source: TargetSource;
  readonly lockedAtS: number;
  readonly mode: 'selected' | 'locked';
}

/** Sole target authority. Unloaded descriptors remain valid; render/provider lifecycles are irrelevant. */
export class NavigationTargetState {
  private target?: UniversalNavigationTarget;
  get current(): UniversalNavigationTarget | undefined { return this.target; }
  select(target: UniversalNavigationTarget): void;
  /** Historical Solar-only caller adapter. The stored authority is always universal. */
  select(bodyId: string, source: TargetSource, timeS: number): void;
  select(target: UniversalNavigationTarget|string, source:TargetSource='hud',timeS=0): void {
    if(typeof target!=='string' && universalTargetKey(target)!==target.key)throw new Error('Target key mismatch');
    this.target = typeof target==='string'
      ? createUniversalTarget({kind:'body',displayName:target,objectId:target,galaxyId:'milky_way',systemId:'sol',bodyId:target,
        address:{...SOLAR_TARGET_ADDRESS,bodyId:target}},source,timeS)
      : createUniversalTarget(target,target.source,target.selectedAtS,target.mode);
  }
  lock(target:UniversalNavigationTarget):void {
    this.select(createUniversalTarget(target,target.source,target.selectedAtS,'locked'));
  }
  clear(): void { this.target = undefined; }
  validate(resolver:{resolve(target:UniversalNavigationTarget):Pick<ResolvedUniversalTarget,'valid'>}): void {
    if (this.target && !resolver.resolve(this.target).valid) this.clear();
  }
}

export const TARGET_LOCK_CONE_RAD = 15 * Math.PI / 180;
export interface LockPresentation { readonly bodyId: string; readonly proxyDistanceM: number; }

/** Called on a key edge only. A bounded proxy remains presentable after its globe replaces it.
 * Score: angular offset / 15deg, minus up to .08 apparent-size bonus, plus up to .02
 * logarithmic distance penalty, minus .005 current-lock bonus. Identity breaks exact ties.
 */
export function celestialLockCandidates(system: CelestialSystemRuntime, observerM: Vec3,
  forwardBary: Vec3, presentation: readonly LockPresentation[], currentId?: string,
  excludedBodyId?: string): string[] {
  const length = Math.hypot(...forwardBary);
  if (!(length > 0) || !Number.isFinite(length)) return [];
  const ranked: { id: string; score: number; distance: number; apparent: number; x: number; y: number; z: number }[] = [];
  for (const body of system.bodies) {
    if (body.id === excludedBodyId) continue;
    const sample = presentation.find(p => p.bodyId === body.id);
    if (!sample || !(sample.proxyDistanceM > 0) || !Number.isFinite(sample.proxyDistanceM)) continue;
    const p = system.positionOf(body.id);
    if (!p || !p.every(Number.isFinite)) continue;
    const x = p[0] - observerM[0], y = p[1] - observerM[1], z = p[2] - observerM[2];
    const distance = Math.hypot(x, y, z);
    if (!(distance > body.equatorialRadiusM)) continue;
    const dot = (x * forwardBary[0] + y * forwardBary[1] + z * forwardBary[2]) / (distance * length);
    if (dot < Math.cos(TARGET_LOCK_CONE_RAD)) continue;
    const angle = Math.acos(Math.min(1, dot));
    const apparent = Math.asin(Math.min(1, body.equatorialRadiusM / distance));
    const score = angle / TARGET_LOCK_CONE_RAD - .08 * Math.min(1, apparent / TARGET_LOCK_CONE_RAD)
      + .02 * Math.min(1, Math.log10(Math.max(1, distance)) / 15) - (body.id === currentId ? .005 : 0);
    ranked.push({ id: body.id, score, distance, apparent, x: x / distance, y: y / distance, z: z / distance });
  }
  ranked.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  // Reject a fully occluded physical disc using logical angular sizes. Partial overlaps remain
  // eligible for cycling; an unloaded globe or retired proxy changes none of this geometry.
  return ranked.filter(item => !ranked.some(front => front.distance < item.distance
    && Math.acos(Math.max(-1, Math.min(1, item.x * front.x + item.y * front.y + item.z * front.z)))
      + item.apparent < front.apparent)).map(item => item.id);
}

export function cycleNavigationTarget(candidates: readonly string[], currentId?: string, reverse = false): string | undefined {
  if (!candidates.length) return undefined;
  const index = currentId ? candidates.indexOf(currentId) : -1;
  return candidates[index < 0 ? (reverse ? candidates.length - 1 : 0)
    : (index + (reverse ? -1 : 1) + candidates.length) % candidates.length];
}
