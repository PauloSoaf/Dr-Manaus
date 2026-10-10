import { SolarSystem } from '../celestial/SolarSystem';
import type { CelestialSystemRuntime } from '../celestial/CelestialSystemRuntime';
import { LOCAL_GROUP_CATALOG } from '../celestial/GalaxyDefinition';
import { KNOWN_COSMIC_ANCHORS, OBSERVABLE_HORIZON_MPC } from '../celestial/CosmicAnchorCatalog';
import { generateStarSector, type GeneratedStar } from '../celestial/StarSector';
import { generateSystem, type ProceduralSystem } from '../celestial/SystemGenerator';
import { sectorIndex, sectorKey, sectorSeed, type UniverseAddress, type SectorIndex } from '../spatial/UniverseAddress';
import { PARSEC_M, type Vec3 } from '../spatial/units';
import { createUniversalTarget, isUniverseAddress, universalTargetKey, type UniversalTargetDescriptor, type UniversalNavigationTarget, type TargetSource } from './UniversalNavigationTarget';

export const SOLAR_TARGET_ADDRESS: UniverseAddress = Object.freeze({ galaxyId:'milky_way', sector:Object.freeze(sectorIndex(0n,0n,0n)), systemId:'sol' });
const names: Readonly<Record<string,string>> = { sun:'Sol', mercury:'Mercúrio', venus:'Vênus', earth:'Terra', moon:'Lua', mars:'Marte', jupiter:'Júpiter', saturn:'Saturno', uranus:'Urano', neptune:'Netuno' };
export interface CatalogTarget { readonly descriptor: UniversalTargetDescriptor; readonly offsetM?: Vec3; readonly globalPositionM?: Vec3; }
export interface ProceduralTargetDescriptor { readonly star: GeneratedStar; readonly system: ProceduralSystem; readonly address: UniverseAddress; }

/** Descriptor authority, independent of provider allocation. No render objects or player mutations. */
export class UniversalTargetCatalog {
  private readonly entries = new Map<string,CatalogTarget>();
  private readonly procedural = new Map<string,ProceduralTargetDescriptor>();
  private readonly sectors = new Map<string,readonly GeneratedStar[]>();
  constructor(solar: CelestialSystemRuntime = new SolarSystem()) {
    this.add({kind:'system',displayName:'Sol · Sistema Solar',objectId:'sol',galaxyId:'milky_way',systemId:'sol',address:SOLAR_TARGET_ADDRESS});
    for (const body of solar.bodies) this.add({ kind:'body', displayName:names[body.id]??body.name, objectId:body.id,
      galaxyId:'milky_way', systemId:'sol', bodyId:body.id, address:{...SOLAR_TARGET_ADDRESS,bodyId:body.id} });
    for (const galaxy of LOCAL_GROUP_CATALOG) {
      this.add({ kind:'galaxy', displayName:galaxy.id==='milky_way'?'Milky Way':'Andromeda', objectId:galaxy.id, galaxyId:galaxy.id }, galaxy.positionM);
      const bh = galaxy.centralBlackHole;
      if (bh) this.add({ kind:'black-hole', displayName:bh.id==='sgra'?'Sagittarius A*':'M31 SMBH', objectId:bh.id, galaxyId:galaxy.id,
        address:{galaxyId:galaxy.id,sector:sectorIndex(0n,0n,0n)} },bh.positionM);
    }
    // Small production catalogue until U5 star picking/search. Canonical identities, shared HUD/map authority.
    for(const sector of [sectorIndex(0n,0n,0n),sectorIndex(17n,-2n,4n),sectorIndex(18n,-2n,4n),sectorIndex(500n,0n,0n)]) {
      const star=generateStarSector('milky_way',sector).stars.find(s=>s.planetCount>0);
      if(star){const t=this.proceduralTarget('milky_way',sector,star.id,'system');if(t)this.add(t);}
    }
    for(const star of generateStarSector('andromeda',sectorIndex(200n,0n,0n)).stars.slice(0,2)){
      const target=this.proceduralTarget('andromeda',sectorIndex(200n,0n,0n),star.id,'system');
      if(target)this.add(target);
    }
    for (const anchor of KNOWN_COSMIC_ANCHORS) this.add({ kind:anchor.id==='norma_cluster'?'cosmic-anchor':'cluster',
      displayName:anchor.name, objectId:anchor.id, address:{cell:sectorIndex(0n,0n,0n),localMpc:anchor.positionMpc} });
    this.add({kind:'observable-horizon',displayName:'Observable Horizon',objectId:'observable-horizon',
      address:{cell:sectorIndex(0n,0n,0n),localMpc:[0,0,0],comovingDistanceM:OBSERVABLE_HORIZON_MPC*1e6*PARSEC_M}});
  }
  private add(descriptor: UniversalTargetDescriptor, globalPositionM?: Vec3): void {
    const immutable = createUniversalTarget(descriptor);
    this.entries.set(immutable.key,{ descriptor:immutable, globalPositionM });
  }
  get descriptors(): readonly UniversalTargetDescriptor[] { return [...this.entries.values()].map(e=>e.descriptor); }
  find(query: string): UniversalTargetDescriptor | undefined {
    return this.entries.get(query)?.descriptor ?? this.descriptors.find(d=>d.objectId===query || d.displayName.toLowerCase()===query.toLowerCase());
  }
  target(query: string, source: TargetSource = 'hud', timeS = 0): UniversalNavigationTarget | undefined {
    const descriptor = this.find(query);
    return descriptor && createUniversalTarget(descriptor,source,timeS);
  }
  /** Generated system seed combines the sector seed with the stable generated star identity. */
  proceduralDescriptor(galaxyId: string, sector: SectorIndex, starId: string): ProceduralTargetDescriptor | undefined {
    if (!LOCAL_GROUP_CATALOG.some(g=>g.id===galaxyId)) return;
    const key=sectorKey(galaxyId,sector), systemKey=`${key}/${starId}`;
    const cached=this.procedural.get(systemKey); if(cached)return cached;
    let stars=this.sectors.get(key);
    if(!stars){stars=generateStarSector(galaxyId,sector).stars;this.sectors.set(key,stars);if(this.sectors.size>8)this.sectors.delete(this.sectors.keys().next().value!);}
    const index=stars.findIndex(s=>s.id===starId); if(index<0)return;
    const star=stars[index], system=generateSystem(star.id,sectorSeed(galaxyId,sector)^BigInt(index+1),star);
    const descriptor={star,system,address:{galaxyId,sector,systemId:star.id}};
    this.procedural.set(systemKey,descriptor);if(this.procedural.size>64)this.procedural.delete(this.procedural.keys().next().value!);
    return descriptor;
  }
  proceduralTarget(galaxyId:string, sector:SectorIndex, starId:string, kind:'star'|'system'|'body', bodyId?:string,
    source:TargetSource='hud',timeS=0): UniversalNavigationTarget | undefined {
    const p=this.proceduralDescriptor(galaxyId,sector,starId);if(!p)return;
    const body=kind==='system'?undefined:p.system.bodies.find(b=>b.id===(kind==='star'?starId:bodyId));
    if(kind!=='system' && (!body || (kind==='body' && body.id===starId)))return;
    return createUniversalTarget({kind,displayName:body?.name??`System ${starId}`,objectId:body?.id??starId,
      galaxyId,systemId:starId,bodyId:body?.id,address:{...p.address,bodyId:body?.id}},source,timeS);
  }
  resolve(t: UniversalNavigationTarget): CatalogTarget | undefined {
    try {
      if(universalTargetKey(t)!==t.key)return;
      const entry=this.entries.get(t.key);
      if(entry){
        // A valid key alone cannot authorize a forged location under a curated identity.
        const expected=createUniversalTarget(entry.descriptor).address, actual=createUniversalTarget(t).address;
        if(expected && actual && !isUniverseAddress(expected) && !isUniverseAddress(actual)){
          if(expected.cell.x!==actual.cell.x || expected.cell.y!==actual.cell.y || expected.cell.z!==actual.cell.z
            || expected.localMpc.some((v,i)=>v!==actual.localMpc[i])
            || expected.epoch!==actual.epoch || expected.redshift!==actual.redshift || expected.comovingDistanceM!==actual.comovingDistanceM
            || expected.rightAscensionRad!==actual.rightAscensionRad || expected.declinationRad!==actual.declinationRad)return;
        }
        return entry;
      }
      const a=t.address;if(!a || !isUniverseAddress(a) || !a.systemId || !['body','star','system'].includes(t.kind))return;
      const canonical=this.proceduralTarget(a.galaxyId,a.sector,a.systemId,t.kind as 'body'|'star'|'system',a.bodyId);
      if(canonical?.key!==t.key)return;
      const p=this.proceduralDescriptor(a.galaxyId,a.sector,a.systemId)!;
      return {descriptor:canonical,offsetM:p.star.offsetM};
    } catch { return; }
  }
}
