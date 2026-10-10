import { sectorKey, type UniverseAddress, type CosmologicalAddress } from '../spatial/UniverseAddress';

export type UniversalTargetKind = 'body' | 'star' | 'system' | 'black-hole' | 'galaxy'
  | 'cluster' | 'cosmic-anchor' | 'observable-horizon';
export type TargetSource = 'reticle' | 'map' | 'hud' | 'search' | 'portal';
export interface UniversalTargetDescriptor {
  readonly kind: UniversalTargetKind;
  readonly displayName: string;
  readonly objectId: string;
  readonly galaxyId?: string;
  readonly systemId?: string;
  readonly bodyId?: string;
  readonly address?: UniverseAddress | CosmologicalAddress;
}
export interface UniversalNavigationTarget extends UniversalTargetDescriptor {
  readonly key: string;
  readonly source: TargetSource;
  readonly selectedAtS: number;
  readonly mode: 'selected' | 'locked';
}
const kinds: readonly string[] = ['body','star','system','black-hole','galaxy','cluster','cosmic-anchor','observable-horizon'];
const sources: readonly string[] = ['reticle','map','hud','search','portal'];
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1024;
const integer3 = (v: { x: bigint; y: bigint; z: bigint }) => v && ['x','y','z'].every(k => typeof v[k as keyof typeof v] === 'bigint');
export const isUniverseAddress = (a: UniverseAddress | CosmologicalAddress): a is UniverseAddress => 'sector' in a;

/** Identity is hierarchical plain data. Offsets, clocks, names and presentation never enter a key. */
export function universalTargetKey(d: UniversalTargetDescriptor): string {
  if (!d || !kinds.includes(d.kind) || !id(d.objectId) || !id(d.displayName)) throw new Error('Invalid target descriptor');
  const part = encodeURIComponent;
  if (d.kind === 'galaxy') {
    if (!id(d.galaxyId) || d.objectId !== d.galaxyId || d.bodyId || d.systemId || d.address) throw new Error('Invalid galaxy target');
    return `galaxy/${part(d.galaxyId)}`;
  }
  const a = d.address;
  if (!a) throw new Error('Target address required');
  if (isUniverseAddress(a)) {
    if (!id(a.galaxyId) || !integer3(a.sector) || a.galaxyId !== d.galaxyId
      || a.systemId !== d.systemId || a.bodyId !== d.bodyId || a.childFrame !== undefined
      || (a.systemId !== undefined && !id(a.systemId)) || (a.bodyId !== undefined && !id(a.bodyId))) throw new Error('Malformed universe target address');
    const prefix = `universe/${part(a.galaxyId)}/${sectorKey('',a.sector).slice(1)}`;
    if (d.kind === 'black-hole' && !a.systemId && !a.bodyId) return `${prefix}/black-hole/${part(d.objectId)}`;
    if (d.kind === 'system' && id(a.systemId) && !a.bodyId && d.objectId === a.systemId) return `${prefix}/system/${part(a.systemId)}`;
    if ((d.kind === 'body' || d.kind === 'star') && id(a.systemId) && id(a.bodyId) && d.objectId === a.bodyId)
      return `${prefix}/system/${part(a.systemId)}/${d.kind}/${part(a.bodyId)}`;
    throw new Error('Kind does not match universe address');
  }
  if (!['cluster','cosmic-anchor','observable-horizon'].includes(d.kind) || d.galaxyId || d.systemId || d.bodyId
    || !integer3(a.cell) || !Array.isArray(a.localMpc) || a.localMpc.length !== 3 || !a.localMpc.every(Number.isFinite)
    || ['epoch','redshift','comovingDistanceM','rightAscensionRad','declinationRad'].some(k => {
      const v = a[k as keyof CosmologicalAddress]; return v !== undefined && (typeof v !== 'number' || !Number.isFinite(v));
    })) throw new Error('Malformed cosmological target address');
  return `cosmos/${d.kind}/${part(d.objectId)}`;
}

/** Clone/freeze the identity so mutations in caller/provider data cannot rewrite the selected key. */
export function createUniversalTarget(d: UniversalTargetDescriptor, source: TargetSource = 'hud', selectedAtS = 0,
  mode: UniversalNavigationTarget['mode'] = 'locked'): UniversalNavigationTarget {
  const key = universalTargetKey(d);
  if (!sources.includes(source) || !Number.isFinite(selectedAtS) || !['selected','locked'].includes(mode)) throw new Error('Invalid target selection');
  const a = d.address;
  const address = a ? isUniverseAddress(a)
    ? Object.freeze({ galaxyId:a.galaxyId, sector:Object.freeze({x:a.sector.x,y:a.sector.y,z:a.sector.z}), systemId:a.systemId, bodyId:a.bodyId })
    : Object.freeze({ cell:Object.freeze({x:a.cell.x,y:a.cell.y,z:a.cell.z}), localMpc:Object.freeze([...a.localMpc]),
      epoch:a.epoch,redshift:a.redshift,comovingDistanceM:a.comovingDistanceM,rightAscensionRad:a.rightAscensionRad,
      declinationRad:a.declinationRad }) as CosmologicalAddress : undefined;
  return Object.freeze({ kind:d.kind, displayName:d.displayName, objectId:d.objectId, galaxyId:d.galaxyId,
    systemId:d.systemId, bodyId:d.bodyId, address, key, source, selectedAtS, mode });
}

/** Versioned wire format: integer axes are decimal strings, never JSON numbers or rounded doubles. */
export function serializeUniversalTarget(t: UniversalNavigationTarget): string {
  if (universalTargetKey(t) !== t.key) throw new Error('Target key mismatch');
  return JSON.stringify({ version:1, target:createUniversalTarget(t,t.source,t.selectedAtS,t.mode) },
    (_key,value) => typeof value === 'bigint' ? { bigint:value.toString() } : value);
}
export function deserializeUniversalTarget(json: string): UniversalNavigationTarget {
  const data = JSON.parse(json, (_key,value) => {
    if (value && typeof value === 'object' && 'bigint' in value) {
      if (Object.keys(value).length !== 1 || typeof value.bigint !== 'string' || !/^(0|-?[1-9]\d*)$/.test(value.bigint)) throw new Error('Malformed bigint');
      return BigInt(value.bigint);
    }
    return value;
  });
  if (data?.version !== 1 || !data.target) throw new Error('Unsupported target version');
  const t = data.target;
  if(!sources.includes(t.source) || typeof t.selectedAtS!=='number' || !['selected','locked'].includes(t.mode)) throw new Error('Missing target selection metadata');
  const result = createUniversalTarget(t,t.source,t.selectedAtS,t.mode);
  if (result.key !== t.key) throw new Error('Target key mismatch');
  return result;
}
