import { Color, Group, Mesh, MeshStandardMaterial, Object3D, Vector3, type Material } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { DoorRig, SeatRig, VehicleRig } from '../../player/vehicles/VehicleInteraction';

/**
 * The car catalogue built by `scripts/assets/build-vehicles.mjs` from the CC0 Kenney Car Kit:
 * per-model metadata (doors, seats, steering wheel, wheels, lights) and GLBs with real door panels,
 * glass and a simple interior. Models face +Z in the files; the game's vehicles face -Z, so every
 * instance is turned half a revolution inside its holder and the rig is expressed in the holder.
 */
export type Triple = [number, number, number];
export interface VehicleSpec {
  id: string; label: string; category: string; file: string;
  source: { pack: string; file: string; author: string; url: string; licence: string };
  derivation?: string; scale: number; dimensions: Triple; mass: number;
  collider: { center: Triple; size: Triple };
  floorY: number; paintable: boolean; paintColor?: string; halfWidth?: number;
  wheels: { node: string; position: Triple; radius: number; steer: boolean; drive: boolean }[];
  doors: { id: string; node: string; side: 'left' | 'right'; hinge: Triple; rect?: { z0: number; z1: number; y0: number; y1: number }; openAngle: number; handle: Triple; entry: Triple }[];
  seats: { id: 'driver' | 'passenger'; position: Triple; door: string }[];
  steeringWheel?: { node: string; position: Triple; radius: number; spinAxis?: string };
  lights?: { head: Triple[]; tail: Triple[] };
  exhaust?: Triple[];
  lods?: { file: string; maxDistance: number }[];
  traffic?: { weight: number };
}
export interface VehicleManifest { version: number; vehicles: VehicleSpec[]; missingCategories?: string[] }

export const VEHICLE_BASE_URL = `${import.meta.env?.BASE_URL ?? '/'}assets/vehicles/`;

let manifestPromise: Promise<VehicleManifest | null> | undefined;
const scenes = new Map<string, Promise<Group | null>>();

export function loadVehicleManifest(): Promise<VehicleManifest | null> {
  manifestPromise ??= fetch(`${VEHICLE_BASE_URL}vehicles.json`).then(r => (r.ok ? r.json() as Promise<VehicleManifest> : null)).catch(() => null);
  return manifestPromise;
}

export function loadVehicleScene(file: string): Promise<Group | null> {
  let pending = scenes.get(file);
  if (!pending) {
    pending = new GLTFLoader().loadAsync(`${VEHICLE_BASE_URL}${file}`).then(g => g.scene).catch(error => { console.warn('vehicle model failed', file, error); return null; });
    scenes.set(file, pending);
  }
  return pending;
}

/** Picks a model id by traffic weight from a deterministic 0..1 value. */
export function pickTrafficModel(manifest: VehicleManifest, u: number): VehicleSpec {
  const list = manifest.vehicles.filter(v => (v.traffic?.weight ?? 0) > 0);
  const total = list.reduce((s, v) => s + (v.traffic?.weight ?? 0), 0);
  let x = u * total;
  for (const v of list) { x -= v.traffic?.weight ?? 0; if (x <= 0) return v; }
  return list[list.length - 1] ?? manifest.vehicles[0];
}

/** Paint colours of a Manaus street: lots of white, silver and grey, some colour. */
export const PAINT = ['#f2f2f2', '#e8e8e8', '#c0c4c8', '#9aa0a6', '#5f6368', '#2b2d31', '#151618', '#8b1e1e', '#c62828', '#1e3a8a', '#2563eb', '#0f766e', '#d4a017', '#7c4a2d', '#e2d5b5'];

const v3 = (t: Triple) => new Vector3(t[0], t[1], t[2]);

/** A drivable/visible instance of a catalogue model, with the parts the game animates. */
export class VehicleModelInstance {
  /** Holder in the vehicle frame (forward -Z); the model inside is turned by PI. */
  readonly holder = new Group();
  readonly model: Object3D;
  readonly wheelSpin: Object3D[] = [];
  readonly wheelSteer: (Object3D | null)[] = [];
  readonly doors = new Map<string, Object3D>();
  steeringWheel: Object3D | null = null;
  private paintMaterial?: MeshStandardMaterial;

  constructor(readonly spec: VehicleSpec, source: Group, paint?: Color) {
    this.holder.name = `veiculo · ${spec.label}`;
    this.model = source.clone(true);
    this.model.rotation.y = Math.PI;
    this.holder.add(this.model);
    // Materials: own copy of the paint so each car can have its colour.
    this.model.traverse(o => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      const material = mesh.material as Material & { name?: string };
      if (material?.name === 'paint') {
        mesh.material = (material as MeshStandardMaterial).clone();
        (mesh.material as MeshStandardMaterial).color.copy(paint ?? new Color(spec.paintColor ?? '#c0c4c8'));
        this.paintMaterial = mesh.material as MeshStandardMaterial;
      }
    });
    // Wheels: steering pivot (yaw) wrapping a spin node, so the two rotations never couple.
    for (const wheel of spec.wheels) {
      const node = this.model.getObjectByName(wheel.node);
      if (!node) continue;
      let steer: Object3D | null = null;
      if (wheel.steer && node.parent) {
        steer = new Group();
        steer.position.copy(node.position);
        node.parent.add(steer);
        node.position.set(0, 0, 0);
        steer.add(node);
      }
      this.wheelSpin.push(node);
      this.wheelSteer.push(steer);
    }
    for (const door of spec.doors) {
      const node = this.model.getObjectByName(door.node);
      if (node) this.doors.set(door.id, node);
    }
    this.steeringWheel = spec.steeringWheel ? this.model.getObjectByName(spec.steeringWheel.node) ?? null : null;
  }

  setPaint(color: Color): void { this.paintMaterial?.color.copy(color); }

  /**
   * Interaction rig in the holder frame (forward -Z): the model's +Z positions turned by PI.
   * Door hinge rotations happen on the model's own door nodes, so their sign stays as authored.
   */
  rig(space: Object3D = this.holder): VehicleRig {
    const toHolder = (t: Triple) => new Vector3(-t[0], t[1], -t[2]);
    const halfWidth = this.spec.halfWidth ?? this.spec.dimensions[0] / 2;
    const doors: DoorRig[] = this.spec.doors.map(d => ({
      id: d.id, side: (d.side === 'left' ? -1 : 1) as -1 | 1,
      hinge: toHolder(d.hinge), handle: toHolder(d.handle), entry: toHolder(d.entry),
      openAngle: d.openAngle, node: this.doors.get(d.id),
    }));
    const seats: SeatRig[] = this.spec.seats.map(s => ({ id: s.id, position: toHolder(s.position), door: s.door }));
    // Open-wheel cars have no doors: a virtual opening on the driver's side, nothing to swing.
    if (!doors.length && seats.length) {
      const seat = seats[0].position;
      doors.push({ id: 'virtual-left', side: -1, hinge: new Vector3(-halfWidth, seat.y, seat.z - 0.6), handle: new Vector3(-halfWidth, seat.y, seat.z + 0.4), entry: new Vector3(-(halfWidth + 0.75), 0, seat.z + 0.35), openAngle: 0 });
      for (const s of seats) s.door = 'virtual-left';
    }
    // The rig's positions live in the holder, so anything parented for the ride uses the holder.
    return {
      space, doors, seats, floorY: this.spec.floorY, halfWidth,
      steeringWheel: this.spec.steeringWheel ? { node: this.steeringWheel ?? undefined, position: toHolder(this.spec.steeringWheel.position) } : undefined,
    };
  }

  /** Spin all wheels by `angle` radians and steer the front ones. */
  animateWheels(angle: number, steer: number): void {
    for (let i = 0; i < this.wheelSpin.length; i++) {
      this.wheelSpin[i].rotation.x += angle;
      const pivot = this.wheelSteer[i];
      if (pivot) pivot.rotation.y = steer;
    }
  }

  dispose(): void {
    this.holder.removeFromParent();
    this.paintMaterial?.dispose();
  }
}

export { v3 as vec3FromTriple };
