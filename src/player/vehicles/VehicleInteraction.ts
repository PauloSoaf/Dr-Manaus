import { Object3D, Quaternion, Vector3 } from 'three/webgpu';
import { Priority, type ActionHandle } from '../animations/graph/AnimationGraph';
import type { PlayerController } from '../PlayerController';
import type { HumanoidCharacter } from '../../world/people/HumanoidCharacter';

/**
 * Getting into and out of a car with the body doing it, GTA-style, from authored clips only:
 *
 *   approach → reach for the handle (door swings open on the pull) → step into the doorway and
 *   turn to face out → sit on the seat edge (feet still outside) → pivot the legs in while the
 *   hands find the wheel and the door shuts → drive.
 *
 * Exit is the same in reverse; a fast exit bails out with a roll. A car with someone at the wheel
 * is a carjack: the driver is pulled out, stumbles and runs before the hero sits down. The root is
 * warped (moved and turned) so each clip ends exactly where the car's seat and door are; no bone
 * is ever posed by code.
 *
 * Positions in a VehicleRig are in the vehicle group's local frame: forward -Z, right +X.
 */
export interface DoorRig {
  id: string;
  side: -1 | 1;
  /** Hinge (front edge) and handle on the outer surface. */
  hinge: Vector3;
  handle: Vector3;
  /** Ground point outside the door where a standing character opens it. */
  entry: Vector3;
  /** Rotation about local Y that opens the door fully (signed). */
  openAngle: number;
  node?: Object3D;
}
export interface SeatRig { id: 'driver' | 'passenger'; position: Vector3; door: string }
export interface VehicleRig {
  /** Frame the positions are expressed in (the vehicle group). */
  space: Object3D;
  doors: DoorRig[];
  seats: SeatRig[];
  steeringWheel?: { node?: Object3D; position: Vector3 };
  /** Car floor height in the vehicle frame (where seated feet rest). */
  floorY: number;
  /** Outer half-width of the body at seat height: the doorway stands just outside it. */
  halfWidth?: number;
}

export interface InteractionVehicle {
  readonly group: Object3D;
  readonly position: Vector3;
  readonly velocity: Vector3;
  yaw: number;
  isOccupied: boolean;
  steeringAngle: number;
}

export interface InteractionHooks {
  notify?(text: string): void;
  sound?(name: string): void;
  /** A crime was witnessed-worthy (carjack, bail-out) at this world point. */
  event?(kind: 'carjack' | 'car-exit' | 'car-enter', at: Vector3): void;
  /** Called when the hero is seated and the car should take input. */
  onSeated?(): void;
  /** Called when the hero is back on foot. */
  onExited?(): void;
  /** A pulled-out driver needs a life after the cutscene (hand to the pedestrian system). */
  releaseDriver?(driver: HumanoidCharacter, fleeFrom: Vector3): void;
  groundHeight?(x: number, z: number): number;
}

type Phase = 'idle' | 'approach' | 'open' | 'pull' | 'turn' | 'sit' | 'swing' | 'seated'
  | 'exitOpen' | 'exitSwing' | 'exitStand' | 'exitStep';

const SIT_PELVIS = { up: 0.656, back: 0.371 };
const DRIVE_PELVIS = { up: 0.654, back: 0.347 };
const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const up = new Vector3(0, 1, 0);

export class VehicleInteraction {
  phase: Phase = 'idle';
  private vehicle: InteractionVehicle | null = null;
  private rig: VehicleRig | null = null;
  private door: DoorRig | null = null;
  private seat: SeatRig | null = null;
  private driver: HumanoidCharacter | null = null;
  private timer = 0;
  private phaseLength = 0;
  private doorAngle = 0;
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private fromYaw = 0;
  private toYaw = 0;
  private readonly root = new Vector3();
  private rootYaw = 0;
  private handle: ActionHandle | null = null;
  private driverFrom = new Vector3();
  private driverYaw = 0;
  private readonly tmp = new Vector3();
  private readonly tmp2 = new Vector3();
  private readonly q = new Quaternion();

  constructor(private readonly player: PlayerController, private readonly hooks: InteractionHooks = {}) {}

  get busy(): boolean { return this.phase !== 'idle' && this.phase !== 'seated'; }
  get seated(): boolean { return this.phase === 'seated'; }
  get active(): boolean { return this.phase !== 'idle'; }

  /** Starts entering `vehicle`. A driver (traffic car) makes it a carjack. */
  enter(vehicle: InteractionVehicle, rig: VehicleRig, driver: HumanoidCharacter | null = null): boolean {
    if (this.phase !== 'idle') return false;
    this.vehicle = vehicle; this.rig = rig; this.driver = driver;
    this.seat = rig.seats.find(s => s.id === 'driver') ?? rig.seats[0] ?? null;
    this.door = rig.doors.find(d => d.id === this.seat?.door) ?? rig.doors[0] ?? null;
    if (!this.seat || !this.door) return false;
    this.doorAngle = 0;
    this.setDoor(0);
    if (driver) this.attachDriver(driver);
    this.player.beginScripted();
    this.beginPhase('approach', 0);
    this.hooks.event?.(driver ? 'carjack' : 'car-enter', this.vehicle.position);
    return true;
  }

  /** Leaves the car. Fast cars are bailed out of with a roll. */
  exit(): boolean {
    if (this.phase !== 'seated' || !this.vehicle || !this.rig || !this.door || !this.seat) return false;
    const speed = this.vehicle.velocity.length();
    this.vehicle.isOccupied = false;
    this.detachPlayer();
    if (speed > 9) { this.bail(); return true; }
    this.beginPhase('exitOpen', 0.45);
    this.hooks.sound?.('car-door-open');
    return true;
  }

  /** Drops the scripted ride at once (vehicle swapped to a craft without seats): body back to the world. */
  forceRelease(): void {
    if (this.phase === 'idle') return;
    this.detachPlayer();
    this.player.character.setBaseOverride(null);
    this.player.endScripted();
    if (this.driver) { this.player.sceneRoot.attach(this.driver.group); this.hooks.releaseDriver?.(this.driver, this.player.position.clone()); this.driver = null; }
    this.setDoor(0);
    this.phase = 'idle';
  }

  /** Cancels an entry that has not sat down yet (e.g. the car drove off or exploded). */
  abort(): void {
    if (this.phase === 'idle' || this.phase === 'seated') return;
    this.detachPlayer();
    this.player.endScripted();
    if (this.driver) { this.hooks.releaseDriver?.(this.driver, this.root.clone()); this.driver = null; }
    this.phase = 'idle';
    this.hooks.onExited?.();
  }

  private beginPhase(phase: Phase, length: number): void { this.phase = phase; this.timer = 0; this.phaseLength = length; }

  // ------------------------------------------------------------ geometry helpers

  /** Vehicle-frame point to the player's root frame (both roots carry the floating origin). */
  private world(local: Vector3, out = new Vector3()): Vector3 {
    this.rig!.space.updateWorldMatrix(true, false);
    out.copy(local).applyMatrix4(this.rig!.space.matrixWorld);
    this.player.sceneRoot.updateWorldMatrix(true, false);
    return this.player.sceneRoot.worldToLocal(out);
  }
  private vehicleYaw(): number {
    this.rig!.space.getWorldQuaternion(this.q);
    const f = this.tmp2.set(0, 0, -1).applyQuaternion(this.q);
    return Math.atan2(-f.x, -f.z);
  }
  /** World yaw that faces the car's side from outside (toward the door's inside). */
  private yawFacingCar(): number { return wrap(this.vehicleYaw() + (this.door!.side < 0 ? -Math.PI / 2 : Math.PI / 2)); }
  /** World yaw facing out of the door. */
  private yawFacingOut(): number { return wrap(this.yawFacingCar() + Math.PI); }
  private ground(p: Vector3): number { return this.hooks.groundHeight?.(p.x, p.z) ?? p.y; }

  /** Root position that puts the pelvis on the seat for a given world yaw and pelvis offset. */
  private seatedRoot(yaw: number, pelvis: { up: number; back: number }, out: Vector3): Vector3 {
    const size = this.player.size;
    const seat = this.world(this.seat!.position, this.tmp);
    // Facing (-sin, -cos): "back" is the opposite direction.
    return out.set(seat.x - Math.sin(yaw) * pelvis.back * size, seat.y - pelvis.up * size, seat.z - Math.cos(yaw) * pelvis.back * size);
  }
  /** Standing spot in the doorway, just outside the body wall beside the seat. */
  private doorway(out: Vector3): Vector3 {
    const s = this.seat!.position;
    const side = this.door!.side;
    const x = this.rig!.halfWidth !== undefined ? side * (this.rig!.halfWidth + 0.3) : s.x + side * 0.72;
    this.world(this.tmp.set(x, s.y, s.z), out);
    out.y = this.ground(out);
    return out;
  }

  private setDoor(angle: number): void {
    this.doorAngle = angle;
    if (this.door?.node) this.door.node.rotation.y = angle * this.door.openAngle;
  }

  private place(position: Vector3, yaw: number, speed = 0): void {
    this.root.copy(position); this.rootYaw = yaw;
    this.player.setScriptedPose(position, yaw, speed);
  }

  // ------------------------------------------------------------ driver (carjack victim)

  private attachDriver(driver: HumanoidCharacter): void {
    const seat = this.seat!.position;
    this.rig!.space.add(driver.group);
    driver.group.position.set(seat.x, seat.y - DRIVE_PELVIS.up * driver.appearance.scale, seat.z + DRIVE_PELVIS.back * driver.appearance.scale);
    driver.group.rotation.set(0, 0, 0);
    driver.pose('Driving_Loop', 1, 0.01);
  }

  // ------------------------------------------------------------ per-frame

  update(dt: number): void {
    if (this.phase === 'idle' || !this.vehicle || !this.rig || !this.door || !this.seat) return;
    this.timer += dt;
    const u = this.phaseLength > 0 ? clamp01(this.timer / this.phaseLength) : 1;
    const character = this.player.character;
    switch (this.phase) {
      case 'approach': {
        const entry = this.world(this.door.entry, this.to);
        entry.y = this.ground(entry);
        const current = this.player.position;
        const delta = this.tmp.subVectors(entry, current); delta.y = 0;
        const distance = delta.length();
        const targetYaw = this.yawFacingCar();
        if (distance < 0.06 || this.timer > 6) {
          const yawError = Math.abs(wrap(targetYaw - this.player.facingYaw));
          const yaw = this.player.facingYaw + wrap(targetYaw - this.player.facingYaw) * Math.min(1, dt * 10);
          this.place(entry, yaw, 0);
          if (yawError < 0.08 || this.timer > 6.5) this.startOpen();
          break;
        }
        // Walk (or jog when far) along a straight line, turning into the stride.
        const speed = distance > 4 ? 5.2 : Math.max(1.0, Math.min(1.7, distance * 1.4));
        const step = Math.min(distance, speed * dt);
        const heading = Math.atan2(-delta.x, -delta.z);
        const yaw = distance < 0.5
          ? this.player.facingYaw + wrap(targetYaw - this.player.facingYaw) * Math.min(1, dt * 6)
          : this.player.facingYaw + wrap(heading - this.player.facingYaw) * Math.min(1, dt * 9);
        current.addScaledVector(delta.normalize(), step);
        current.y = this.ground(current);
        this.place(current, yaw, step / Math.max(1e-4, dt));
        break;
      }
      case 'open': {
        // The handle is pulled at the reach's full extension; the door follows the hand back.
        this.setDoor(smooth((u - 0.38) / 0.45));
        if (u >= 1) {
          if (this.driver) this.startPull();
          else this.startTurn();
        }
        break;
      }
      case 'pull': {
        const driver = this.driver!;
        // Dragged out: pivot toward the door, rise out of the seat through the opening, then
        // stumble clear past the front of the hero (who stands by the handle) so the doorway is free.
        const side = this.door.side;
        const seat = this.seat.position;
        const scale = driver.appearance.scale;
        const halfWidth = this.rig.halfWidth ?? Math.abs(seat.x) + 0.45;
        driver.group.rotation.y = this.driverYaw = (side < 0 ? 1 : -1) * Math.PI / 2 * smooth(u / 0.3);
        if (u > 0.25 && !driver.graph.currentAction) driver.play('Sit_Exit', { priority: Priority.Critical, duration: 0.55, fadeIn: 0.08, fadeOut: 0.12 });
        const seatedY = seat.y - DRIVE_PELVIS.up * scale, seatedZ = seat.z + DRIVE_PELVIS.back * scale;
        const rise = smooth((u - 0.3) / 0.45), clear = smooth((u - 0.75) / 0.25);
        const x = seat.x + (side * (halfWidth + 0.35) - seat.x) * rise + side * 1.15 * clear;
        const z = seatedZ + (seat.z - seatedZ) * rise - 0.35 * clear;
        driver.group.position.set(x, seatedY * (1 - rise), z);
        if (u >= 1) this.releaseDriver();
        break;
      }
      case 'turn': {
        // Two steps into the doorway while turning to face out.
        const p = smooth(u);
        this.tmp.lerpVectors(this.from, this.to, p);
        const yaw = this.fromYaw + wrap(this.toYaw - this.fromYaw) * p;
        this.place(this.tmp, yaw, u < 0.85 ? 1.15 : 0);
        if (u >= 1) this.startSit();
        break;
      }
      case 'sit': {
        // Sit back onto the seat edge; the root lands where the clip's pelvis meets the cushion.
        const end = this.seatedRoot(this.toYaw, SIT_PELVIS, this.tmp2);
        const p = smooth(u);
        this.tmp.lerpVectors(this.from, end, p);
        this.tmp.y = this.from.y + (end.y - this.from.y) * smooth((u - 0.35) / 0.65);
        this.place(this.tmp, this.toYaw, 0);
        if (u >= 1) this.startSwing();
        break;
      }
      case 'swing': {
        // Pivot on the seat: legs come in, hands find the wheel, the door shuts behind.
        const p = smooth(u);
        const yaw = this.fromYaw + wrap(this.toYaw - this.fromYaw) * p;
        const pelvis = { up: SIT_PELVIS.up + (DRIVE_PELVIS.up - SIT_PELVIS.up) * p, back: SIT_PELVIS.back + (DRIVE_PELVIS.back - SIT_PELVIS.back) * p };
        this.seatedRoot(yaw, pelvis, this.tmp);
        this.place(this.tmp, yaw, 0);
        if (u > 0.45) character.setBaseOverride('Driving_Loop');
        const close = smooth((u - 0.5) / 0.5);
        this.setDoor(1 - close);
        if (u >= 1) this.finishSeat();
        break;
      }
      case 'seated': {
        const wheel = this.rig.steeringWheel?.node;
        if (wheel) wheel.rotation.z = -this.vehicle.steeringAngle * 2.4;
        break;
      }
      case 'exitOpen': {
        this.setDoor(smooth(u));
        this.vehicle.velocity.multiplyScalar(Math.exp(-dt * 5));
        if (u >= 1) {
          this.fromYaw = this.vehicleYaw(); this.toYaw = this.yawFacingOut();
          this.beginPhase('exitSwing', 0.6);
        }
        break;
      }
      case 'exitSwing': {
        const p = smooth(u);
        const yaw = this.fromYaw + wrap(this.toYaw - this.fromYaw) * p;
        const pelvis = { up: DRIVE_PELVIS.up + (SIT_PELVIS.up - DRIVE_PELVIS.up) * p, back: DRIVE_PELVIS.back + (SIT_PELVIS.back - DRIVE_PELVIS.back) * p };
        this.seatedRoot(yaw, pelvis, this.tmp);
        this.place(this.tmp, yaw, 0);
        if (u > 0.35) character.setBaseOverride('Sit_Idle_Loop');
        if (u >= 1) {
          this.from.copy(this.root);
          this.doorway(this.to);
          character.setBaseOverride(null);
          this.handle = character.playAction('Sit_Exit', { priority: Priority.Vehicle, rate: 1.1, fadeIn: 0.12, fadeOut: 0.2, hold: false });
          this.beginPhase('exitStand', this.player.character.animation ? 1.03 / 1.1 : 0.9);
        }
        break;
      }
      case 'exitStand': {
        const p = smooth(u);
        this.tmp.lerpVectors(this.from, this.to, p);
        this.tmp.y = this.from.y + (this.to.y - this.from.y) * smooth(u / 0.7);
        this.place(this.tmp, this.toYaw, 0);
        if (u >= 1) {
          this.from.copy(this.root);
          this.to.copy(this.root).addScaledVector(this.tmp2.set(-Math.sin(this.toYaw), 0, -Math.cos(this.toYaw)), 0.55);
          this.to.y = this.ground(this.to);
          this.beginPhase('exitStep', 0.5);
          this.hooks.sound?.('car-door-close');
        }
        break;
      }
      case 'exitStep': {
        const p = smooth(u);
        this.tmp.lerpVectors(this.from, this.to, p);
        this.place(this.tmp, this.toYaw, u < 0.8 ? 1.2 : 0);
        this.setDoor(1 - smooth(u / 0.8));
        if (u >= 1) this.finishExit();
        break;
      }
      default: break;
    }
    this.driver?.update(dt);
  }

  // ------------------------------------------------------------ transitions

  private startOpen(): void {
    const hand = this.door!.side < 0 ? 'Reach_L' : 'Reach_R';
    this.handle = this.player.character.playAction(hand, { priority: Priority.Vehicle, from: 0.12, to: 0.88, duration: 0.95, fadeIn: 0.12, fadeOut: 0.18 });
    this.beginPhase('open', 0.95);
    this.hooks.sound?.('car-door-open');
  }

  private startPull(): void {
    const hand = this.door!.side < 0 ? 'Reach_L' : 'Reach_R';
    this.player.character.playAction(hand, { priority: Priority.Vehicle, from: 0.2, to: 0.85, duration: 0.8, fadeIn: 0.08, fadeOut: 0.2 });
    this.beginPhase('pull', 1.1);
    this.hooks.notify?.('Tirando o motorista do carro!');
  }

  private releaseDriver(): void {
    const driver = this.driver;
    if (!driver) return;
    // Back into the world (same root as the hero), keeping where the stumble left them.
    this.player.sceneRoot.attach(driver.group);
    driver.play('Hit_React_B', { priority: Priority.Critical, fadeIn: 0.05, fadeOut: 0.25 });
    this.hooks.releaseDriver?.(driver, this.player.position.clone());
    this.driver = null;
    this.startTurn();
  }

  private startTurn(): void {
    this.from.copy(this.player.position);
    this.doorway(this.to);
    this.fromYaw = this.player.facingYaw;
    // Turn through the car's rear so the open door (hinged at the front) is never walked through.
    const out = this.yawFacingOut();
    const viaRear = wrap(this.vehicleYaw() + Math.PI);
    const direct = wrap(out - this.fromYaw);
    const towardRear = Math.sign(wrap(viaRear - this.fromYaw)) || 1;
    this.toYaw = this.fromYaw + (Math.sign(direct) === towardRear ? direct : direct - towardRear * Math.PI * 2);
    this.beginPhase('turn', 0.6);
  }

  private startSit(): void {
    this.from.copy(this.player.position);
    this.toYaw = this.yawFacingOut();
    this.handle = this.player.character.playAction('Sit_Enter', { priority: Priority.Vehicle, rate: 1.2, fadeIn: 0.15, fadeOut: 0.18, hold: true });
    this.beginPhase('sit', 1.3 / 1.2);
  }

  private startSwing(): void {
    this.player.character.setBaseOverride('Sit_Idle_Loop');
    this.player.character.stopAction(this.handle, 0.25); this.handle = null;
    this.fromYaw = this.player.facingYaw;
    const target = this.vehicleYaw();
    this.toYaw = this.fromYaw + wrap(target - this.fromYaw);
    this.beginPhase('swing', 0.7);
  }

  private finishSeat(): void {
    this.setDoor(0);
    this.hooks.sound?.('car-door-close');
    // Ride with the car: the body becomes part of the vehicle, at the seat, facing forward.
    const model = this.player.model;
    const space = this.rig!.space;
    space.attach(model);
    const seatRoot = this.seatedRootLocal(new Vector3());
    model.position.copy(seatRoot);
    model.quaternion.identity();
    this.player.setScriptedLocal(true);
    this.vehicle!.isOccupied = true;
    this.phase = 'seated';
    this.hooks.onSeated?.();
  }

  /** Seated root in the vehicle frame (facing the car's forward, -Z). */
  private seatedRootLocal(out: Vector3): Vector3 {
    const s = this.seat!.position, size = this.player.size;
    return out.set(s.x, s.y - DRIVE_PELVIS.up * size, s.z + DRIVE_PELVIS.back * size);
  }

  private detachPlayer(): void {
    const model = this.player.model;
    if (model.parent && model.parent === this.rig?.space) {
      this.player.sceneRoot.attach(model);
      this.root.copy(model.position);
      this.player.position.copy(this.root);
      this.player.facingYaw = this.vehicleYaw();
    }
    this.player.setScriptedLocal(false);
  }

  private finishExit(): void {
    this.player.character.setBaseOverride(null);
    this.player.endScripted();
    this.player.facingYaw = this.toYaw;
    this.phase = 'idle';
    this.hooks.event?.('car-exit', this.player.position);
    this.hooks.onExited?.();
  }

  private bail(): void {
    this.setDoor(1);
    const outward = this.tmp.set(-Math.sin(this.yawFacingOut()), 0, -Math.cos(this.yawFacingOut()));
    this.doorway(this.root);
    this.player.position.copy(this.root);
    this.player.character.setBaseOverride(null);
    this.player.endScripted();
    this.player.velocity.copy(this.vehicle!.velocity).multiplyScalar(0.45).addScaledVector(outward, 6);
    this.player.facingYaw = Math.atan2(-this.player.velocity.x, -this.player.velocity.z);
    this.player.character.playAction('Roll', { priority: Priority.Critical, rate: 1.1, fadeIn: 0.04, fadeOut: 0.25 });
    this.hooks.notify?.('Pulou do carro em movimento!');
    this.hooks.event?.('car-exit', this.player.position);
    this.phase = 'idle';
    this.hooks.onExited?.();
    void up;
  }
}
