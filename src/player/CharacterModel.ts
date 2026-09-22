import { Bone, Group, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh, Vector3, type PerspectiveCamera } from 'three/webgpu';
import { createCharacterGeometry, HUMAN_RIG } from './CharacterGeometry';
import { CosmicAura } from './cosmic/CosmicAura';
import { CosmicTrail } from './cosmic/CosmicTrail';
import { CosmicMaterial, type CosmicLevel } from './cosmic/CosmicMaterial';
import { CosmicVideoSource } from './cosmic/CosmicVideoSource';
import { AnimationController } from './animations/AnimationController';
import type { CombatMove } from './animations/types';

export type { CosmicLevel };

export class CharacterModel {
  readonly group = new Group();
  readonly hips = new Bone();
  readonly spine = new Bone();
  readonly chest = new Bone();
  readonly neck = new Bone();
  readonly head = new Bone();
  readonly leftShoulder = new Bone(); readonly rightShoulder = new Bone();
  readonly leftArm = new Bone(); readonly rightArm = new Bone();
  readonly leftForearm = new Bone(); readonly rightForearm = new Bone();
  readonly leftHand = new Bone(); readonly rightHand = new Bone();
  readonly leftLeg = new Bone(); readonly rightLeg = new Bone();
  readonly leftShin = new Bone(); readonly rightShin = new Bone();
  readonly leftFoot = new Bone(); readonly rightFoot = new Bone();
  readonly cosmicSource?: CosmicVideoSource;
  readonly cosmicMaterial?: CosmicMaterial;
  readonly surface: SkinnedMesh;
  readonly animationController = new AnimationController();
  private readonly skeleton: Skeleton;
  private readonly accents: Mesh;
  private readonly accentMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  private readonly echoMaterial?: MeshBasicMaterial;
  private readonly aura?: CosmicAura;
  private readonly trail?: CosmicTrail;
  private facing = new Vector3(0, 0, -1);
  private level: CosmicLevel | null = null;
  private levelSpeed = 0;
  private enabled = true;
  private disposed = false;
  private currentCharacterSize = 1;
  private readonly defaultVelocity = new Vector3();

  constructor(echo = false) {
    this.group.name = echo ? 'cosmic-echo' : 'DR Manaus · portal silhouette';
    if (!echo) {
      this.cosmicSource = new CosmicVideoSource();
      this.cosmicMaterial = new CosmicMaterial({ source: this.cosmicSource });
    } else {
      this.echoMaterial = new MeshBasicMaterial({ color: '#3f9b96', transparent: true, opacity: 0.66, toneMapped: false });
    }
    const geometry = createCharacterGeometry();
    this.surface = new SkinnedMesh(geometry.skin, this.cosmicMaterial?.material ?? this.echoMaterial!);
    this.surface.name = 'cosmic-silhouette';
    this.surface.castShadow = !echo;
    this.surface.frustumCulled = false;
    this.group.add(this.surface, this.hips);

    // Build upper body
    this.hips.add(this.spine);
    this.spine.add(this.chest);
    this.chest.add(this.neck);
    this.neck.add(this.head);
    this.chest.add(this.leftShoulder, this.rightShoulder);

    // Build arms
    this.leftShoulder.add(this.leftArm);
    this.rightShoulder.add(this.rightArm);
    for (const [arm, forearm, hand, side] of [
      [this.leftArm, this.leftForearm, this.leftHand, -1],
      [this.rightArm, this.rightForearm, this.rightHand, 1],
    ] as const) {
      arm.add(forearm);
      forearm.add(hand);
    }

    // Build legs
    this.hips.add(this.leftLeg, this.rightLeg);
    for (const [leg, shin, foot] of [
      [this.leftLeg, this.leftShin, this.leftFoot],
      [this.rightLeg, this.rightShin, this.rightFoot],
    ] as const) {
      leg.add(shin);
      shin.add(foot);
    }

    this.hips.position.set(0, HUMAN_RIG.hipY, 0);
    this.spine.position.set(0, HUMAN_RIG.spineY - HUMAN_RIG.hipY, 0);
    this.chest.position.set(0, HUMAN_RIG.chestY - HUMAN_RIG.spineY, 0);
    this.neck.position.set(0, HUMAN_RIG.neckY - HUMAN_RIG.chestY, 0);
    this.head.position.set(0, HUMAN_RIG.headY - HUMAN_RIG.neckY, 0);

    const shoulderOffsetX = 0.08;
    const shoulderOffsetY = HUMAN_RIG.shoulderY - HUMAN_RIG.chestY - 0.05;
    this.leftShoulder.position.set(-shoulderOffsetX, shoulderOffsetY, 0);
    this.rightShoulder.position.set(shoulderOffsetX, shoulderOffsetY, 0);

    const armOffsetX = HUMAN_RIG.shoulderX - shoulderOffsetX;
    this.leftArm.position.set(-armOffsetX, 0.05, 0);
    this.rightArm.position.set(armOffsetX, 0.05, 0);

    for (const [arm, forearm, hand, side] of [
      [this.leftArm, this.leftForearm, this.leftHand, -1],
      [this.rightArm, this.rightForearm, this.rightHand, 1],
    ] as const) {
      forearm.position.set(side * 0.03, HUMAN_RIG.elbowY - HUMAN_RIG.shoulderY, -0.007);
      hand.position.set(side * 0.01, HUMAN_RIG.wristY - HUMAN_RIG.elbowY, -0.009);
    }

    this.leftLeg.position.set(-HUMAN_RIG.hipX, 0, 0);
    this.rightLeg.position.set(HUMAN_RIG.hipX, 0, 0);

    for (const [leg, shin, foot] of [
      [this.leftLeg, this.leftShin, this.leftFoot],
      [this.rightLeg, this.rightShin, this.rightFoot],
    ] as const) {
      shin.position.set(0, HUMAN_RIG.kneeY - HUMAN_RIG.hipY, -0.016);
      foot.position.set(0, HUMAN_RIG.footY - HUMAN_RIG.kneeY, 0.016);
    }

    this.group.updateMatrixWorld(true);
    this.skeleton = new Skeleton([
      this.hips,
      this.spine,
      this.chest,
      this.neck,
      this.head,
      this.leftShoulder,
      this.leftArm,
      this.leftForearm,
      this.leftHand,
      this.rightShoulder,
      this.rightArm,
      this.rightForearm,
      this.rightHand,
      this.leftLeg,
      this.leftShin,
      this.leftFoot,
      this.rightLeg,
      this.rightShin,
      this.rightFoot,
    ]);
    this.surface.bind(this.skeleton);

    this.accents = new Mesh(geometry.accents, this.accentMaterial);
    this.accents.name = 'cosmic-eyes-and-sigil';
    this.head.add(this.accents);

    if (!echo) {
      this.aura = new CosmicAura(this.group);
      this.trail = new CosmicTrail(this.group);
    }
  }

  get cosmicEnabled(): boolean { return this.enabled; }
  set cosmicEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.cosmicMaterial) this.cosmicMaterial.enabled = enabled;
    this.cosmicSource?.setEnabled(enabled);
  }

  updateCosmicView(camera: PerspectiveCamera): void {
    this.cosmicMaterial?.updateView(camera);
  }

  get cosmicDiagnostics(): Record<string, unknown> {
    return { ...this.cosmicSource?.diagnostics, ...this.cosmicMaterial?.metrics, bodyDraws: 2 };
  }

  setCosmicLevel(level: CosmicLevel, speed: number, forward?: Vector3): void {
    this.level = level;
    this.levelSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    if (forward && forward.lengthSq() > 1e-6) this.facing.copy(forward);
  }

  aimEnergy(direction: Vector3): void {
    this.spine.rotation.x = 0;
    this.chest.rotation.x = 0;
    this.rightArm.rotation.set(Math.PI / 2 + Math.asin(Math.max(-1, Math.min(1, direction.y))), 0, 0);
    this.rightForearm.rotation.set(0, 0, 0);
    this.rightHand.rotation.set(0, 0, 0);
    this.group.updateWorldMatrix(true, true);
  }

  startCombatMove(move: CombatMove): void {
    this.animationController.startCombatMove(move);
  }

  animate(
    dt: number,
    speed: number,
    flying: boolean,
    boost: boolean,
    pose: string,
    verticalSpeed = 0,
    turn = 0,
    size = 1,
    velocity?: Vector3,
    combatFactor = 1,
    speedMode = 'ground',
    forward?: Vector3,
    facingYaw = 0
  ): void {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    this.currentCharacterSize = size;

    const vel = velocity ?? this.defaultVelocity.set(0, verticalSpeed, -speed);

    // Update the animation controller which evaluates layered poses and bone masks
    this.animationController.update(this.skeleton.bones, dt, {
      speed,
      verticalSpeed,
      velocity: vel,
      flying,
      grounded: !flying && (pose !== 'jump' && pose !== 'vault'),
      boosting: boost,
      size,
      turn,
      powerPoseName: pose,
      combatTimeFactor: combatFactor,
      speedMode,
      forward,
      facingYaw,
    });

    // Apply decoupled visual orientation (flight alignment, 360 double jump flip)
    this.group.quaternion.copy(this.animationController.rootOrientation);

    // Apply procedural vertical displacement
    this.body.position.copy(this.animationController.bodyOffset);

    // Energy power aim override
    if (pose === 'energy') {
      this.rightArm.rotation.x = Math.PI / 2;
      this.rightHand.rotation.x = -0.12;
    } else if (['shockwave', 'reconstruct', 'teleport'].includes(pose)) {
      this.leftArm.rotation.x = 1.25;
      this.rightArm.rotation.x = 1.25;
    }

    // Cosmic shaders, particle aura and trail updates
    const level: CosmicLevel = pose ? 'power' : this.level ?? (boost ? 'boost' : flying ? 'flight' : 'idle');
    const pace = this.level ? this.levelSpeed : speed;

    this.cosmicSource?.update(dt);
    this.cosmicSource?.setPlaybackRate(flying ? 1.1 : 1);
    this.cosmicMaterial?.update(dt, level, pace);

    const glow = 1 + (level === 'mega' ? 0.65 : level === 'power' ? 0.3 : 0);
    this.accentMaterial.color.setRGB(glow, glow, glow);

    this.aura?.update(dt, this.enabled ? level : 'idle', this.enabled ? pace : 0, this.facing, size);
    this.trail?.update(dt, this.enabled ? level : 'idle', this.enabled ? pace : 0, this.facing);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.aura?.dispose();
    this.trail?.dispose();
    this.cosmicMaterial?.dispose();
    this.cosmicSource?.dispose();
    this.surface.geometry.dispose();
    this.accents.geometry.dispose();
    this.skeleton.dispose();
    this.accentMaterial.dispose();
    this.echoMaterial?.dispose();
    this.group.removeFromParent();
  }
}
