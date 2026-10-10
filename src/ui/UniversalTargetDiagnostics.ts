import type { ResolvedUniversalTarget } from '../world/travel/UniversalTargetResolver';
import { formatDistance } from './format';

/** Pure F3 projection of the same resolved target used by HUD/map; no identity or coordinate store. */
export function universalTargetDiagnostics(resolved?:ResolvedUniversalTarget):Record<string,string> {
  const t=resolved?.target,a=t?.address;
  return {
    'Universal Target · Name':t?.displayName??'—',
    'Universal Target · Kind':t?.kind??'—',
    'Universal Target · Key':t?.key??'—',
    'Universal Target · Galaxy':t?.galaxyId??'—',
    'Universal Target · Sector':a && 'sector' in a?`${a.sector.x},${a.sector.y},${a.sector.z}`:'—',
    'Universal Target · System':t?.systemId??'—',
    'Universal Target · Body':t?.bodyId??'—',
    'Universal Target · Object':t?.objectId??'—',
    'Universal Target · Materialized':resolved?.materialized?'sim':'não',
    'Universal Target · Distance':resolved?.distanceM===undefined?'—':formatDistance(resolved.distanceM),
    'Universal Target · Domain':resolved?.domain??'—',
    'Universal Target · Capability':resolved?.travelCapability??'—',
  };
}
