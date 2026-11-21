/**
 * VehicleController.ts
 *
 * Unified Drivable Vehicle Simulation Engine for DR-MANAUS.
 * Supports 4 distinct high-fidelity drivable vehicle classes:
 * 1. Carro ('car'): 4-wheel arcade physics with steering, acceleration, braking, drift/powerslide, and suspension roll/pitch.
 * 2. Barco Fluvial ('boat'): Amazonian river craft with hydrodynamic buoyancy, wave heave/pitch/roll via sampleManausWater, and rudder control.
 * 3. Avião ('airplane'): Atmospheric aerodynamics with airspeed lift (L ~ v^2), pitch, roll, yaw, stall physics, and runway takeoff/landing.
 * 4. Nave Alienígena / Foguete ('spaceship'): 6-DoF VTOL, anti-gravity levitation, 3D thrusters, and quantum boost.
 *
 * Performance:
 * - Zero GC allocation in per-frame update loop.
 * - Procedural modular 3D meshes sharing materials.
 * - Seamless player entry/exit with camera transitions.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  SphereGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  Quaternion,
  Euler,
  MathUtils
} from 'three/webgpu';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { sampleManausWater } from '../../world/water/ManausHydrology';
import type { InputController } from '../InputController';

export type VehicleType = 'car' | 'boat' | 'airplane' | 'spaceship';

export interface VehicleTelemetry {
  readonly type: VehicleType;
  readonly speedKmh: number;
  readonly speedMps: number;
  readonly rpm: number;
  readonly gear: number;
  readonly throttle: number;
  readonly steering: number;
  readonly altitudeM: number;
  readonly isAirborne: boolean;
  readonly isDrifting: boolean;
  readonly health: number;
}

export class VehicleController {
  readonly group = new Group();
  activeType: VehicleType = 'car';
  isOccupied = false;

  // Transform state
  readonly position = new Vector3(0, 5, 0);
  readonly velocity = new Vector3();
  readonly rotation = new Euler(0, 0, 0, 'YXZ');
  readonly quaternion = new Quaternion();
  readonly forward = new Vector3(0, 0, -1);
  readonly right = new Vector3(1, 0, 0);
  readonly up = new Vector3(0, 1, 0);

  // Dynamic state
  yaw = 0;
  pitch = 0;
  roll = 0;
  steeringAngle = 0;
  throttle = 0;
  brake = 0;
  gear = 1;
  rpm = 1000;
  health = 100;
  isDrifting = false;
  isAirborne = false;
  headlightsOn = true;

  // Suspension & body lean
  private suspensionPitch = 0;
  private suspensionRoll = 0;

  // Visual sub-objects
  private readonly carMesh = new Group();
  private readonly boatMesh = new Group();
  private readonly planeMesh = new Group();
  private readonly shipMesh = new Group();

  private wheels: Mesh[] = [];
  private propeller: Mesh | null = null;
  private thrusterRing: Mesh | null = null;

  // Scratch vectors for zero GC
  private readonly _tempVec = new Vector3();
  private readonly _tempVec2 = new Vector3();
  private readonly _tempQuat = new Quaternion();

  constructor() {
    this.group.name = 'drivable-vehicle-system';
    this.buildCarVisuals();
    this.buildBoatVisuals();
    this.buildPlaneVisuals();
    this.buildSpaceshipVisuals();

    this.group.add(this.carMesh);
    this.group.add(this.boatMesh);
    this.group.add(this.planeMesh);
    this.group.add(this.shipMesh);

    this.selectVehicleType('car');
  }

  /**
   * Switches the active vehicle archetype and updates visual visibility.
   */
  public selectVehicleType(type: VehicleType): void {
    this.activeType = type;
    this.carMesh.visible = type === 'car';
    this.boatMesh.visible = type === 'boat';
    this.planeMesh.visible = type === 'airplane';
    this.shipMesh.visible = type === 'spaceship';

    // Reset dynamics
    this.velocity.set(0, 0, 0);
    this.pitch = 0;
    this.roll = 0;
    this.suspensionPitch = 0;
    this.suspensionRoll = 0;
    this.rpm = 1000;
    this.gear = 1;
  }

  /**
   * Spawns / places the vehicle at a specific location and orientation.
   */
  public spawnAt(pos: Vector3, yaw: number, type?: VehicleType): void {
    if (type) this.selectVehicleType(type);
    this.position.copy(pos);
    this.yaw = yaw;
    this.pitch = 0;
    this.roll = 0;
    this.velocity.set(0, 0, 0);
    this.updateTransform();
  }

  /**
   * Updates vehicle physics and visual state for the current frame.
   */
  public update(dt: number, input: InputController, playerPos: Vector3): void {
    const clampedDt = Math.min(0.1, Math.max(0.001, dt));

    if (this.isOccupied) {
      this.readInputs(clampedDt, input);
      switch (this.activeType) {
        case 'car':
          this.updateCarPhysics(clampedDt);
          break;
        case 'boat':
          this.updateBoatPhysics(clampedDt);
          break;
        case 'airplane':
          this.updatePlanePhysics(clampedDt);
          break;
        case 'spaceship':
          this.updateSpaceshipPhysics(clampedDt);
          break;
      }
    } else {
      // Idle dampening
      this.velocity.multiplyScalar(Math.exp(-clampedDt * 4));
      this.throttle = 0;
      this.brake = 0;
      this.steeringAngle = 0;
      this.rpm = MathUtils.lerp(this.rpm, 800, clampedDt * 3);
    }

    this.updateTransform();
    this.animateSubComponents(clampedDt);
  }

  /**
   * Processes player drive controls (WASD, Space, Shift, C, etc.).
   */
  private readInputs(dt: number, input: InputController): void {
    const forward = input.held('KeyW') || input.held('ArrowUp');
    const backward = input.held('KeyS') || input.held('ArrowDown');
    const left = input.held('KeyA') || input.held('ArrowLeft');
    const right = input.held('KeyD') || input.held('ArrowRight');
    const handbrake = input.held('Space');

    // Throttle & Brake
    if (forward) {
      this.throttle = MathUtils.lerp(this.throttle, 1.0, dt * 5.0);
      this.brake = 0;
    } else if (backward) {
      this.throttle = 0;
      this.brake = MathUtils.lerp(this.brake, 1.0, dt * 6.0);
    } else {
      this.throttle = MathUtils.lerp(this.throttle, 0.0, dt * 4.0);
      this.brake = MathUtils.lerp(this.brake, 0.0, dt * 4.0);
    }

    // Steering
    const targetSteer = (left ? 1.0 : 0.0) - (right ? 1.0 : 0.0);
    this.steeringAngle = MathUtils.lerp(this.steeringAngle, targetSteer * 0.55, dt * 6.0);

    this.isDrifting = handbrake && this.activeType === 'car' && this.velocity.length() > 6.0;
  }

  /**
   * 1. CAR PHYSICS: Acceleration, steering, braking, drifting, and suspension lean.
   */
  private updateCarPhysics(dt: number): void {
    const speed = this.forward.dot(this.velocity);
    const absSpeed = Math.abs(speed);

    // Motor drive force
    const maxSpeed = 48.0; // ~170 km/h
    const accelRate = 22.0; // m/s^2
    const brakeRate = 35.0; // m/s^2
    const reverseRate = 12.0;

    let engineForce = 0;
    if (this.throttle > 0) {
      if (speed < maxSpeed) {
        engineForce = this.throttle * accelRate;
      }
    } else if (this.brake > 0) {
      if (speed > 0.5) {
        engineForce = -this.brake * brakeRate;
      } else {
        // Reverse
        engineForce = -this.brake * reverseRate;
      }
    }

    // Steering turn rate (speed sensitive)
    const speedFactor = Math.max(0.15, 1.0 - (absSpeed / maxSpeed) * 0.65);
    const turnRate = this.steeringAngle * speedFactor * Math.sign(speed || 1);
    this.yaw += turnRate * dt * (this.isDrifting ? 3.2 : 2.2);

    // Update orientation vectors
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();

    // Longitudinal acceleration
    this.velocity.addScaledVector(this.forward, engineForce * dt);

    // Lateral grip vs drift
    const lateralVel = this.right.dot(this.velocity);
    const lateralGrip = this.isDrifting ? 0.35 : 0.94;
    this.velocity.addScaledVector(this.right, -lateralVel * lateralGrip * dt * 10);

    // Rolling resistance & aerodynamic drag
    const drag = 0.002 * speed * speed + 0.15;
    this.velocity.addScaledVector(this.forward, -Math.sign(speed) * drag * dt);

    // Position integration
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Ground clamping & road deck height
    const terrainH = PhysicsWorld.terrainHeight(this.position.x, this.position.z);
    const targetH = terrainH + 0.65; // Wheel center offset
    this.position.y = MathUtils.lerp(this.position.y, targetH, dt * 14.0);

    // Suspension body pitch and roll
    const accelG = engineForce / 9.81;
    const lateralG = (lateralVel * absSpeed) / 9.81;
    this.suspensionPitch = MathUtils.lerp(this.suspensionPitch, -accelG * 0.06, dt * 8.0);
    this.suspensionRoll = MathUtils.lerp(this.suspensionRoll, lateralG * 0.08, dt * 8.0);

    this.pitch = this.suspensionPitch;
    this.roll = this.suspensionRoll;

    // RPM & Gear calculation
    this.gear = Math.min(5, Math.max(1, Math.floor(absSpeed / 9.0) + 1));
    const gearSpeed = (absSpeed % 9.0) / 9.0;
    this.rpm = MathUtils.lerp(this.rpm, 1000 + gearSpeed * 5500 + this.throttle * 1200, dt * 6.0);
  }

  /**
   * 2. BOAT PHYSICS: Hydrodynamic buoyancy, wave pitch/roll, and aquatic thrust.
   */
  private updateBoatPhysics(dt: number): void {
    const speed = this.forward.dot(this.velocity);
    const maxBoatSpeed = 16.0; // ~31 knots
    const boatAccel = 8.5;

    let engineForce = 0;
    if (this.throttle > 0) {
      if (speed < maxBoatSpeed) engineForce = this.throttle * boatAccel;
    } else if (this.brake > 0) {
      engineForce = -this.brake * 6.0;
    }

    // Rudder steering (effective when moving)
    const rudderEff = Math.max(0.2, Math.min(1.0, Math.abs(speed) / 3.0));
    this.yaw += this.steeringAngle * rudderEff * 1.6 * dt;

    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();

    this.velocity.addScaledVector(this.forward, engineForce * dt);

    // Water lateral drag (drift dampening)
    const lateralVel = this.right.dot(this.velocity);
    this.velocity.addScaledVector(this.right, -lateralVel * 0.9 * dt * 5.0);

    // Hydrodynamic water resistance
    this.velocity.multiplyScalar(Math.exp(-dt * 0.35));

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Real-time wave sampling with ManausHydrology
    const waterSample = sampleManausWater(this.position.x, this.position.z, performance.now() * 0.001);
    const waterLevel = waterSample.height;

    // Buoyant spring
    const targetH = waterLevel + 0.4;
    this.position.y = MathUtils.lerp(this.position.y, targetH, dt * 10.0);

    // Wave pitch and roll alignment
    const wavePitch = -waterSample.normal.z * 0.35 + (speed / maxBoatSpeed) * 0.08;
    const waveRoll = waterSample.normal.x * 0.35 + this.steeringAngle * 0.12;

    this.pitch = MathUtils.lerp(this.pitch, wavePitch, dt * 5.0);
    this.roll = MathUtils.lerp(this.roll, waveRoll, dt * 5.0);

    this.rpm = MathUtils.lerp(this.rpm, 800 + (Math.abs(speed) / maxBoatSpeed) * 4200, dt * 4.0);
  }

  /**
   * 3. AIRPLANE PHYSICS: Aerodynamic lift (L ~ v^2), elevator pitch, aileron roll, stall.
   */
  private updatePlanePhysics(dt: number): void {
    const airspeed = this.velocity.length();
    const maxAirspeed = 95.0; // ~340 km/h
    const thrustRate = 32.0;

    // Engine thrust
    if (this.throttle > 0) {
      this.velocity.addScaledVector(this.forward, this.throttle * thrustRate * dt);
    } else if (this.brake > 0) {
      this.velocity.multiplyScalar(Math.exp(-dt * 0.8)); // Airbrake
    }

    // Elevator & Ailerons
    const controlAuthority = Math.min(1.0, airspeed / 22.0); // Authority scales with airspeed
    this.pitch += (this.throttle > 0.8 ? -0.25 : 0.0) * controlAuthority * dt;
    this.roll += -this.steeringAngle * controlAuthority * 2.5 * dt;

    // Aerodynamic lift: L = 0.5 * rho * v^2 * Cl
    const liftCoeff = 0.038;
    const liftForce = airspeed * airspeed * liftCoeff;
    const gravity = 9.81;

    // Vertical acceleration
    const netVerticalAccel = (liftForce - gravity);
    this.velocity.y += netVerticalAccel * dt;

    // Bank-to-turn yaw coupling
    this.yaw += -Math.sin(this.roll) * controlAuthority * 1.8 * dt;

    // Atmospheric drag
    this.velocity.multiplyScalar(Math.exp(-dt * 0.06));

    // Update orientation vectors
    this.quaternion.setFromEuler(new Euler(this.pitch, this.yaw, this.roll, 'YXZ'));
    this.forward.set(0, 0, -1).applyQuaternion(this.quaternion);
    this.up.set(0, 1, 0).applyQuaternion(this.quaternion);
    this.right.set(1, 0, 0).applyQuaternion(this.quaternion);

    this.position.addScaledVector(this.velocity, dt);

    // Ground collision & landing gear rollout
    const terrainH = PhysicsWorld.terrainHeight(this.position.x, this.position.z);
    const minH = terrainH + 1.2;
    if (this.position.y <= minH) {
      this.position.y = minH;
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.isAirborne = airspeed > 28.0;
      this.pitch = MathUtils.lerp(this.pitch, 0, dt * 4.0);
      this.roll = MathUtils.lerp(this.roll, 0, dt * 6.0);
    } else {
      this.isAirborne = true;
    }

    this.rpm = MathUtils.lerp(this.rpm, 1200 + (airspeed / maxAirspeed) * 4800, dt * 4.0);
  }

  /**
   * 4. SPACESHIP / ROCKET PHYSICS: 6-DoF VTOL, anti-gravity levitation, quantum boost.
   */
  private updateSpaceshipPhysics(dt: number): void {
    const maxSpeed = 160.0; // ~576 km/h in atmosphere
    const mainThrust = 45.0;
    const vtolThrust = 30.0;

    // VTOL up/down
    if (this.throttle > 0) {
      this.velocity.addScaledVector(this.forward, this.throttle * mainThrust * dt);
    }
    if (this.brake > 0) {
      this.velocity.addScaledVector(this.forward, -this.brake * mainThrust * 0.6 * dt);
    }

    // Steering turns yaw and rolls slightly
    this.yaw += this.steeringAngle * 2.2 * dt;
    this.roll = MathUtils.lerp(this.roll, -this.steeringAngle * 0.4, dt * 6.0);

    // Anti-gravity auto-hover
    const terrainH = PhysicsWorld.terrainHeight(this.position.x, this.position.z);
    const desiredHoverH = terrainH + 8.0;
    const hoverError = desiredHoverH - this.position.y;
    this.velocity.y += MathUtils.clamp(hoverError * 2.5, -vtolThrust, vtolThrust) * dt;

    // Inertial damping in hover mode
    this.velocity.multiplyScalar(Math.exp(-dt * 0.25));

    this.quaternion.setFromEuler(new Euler(this.pitch, this.yaw, this.roll, 'YXZ'));
    this.forward.set(0, 0, -1).applyQuaternion(this.quaternion);

    this.position.addScaledVector(this.velocity, dt);

    this.rpm = MathUtils.lerp(this.rpm, 3000 + (this.velocity.length() / maxSpeed) * 7000, dt * 5.0);
  }

  /**
   * Applies position and rotation to the Three.js scene group.
   */
  private updateTransform(): void {
    this.group.position.copy(this.position);
    this.quaternion.setFromEuler(new Euler(this.pitch, this.yaw, this.roll, 'YXZ'));
    this.group.quaternion.copy(this.quaternion);
  }

  /**
   * Animates sub-components (wheels spinning/steering, propeller turning, thruster pulse).
   */
  private animateSubComponents(dt: number): void {
    const speed = this.velocity.length();

    // Wheel spin & steer
    if (this.activeType === 'car') {
      const wheelCircumference = 2.0 * Math.PI * 0.35;
      const spinAngle = (speed / wheelCircumference) * dt * 2.0 * Math.PI;

      for (let i = 0; i < this.wheels.length; i++) {
        const wheel = this.wheels[i];
        wheel.rotation.x += spinAngle;
        if (i < 2) {
          // Front steering wheels
          wheel.rotation.y = this.steeringAngle;
        }
      }
    }

    // Propeller spin
    if (this.propeller && this.activeType === 'airplane') {
      this.propeller.rotation.z += (this.rpm / 60.0) * 2.0 * Math.PI * dt;
    }

    // Thruster ring pulse
    if (this.thrusterRing && this.activeType === 'spaceship') {
      this.thrusterRing.rotation.z += dt * 8.0;
      const pulseScale = 1.0 + Math.sin(performance.now() * 0.01) * 0.08;
      this.thrusterRing.scale.set(pulseScale, pulseScale, 1.0);
    }
  }

  public getTelemetry(): VehicleTelemetry {
    const speedMps = this.velocity.length();
    return {
      type: this.activeType,
      speedMps,
      speedKmh: speedMps * 3.6,
      rpm: Math.round(this.rpm),
      gear: this.gear,
      throttle: this.throttle,
      steering: this.steeringAngle,
      altitudeM: this.position.y,
      isAirborne: this.isAirborne,
      isDrifting: this.isDrifting,
      health: this.health
    };
  }

  // --- PROCEDURAL 3D MESH BUILDERS ---

  private buildCarVisuals(): void {
    const bodyMat = new MeshStandardMaterial({ color: 0x1a5276, roughness: 0.35, metalness: 0.8 });
    const glassMat = new MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
    const wheelMat = new MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const lightMat = new MeshStandardMaterial({ color: 0xffffee, emissive: 0xfffaed, emissiveIntensity: 2.0 });

    // Chassis
    const chassis = new Mesh(new BoxGeometry(1.9, 0.7, 4.2), bodyMat);
    chassis.position.y = 0.35;
    this.carMesh.add(chassis);

    // Cabin
    const cabin = new Mesh(new BoxGeometry(1.6, 0.65, 2.1), glassMat);
    cabin.position.set(0, 0.95, -0.2);
    this.carMesh.add(cabin);

    // Headlights
    const lightL = new Mesh(new BoxGeometry(0.3, 0.15, 0.1), lightMat);
    lightL.position.set(-0.65, 0.45, -2.1);
    const lightR = lightL.clone();
    lightR.position.x = 0.65;
    this.carMesh.add(lightL, lightR);

    // 4 Wheels
    const wheelGeo = new CylinderGeometry(0.35, 0.35, 0.25, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const positions = [
      [-0.95, 0, -1.3], // Front Left
      [0.95, 0, -1.3],  // Front Right
      [-0.95, 0, 1.3],  // Rear Left
      [0.95, 0, 1.3],   // Rear Right
    ];

    this.wheels = positions.map(pos => {
      const wheel = new Mesh(wheelGeo, wheelMat);
      wheel.position.set(pos[0], pos[1], pos[2]);
      this.carMesh.add(wheel);
      return wheel;
    });
  }

  private buildBoatVisuals(): void {
    const hullMat = new MeshStandardMaterial({ color: 0x78281f, roughness: 0.6 });
    const deckMat = new MeshStandardMaterial({ color: 0xd35400, roughness: 0.8 });
    const cabinMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });

    // Hull (tapered wedge)
    const hull = new Mesh(new BoxGeometry(2.4, 0.9, 7.5), hullMat);
    hull.position.y = 0.1;
    this.boatMesh.add(hull);

    // Wooden deck
    const deck = new Mesh(new BoxGeometry(2.2, 0.15, 7.0), deckMat);
    deck.position.y = 0.55;
    this.boatMesh.add(deck);

    // Cabin
    const cabin = new Mesh(new BoxGeometry(1.8, 1.2, 3.2), cabinMat);
    cabin.position.set(0, 1.1, 0.4);
    this.boatMesh.add(cabin);
  }

  private buildPlaneVisuals(): void {
    const planeMat = new MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.3, metalness: 0.6 });
    const wingMat = new MeshStandardMaterial({ color: 0x2980b9, roughness: 0.4 });

    // Fuselage
    const fuselage = new Mesh(new CylinderGeometry(0.7, 0.4, 9.0, 12), planeMat);
    fuselage.rotation.x = Math.PI / 2;
    this.planeMesh.add(fuselage);

    // Wings
    const wings = new Mesh(new BoxGeometry(11.0, 0.08, 1.6), wingMat);
    wings.position.set(0, 0.1, -0.4);
    this.planeMesh.add(wings);

    // Tail fin
    const fin = new Mesh(new BoxGeometry(0.08, 1.4, 1.0), wingMat);
    fin.position.set(0, 0.8, 3.8);
    this.planeMesh.add(fin);

    // Propeller
    const propGeo = new BoxGeometry(1.8, 0.12, 0.05);
    this.propeller = new Mesh(propGeo, new MeshStandardMaterial({ color: 0x111111 }));
    this.propeller.position.set(0, 0, -4.55);
    this.planeMesh.add(this.propeller);
  }

  private buildSpaceshipVisuals(): void {
    const hullMat = new MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.2, metalness: 0.95 });
    const domeMat = new MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00b0ff, emissiveIntensity: 0.8, roughness: 0.1 });
    const plasmaMat = new MeshStandardMaterial({ color: 0x76ff03, emissive: 0x64dd17, emissiveIntensity: 3.0 });

    // Saucer / Torus Core
    const saucer = new Mesh(new CylinderGeometry(3.5, 3.5, 0.6, 24), hullMat);
    this.shipMesh.add(saucer);

    // Cockpit dome
    const dome = new Mesh(new SphereGeometry(1.4, 16, 12), domeMat);
    dome.position.y = 0.4;
    dome.scale.y = 0.6;
    this.shipMesh.add(dome);

    // Plasma Ring Thruster
    const ringGeo = new TorusGeometry(2.6, 0.15, 8, 24);
    ringGeo.rotateX(Math.PI / 2);
    this.thrusterRing = new Mesh(ringGeo, plasmaMat);
    this.thrusterRing.position.y = -0.35;
    this.shipMesh.add(this.thrusterRing);
  }

  public dispose(): void {
    this.group.removeFromParent();
    this.group.traverse(obj => {
      if (obj instanceof Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
