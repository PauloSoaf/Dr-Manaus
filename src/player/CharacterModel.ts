import { Group, MeshBasicMaterial, Object3D, Quaternion, SkinnedMesh, Vector3, type Bone, type PerspectiveCamera } from 'three/webgpu';
import { CosmicAura } from './cosmic/CosmicAura';
import { CosmicTrail } from './cosmic/CosmicTrail';
import { CosmicMaterial, type CosmicLevel } from './cosmic/CosmicMaterial';
import { SpeedArcs } from './vfx/SpeedArcs';
import { CosmicVideoSource } from './cosmic/CosmicVideoSource';
import { AnimationController } from './animations/AnimationController';
import type { CombatMove } from './animations/types';
import { findCharacterBone, loadCharacterAsset, type CharacterAsset } from './animations/CharacterAsset';
import { CharacterAnimator } from './animations/CharacterAnimator';
import { measureSkinnedGround, type GroundAlignmentResult } from './animations/GroundAlignment';

export type { CosmicLevel };
const TARGET_HEIGHT = 2.07;
const up = new Vector3(0, 1, 0);

/**
 * Where the body turns around, as a fraction of its own height above the soles. Roughly the
 * hips: the centre of mass an athlete somersaults about. Rotating at the feet instead — which is
 * what happens if the rotation node sits at the visual root's origin — swings the whole figure
 * around a point a metre below itself, and reads as orbiting rather than flipping.
 */
export const BODY_PIVOT_FRACTION = 0.55;

/** What the player controller hands the character each frame beyond raw locomotion. */
export interface MotionIntent {
  /** Speed the player is asking for, so flight can start righting the body while it decelerates. */
  desiredSpeed?: number;
  grounded?: boolean;
  dodge?: 'roll' | 'airDash' | null;
}

export class CharacterModel {
  readonly group = new Group();
  readonly visualRoot = new Group();
  readonly flightRoot = new Group();
  readonly pivotRoot = new Group();
  readonly cosmicSource?: CosmicVideoSource;
  readonly cosmicMaterial?: CosmicMaterial;
  readonly animationController = new AnimationController();
  private readonly echoMaterial?: MeshBasicMaterial;
  private readonly aura?: CosmicAura;
  private readonly trail?: CosmicTrail;
  private readonly arcs?: SpeedArcs;
  private readonly fallbackNode = new Object3D();
  private readonly yaw = new Quaternion();
  private asset?: CharacterAsset;
  private animator?: CharacterAnimator;
  private groundAlignment: GroundAlignmentResult = { offset: 0, minY: 0, maxY: 0, sampledVertices: 0 };
  private facing = new Vector3(0, 0, -1);
  private level: CosmicLevel | null = null;
  private levelSpeed = 0;
  private enabled = true;
  private disposed = false;
  private readonly defaultVelocity = new Vector3();

  constructor(echo = false) {
    this.group.name = echo ? 'cosmic-echo' : 'DR Manaus · native Quaternius player';
    this.visualRoot.name = 'character scale and ground alignment';
    this.flightRoot.name = 'flight orientation and double-jump root';
    this.pivotRoot.name = 'body pivot offset';
    this.group.add(this.visualRoot);
    this.visualRoot.add(this.flightRoot);
    this.flightRoot.add(this.pivotRoot);
    if (!echo) {
      this.cosmicSource = new CosmicVideoSource();
      this.cosmicMaterial = new CosmicMaterial({ source: this.cosmicSource });
      this.aura = new CosmicAura(this.group);
      this.trail = new CosmicTrail(this.group);
      this.arcs = new SpeedArcs(this.group);
    } else {
      this.echoMaterial = new MeshBasicMaterial({ color: '#3f9b96', transparent: true, opacity: 0.66, toneMapped: false });
    }
  }

  private bone(name: string): Bone | Object3D { return this.asset ? findCharacterBone(this.asset, name) : this.fallbackNode; }
  get hips(): Bone | Object3D { return this.bone('pelvis'); }
  get spine(): Bone | Object3D { return this.bone('spine_01'); }
  get chest(): Bone | Object3D { return this.bone('spine_03'); }
  get neck(): Bone | Object3D { return this.bone('neck_01'); }
  get head(): Bone | Object3D { return this.bone('Head'); }
  get leftShoulder(): Bone | Object3D { return this.bone('clavicle_l'); }
  get rightShoulder(): Bone | Object3D { return this.bone('clavicle_r'); }
  get leftArm(): Bone | Object3D { return this.bone('upperarm_l'); }
  get rightArm(): Bone | Object3D { return this.bone('upperarm_r'); }
  get leftForearm(): Bone | Object3D { return this.bone('lowerarm_l'); }
  get rightForearm(): Bone | Object3D { return this.bone('lowerarm_r'); }
  get leftHand(): Bone | Object3D { return this.bone('hand_l'); }
  get rightHand(): Bone | Object3D { return this.bone('hand_r'); }
  get leftLeg(): Bone | Object3D { return this.bone('thigh_l'); }
  get rightLeg(): Bone | Object3D { return this.bone('thigh_r'); }
  get leftShin(): Bone | Object3D { return this.bone('calf_l'); }
  get rightShin(): Bone | Object3D { return this.bone('calf_r'); }
  get leftFoot(): Bone | Object3D { return this.bone('foot_l'); }
  get rightFoot(): Bone | Object3D { return this.bone('foot_r'); }
  get surface(): SkinnedMesh | undefined { return this.asset?.skinnedMeshes[0]; }
  get skinnedMeshes(): readonly SkinnedMesh[] { return this.asset?.skinnedMeshes ?? []; }
  get groundDiagnostics(): GroundAlignmentResult { return this.groundAlignment; }
  get speedArcs(): SpeedArcs | undefined { return this.arcs; }
  get clipNames(): readonly string[] { return this.asset?.animations.map(clip => clip.name) ?? []; }

  async initializeAnimations(): Promise<void> {
    if (this.asset || this.disposed) return;
    const asset = await loadCharacterAsset();
    if (this.disposed) return;
    this.asset = asset;
    for (const mesh of asset.skinnedMeshes) {
      mesh.material = this.cosmicMaterial?.material ?? this.echoMaterial!;
      mesh.castShadow = !this.echoMaterial;
      mesh.frustumCulled = false;
    }
    asset.scene.rotation.y = Math.PI;
    this.pivotRoot.add(asset.scene);
    asset.skinnedMeshes[0].skeleton.pose();
    this.group.updateMatrixWorld(true);
    const sourceBounds = measureSkinnedGround(asset.scene, asset.skinnedMeshes);
    const sourceHeight = sourceBounds.maxY - sourceBounds.minY;
    if (!(sourceHeight > 0)) throw new Error('Player character has invalid rest-pose height');
    this.visualRoot.scale.setScalar(TARGET_HEIGHT / sourceHeight);
    this.group.updateMatrixWorld(true);
    const scaled = measureSkinnedGround(this.group, asset.skinnedMeshes);
    this.groundAlignment = { ...scaled, offset: -scaled.minY };
    this.visualRoot.position.y = this.groundAlignment.offset;
    this.setBodyPivot(scaled.minY, scaled.maxY);
    this.group.updateMatrixWorld(true);
    this.animator = new CharacterAnimator(asset.scene, asset.animations);
  }

  /**
   * Moves the rotation node up to the body's centre of mass and pushes the mesh back down by the
   * same amount, so the composition is identity at rest and every rotation of `flightRoot` — the
   * somersault and the flight alignment alike — turns the figure about its own middle.
   *
   * `minY` and `maxY` are in group units; the pivot nodes live one level down, inside the visual
   * root's scale, so the offset is divided by it. Split out from the loader so the geometry can
   * be checked without a GLB.
   */
  setBodyPivot(minY: number, maxY: number): void {
    const height = maxY - minY;
    const scale = this.visualRoot.scale.y;
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(scale) || scale <= 0) {
      this.flightRoot.position.y = 0; this.pivotRoot.position.y = 0; return;
    }
    const pivot = (minY + BODY_PIVOT_FRACTION * height) / scale;
    this.flightRoot.position.y = pivot;
    this.pivotRoot.position.y = -pivot;
  }

  /** Height of the rotation centre above the soles, in metres at size 1. */
  get bodyPivot(): number {
    return this.flightRoot.position.y * this.visualRoot.scale.y + this.groundAlignment.offset;
  }

  get cosmicEnabled(): boolean { return this.enabled; }
  set cosmicEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.cosmicMaterial) this.cosmicMaterial.enabled = enabled;
    this.cosmicSource?.setEnabled(enabled);
  }
  updateCosmicView(camera: PerspectiveCamera): void { this.cosmicMaterial?.updateView(camera); }
  get cosmicDiagnostics(): Record<string, unknown> {
    return { ...this.cosmicSource?.diagnostics, ...this.cosmicMaterial?.metrics, bodyDraws: this.skinnedMeshes.length, groundOffset: this.groundAlignment.offset };
  }
  setCosmicLevel(level: CosmicLevel, speed: number, forward?: Vector3): void {
    this.level = level;
    this.levelSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    if (forward && forward.lengthSq() > 1e-6) this.facing.copy(forward);
  }
  /**
   * The body turns to face the shot; the arm itself comes from the authored firing clip. Posing
   * the arm here procedurally was tried and rejected — it deformed the shoulder.
   */
  aimEnergy(_direction: Vector3): void { this.group.updateWorldMatrix(true, true); }
  get poseDiagnostics(): { rest: number } {
    return { rest: this.animationController.restAmount };
  }
  startCombatMove(move: CombatMove): void { this.animationController.startCombatMove(move); }
  previewClip(name: string): void { this.animator?.preview(name); }
  setAnimationPaused(paused: boolean): void { if (this.animator) this.animator.paused = paused; }
  setAnimationSpeed(speed: number): void { if (this.animator) this.animator.speed = speed; }
  seekAnimation(normalized: number): void { this.animator?.seek(normalized); }
  get animationDebug(): { clip: string; time: number; duration: number } | undefined { return this.animator?.debugState; }

  animate(
    dt: number, speed: number, flying: boolean, boost: boolean, pose: string,
    verticalSpeed = 0, turn = 0, size = 1, velocity?: Vector3, combatFactor = 1,
    speedMode = 'ground', forward?: Vector3, facingYaw = 0, intent?: MotionIntent,
  ): void {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    const vel = velocity ?? this.defaultVelocity.set(0, verticalSpeed, -speed);
    const params = {
      speed, verticalSpeed, velocity: vel, flying,
      grounded: intent?.grounded ?? (!flying && pose !== 'jump' && pose !== 'vault'),
      boosting: boost, size, turn, powerPoseName: pose,
      combatTimeFactor: combatFactor, speedMode, forward, facingYaw,
      desiredSpeed: intent?.desiredSpeed, dodge: intent?.dodge ?? null,
    };
    this.animationController.update(this.asset?.skeletonBones ?? [], dt, params);
    this.yaw.setFromAxisAngle(up, facingYaw);
    this.group.quaternion.copy(this.yaw);
    this.flightRoot.quaternion.copy(this.yaw).invert().multiply(this.animationController.rootOrientation);
    this.visualRoot.position.y = this.groundAlignment.offset + this.animationController.bodyOffset.y;
    this.animator?.update(dt, params, this.animationController.activeCombatMove, this.animationController.isDoubleJumping, this.animationController.currentFlipPhase);

    const level: CosmicLevel = pose ? 'power' : this.level ?? (boost ? 'boost' : flying ? 'flight' : 'idle');
    const pace = this.level ? this.levelSpeed : speed;
    this.cosmicSource?.update(dt);
    this.cosmicSource?.setPlaybackRate(flying ? 1.1 : 1);
    this.cosmicMaterial?.update(dt, level, pace);
    this.aura?.update(dt, this.enabled ? level : 'idle', this.enabled ? pace : 0, this.facing, size);
    this.trail?.update(dt, this.enabled ? level : 'idle', this.enabled ? pace : 0, this.facing);
    // Ground-only: the flight trail already carries speed in the air, and stacking both reads
    // as noise rather than as power.
    this.arcs?.update(dt, this.enabled ? Math.hypot(vel.x, vel.z) : 0, size, flying || !params.grounded);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.animator?.dispose();
    this.aura?.dispose();
    this.trail?.dispose();
    this.arcs?.dispose();
    this.cosmicMaterial?.dispose();
    this.cosmicSource?.dispose();
    this.echoMaterial?.dispose();
    this.group.removeFromParent();
  }
}
