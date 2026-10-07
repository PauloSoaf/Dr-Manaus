import type { CelestialBody } from '../celestial/CelestialBody';
import type { CelestialBodyProfile } from '../celestial/CelestialBodyProfile';
import type { CelestialImpactEvent } from '../travel/CelestialImpactEvent';
import { planetSurfaceRadius, type PlanetSurfaceGenerator } from '../planet/PlanetSurface';
import { surfaceOutwardNormal } from '../planet/PlanetSurfaceMath';
import type { PlanetVolumeBounds } from '../planet/volume/PlanetVolumeEdit';
import type { Vec3 } from '../spatial/units';
import { IMPACT, resolveImpact } from './ImpactFootprintPolicy';

export interface RockyImpactEditPlan {
  readonly eventId: string; readonly bodyId: string;
  readonly classification: 'MINOR_IMPACT' | 'MAJOR_IMPACT';
  readonly surfaceContactBodyFixedM: Vec3; readonly surfaceNormalBodyFixed: Vec3;
  readonly craterRadiusM: number; readonly craterDepthM: number;
  readonly sphereCenterBodyFixedM: Vec3; readonly sphereRadiusM: number;
  /** Signed below-surface offset: negative for a shallow spherical cap. */
  readonly sphereDepthOffsetM: number;
  readonly affectedBoundsBodyFixedM: PlanetVolumeBounds;
  readonly sourceSpeedMps: number; readonly inwardSpeedMps: number; readonly tangentialSpeedMps: number;
}

/** Capability/classification policy only. Never detects collision or mutates an edit/cache. */
export function planRockyImpact(event: CelestialImpactEvent, body: CelestialBody,
  profile: CelestialBodyProfile, surface: PlanetSurfaceGenerator): RockyImpactEditPlan | null {
  if (!profile.hasSolidSurface || !profile.supportsVolumeDestruction || body.id !== event.bodyId
    || surface.body.id !== body.id || !event.eventId
    || (event.classification !== 'MINOR_IMPACT' && event.classification !== 'MAJOR_IMPACT')) return null;
  const point = event.contactBodyFixedM;
  if (!point || !point.every(Number.isFinite)
    || ![event.relativeSpeedMps,event.inwardRadialSpeedMps,event.tangentialSpeedMps].every(v=>Number.isFinite(v)&&v>=0)) return null;
  const length = Math.hypot(...point);
  if (!Number.isFinite(length) || length < 1) return null;
  const direction: Vec3 = point.map(v=>v/length) as Vec3;
  const radius = planetSurfaceRadius(surface,direction);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  const surfaceContactBodyFixedM: Vec3 = direction.map(v=>v*radius) as Vec3;
  const surfaceNormalBodyFixed = surfaceOutwardNormal(surface,surfaceContactBodyFixedM);
  const effectiveSpeed = Math.min(Number.MAX_VALUE,event.inwardRadialSpeedMps+IMPACT.obliqueTransfer*event.tangentialSpeedMps);
  const footprint = resolveImpact(effectiveSpeed,1,false,Math.min(1,Math.sqrt(event.inwardRadialSpeedMps/IMPACT.minDescent)));
  const a = footprint.craterRadiusM,h = footprint.craterDepthM;
  if (!(a>0 && h>0)) return null;
  const sphereRadiusM = (a*a+h*h)/(2*h),sphereDepthOffsetM=h-sphereRadiusM;
  // Outward normal: the sphere centre lies ABOVE the plane for h < radius.
  // This sign gives bottom depth h and sqrt(radius²-offset²) == a.
  const sphereCenterBodyFixedM: Vec3 = surfaceContactBodyFixedM.map((v,i)=>v-surfaceNormalBodyFixed[i]*sphereDepthOffsetM) as Vec3;
  if (![sphereRadiusM,sphereDepthOffsetM,...sphereCenterBodyFixedM,...surfaceNormalBodyFixed].every(Number.isFinite)) return null;
  return {eventId:event.eventId,bodyId:body.id,classification:event.classification,surfaceContactBodyFixedM,
    surfaceNormalBodyFixed,craterRadiusM:a,craterDepthM:h,sphereCenterBodyFixedM,sphereRadiusM,sphereDepthOffsetM,
    affectedBoundsBodyFixedM:{minBodyFixedM:sphereCenterBodyFixedM.map(v=>v-sphereRadiusM) as Vec3,
      maxBodyFixedM:sphereCenterBodyFixedM.map(v=>v+sphereRadiusM) as Vec3},
    sourceSpeedMps:event.relativeSpeedMps,inwardSpeedMps:event.inwardRadialSpeedMps,tangentialSpeedMps:event.tangentialSpeedMps};
}
