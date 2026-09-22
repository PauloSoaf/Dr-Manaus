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
  readonly body = new Bone();
  readonly leftArm = new Bone(); readonly rightArm = new Bone();
  readonly leftLeg = new Bone(); readonly rightLeg = new Bone();
  readonly leftForearm = new Bone(); readonly rightForearm = new Bone();
  readonly leftShin = new Bone(); readonly rightShin = new Bone();
  readonly leftHand = new Bone(); readonly rightHand = new Bone();
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
    this.group.add(this.surface, this.body);

    this.leftArm.position.set(-HUMAN_RIG.shoulderX, HUMAN_RIG.shoulderY, 0);
    this.rightArm.position.set(HUMAN_RIG.shoulderX, HUMAN_RIG.shoulderY, 0);
    this.leftLeg.position.set(-HUMAN_RIG.hipX, HUMAN_RIG.hipY, 0);
    this.rightLeg.position.set(HUMAN_RIG.hipX, HUMAN_RIG.hipY, 0);
    this.body.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);

    for (const [arm, forearm, hand, side] of [
      [this.leftArm, this.leftForearm, this.leftHand, -1],
      [this.rightArm, this.rightForearm, this.rightHand, 1],
    ] as const) {
      forearm.position.set(side * 0.03, HUMAN_RIG.elbowY - HUMAN_RIG.shoulderY, -0.007);
      arm.add(forearm);
      hand.position.set(side * 0.01, HUMAN_RIG.wristY - HUMAN_RIG.elbowY, -0.009);
      forearm.add(hand);
    }
    for (const [leg, shin] of [[this.leftLeg, this.leftShin], [this.rightLeg, this.rightShin]]) {
      shin.position.set(0, HUMAN_RIG.kneeY - HUMAN_RIG.hipY, -0.016);
      leg.add(shin);
    }

    this.group.updateMatrixWorld(true);
    this.skeleton = new Skeleton([
      this.body,
      this.leftArm,
      this.rightArm,
      this.leftLeg,
      this.rightLeg,
      this.leftForearm,
      this.rightForearm,
      this.leftShin,
      this.rightShin,
      this.leftHand,
      this.rightHand,
    ]);
    this.surface.bind(this.skeleton);

    this.accents = new Mesh(geometry.accents, this.accentMaterial);
    this.accents.name = 'cosmic-eyes-and-sigil';
    this.body.add(this.accents);

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
    this.body.rotation.x = 0;
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
    combatFactor = 1
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
    });

    // Apply decoupled visual orientation (e.g. 360 double jump flip)
    if (this.animationController.isDoubleJumping) {
      this.body.quaternion.multiply(this.animationController.visualOrientation);
    }

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
