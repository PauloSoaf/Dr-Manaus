import type { DestructionCategory } from '../../core/types';

/** Owner adapters classify families; the destruction solver never parses entity IDs. */
export function impactCategory(id = ''): DestructionCategory {
  if (id.includes('/tree/') || id.startsWith('largo:tree/') || id.startsWith('road:tree:')) return 'vegetation';
  if (id.startsWith('traffic:')) return 'vehicle';
  if (id.startsWith('prop:') || id.startsWith('road:lamp:') || /^largo:(lamp|bench|table|chair|bin|parasol):/.test(id)) return 'fragile';
  if (id.startsWith('largo:stall:')) return 'light-structure';
  if (id.startsWith('landmark:')) return 'landmark';
  return 'building';
}
export function impactKind(id=''): 'lamp' | undefined {
  return id.startsWith('largo:lamp:') || id.startsWith('road:lamp:') ? 'lamp' : undefined;
}
