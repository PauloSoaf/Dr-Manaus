import { Group, InstancedMesh, Mesh, Vector3 } from 'three/webgpu';
import type { Collider } from '../../../core/types';
import { createIgreja, createIgrejaSilhouette, IGREJA_ANCHOR, IGREJA_COLLIDERS } from './igreja';
import { createMonument, createMonumentSilhouette, MONUMENT_COLLIDERS } from './monument';
import { createLargoPavement } from './plaza';
import { createLargoProps, createVendorSigns } from './props';
import { createLargoVenues, createLargoVenuesDistant, VENUE_COLLIDERS } from './venues';
import { AuthoredDestruction } from '../../destruction/AuthoredDestruction';

export { isPaved, zoneAt, LARGO_ZONES, LARGO_REACH } from './plaza';
export { LARGO_VENUES, venue, type SpecialVenue } from './venues';
export { MONUMENT_HEIGHT } from './monument';
export { IGREJA_ANCHOR } from './igreja';

export type LargoDetail = 'ultra' | 'medium' | 'low' | 'off';

/** The showcase is small, so it can be rich — but only while the player is actually in it. */
const ULTRA_ENTER = 220, ULTRA_EXIT = 260;
const MEDIUM_ENTER = 600, MEDIUM_EXIT = 680;
const VISIBLE = 2600;

function disposeGroup(group: Group): void {
  group.traverse(object => {
    if (object instanceof InstancedMesh) { object.geometry.dispose(); object.dispose(); }
    else if (object instanceof Mesh) object.geometry.dispose();
  });
  group.removeFromParent();
}

/**
 * The Largo de São Sebastião, the game's point zero.
 *
 * Three mutually exclusive builds, swapped with hysteresis so walking the boundary cannot thrash
 * them. Ultra carries the furniture, the shopfronts and the paving pattern; medium keeps the
 * masses and the monument; low is the silhouette the rest of the city already draws around.
 * Everything is anchored on the monument, which is world zero.
 */
export class LargoDistrict {
  readonly group = new Group();
  private readonly colliderList: Collider[] = [];
  private built: LargoDetail = 'off';
  private content?: Group;
  private timer = 0;
  private readonly destruction = new AuthoredDestruction();
  private readonly registeredGroups: Group[] = [];
  private readonly lastPlayer = new Vector3();
  private draws = 0;
  get destroyedCount(): number { return this.destruction.destroyedCount; }
  get destructionStats() { return this.destruction.stats; }
  isDestroyed(id: string): boolean { return this.destruction.isDestroyed(id); }

  constructor(root: Group) {
    this.group.name = 'largo-sao-sebastiao';
    root.add(this.group);
    // Collision does not change with detail: the buildings and the monument are always solid.
    for (const box of MONUMENT_COLLIDERS) this.destruction.addCollider({ ...box, id: 'largo:monumento' });
    for (const box of VENUE_COLLIDERS) this.destruction.addCollider(box);
    for (const box of IGREJA_COLLIDERS) {
      this.destruction.addCollider({ ...box, x: box.x + IGREJA_ANCHOR.x, z: box.z + IGREJA_ANCHOR.z, id: 'largo:igreja' });
    }
    this.refreshColliders();
  }

  get colliders(): readonly Collider[] { return this.colliderList; }
  get detail(): LargoDetail { return this.built; }
  get stats(): { detail: LargoDetail; colliders: number; draws: number } {
    return { detail: this.built, colliders: this.colliderList.length, draws: this.draws };
  }

  update(player: Vector3, dt = 0): void {
    this.lastPlayer.copy(player);
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = .25;
    const distance = Math.hypot(player.x, player.z);
    const wanted: LargoDetail = distance > VISIBLE ? 'off'
      : distance < (this.built === 'ultra' ? ULTRA_EXIT : ULTRA_ENTER) ? 'ultra'
        : distance < (this.built === 'medium' ? MEDIUM_EXIT : MEDIUM_ENTER) ? 'medium' : 'low';
    if (wanted !== this.built) this.build(wanted);
    this.refreshColliders();
  }

  private build(detail: LargoDetail): void {
    for (const group of this.registeredGroups) this.destruction.unregister(group);
    this.registeredGroups.length = 0;
    this.draws = 0;
    if (this.content) { disposeGroup(this.content); this.content = undefined; }
    this.built = detail;
    if (detail === 'off') return;
    const content = new Group();
    content.name = `largo-${detail}`;
    const addDestructible = (group: Group, id: string) => {
      content.add(group);
      this.destruction.register(group, id, { x: 0, z: 0 });
      this.registeredGroups.push(group);
    };

    // The paving is cheap at every tier and its own shader fades the pattern with distance.
    content.add(createLargoPavement());

    const igreja = detail === 'ultra' ? createIgreja() : createIgrejaSilhouette();
    igreja.position.set(IGREJA_ANCHOR.x, 0, IGREJA_ANCHOR.z);
    addDestructible(igreja, 'largo:igreja');

    if (detail === 'ultra') {
      addDestructible(createMonument(), 'largo:monumento');
      addDestructible(createLargoVenues(), 'largo:casario');
      addDestructible(createVendorSigns(), 'largo:vendors');
      addDestructible(createLargoProps(), 'largo:props');
    } else if (detail === 'medium') {
      addDestructible(createMonument(), 'largo:monumento');
      addDestructible(createLargoVenuesDistant(), 'largo:casario');
    } else {
      addDestructible(createMonumentSilhouette(), 'largo:monumento');
      addDestructible(createLargoVenuesDistant(), 'largo:casario');
    }

    content.traverse(object => {
      if (!(object instanceof Mesh)) return;
      this.draws++;
      // Shadows only in the showcase band; past that they cost more than they show.
      object.castShadow = detail === 'ultra' && object.name !== 'largo-pavement';
      object.receiveShadow = true;
    });
    this.content = content;
    this.group.add(content);
  }

  private refreshColliders(): void {
    this.colliderList.length = 0;
    this.destruction.appendColliders(this.colliderList, this.lastPlayer, 450);
  }

  appendBlastColliders(out:Collider[],position:Vector3,radius:number):void{this.destruction.appendColliders(out,position,radius);}

  destroy(id: string): boolean {
    if (!this.destruction.destroy(id)) return false;
    for (let i = this.colliderList.length - 1; i >= 0; i--) if (this.colliderList[i].id === id) this.colliderList.splice(i, 1);
    return true;
  }

  restore(position: Vector3, radius: number): number {
    const count = this.destruction.restore(position, radius);
    if (count) this.refreshColliders();
    return count;
  }

  dispose(): void {
    this.destruction.dispose();
    if (this.content) disposeGroup(this.content);
    this.content = undefined;
    this.colliderList.length = 0;
    this.group.removeFromParent();
  }
}
