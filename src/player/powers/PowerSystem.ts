import { AdditiveBlending, SphereGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, TorusGeometry, Vector3 } from 'three/webgpu';
import { DESTRUCTION } from '../../core/config';
import type { Collider, Target } from '../../core/types';
import { PhysicsWorld } from '../../physics/PhysicsWorld';
import { CharacterModel } from '../CharacterModel';
import type { InputController } from '../InputController';
import type { PlayerController } from '../PlayerController';
import { EffectPool } from './EffectPool';

export interface PowerHooks {
  targets: () => readonly Target[];
  hit: (id: string, force: number) => void;
  reconstruct: (position: Vector3, radius: number) => number;
  impulse: (position: Vector3, radius: number, force: number) => void;
  prepare: (destination: Vector3) => Promise<void>;
  notify: (text: string) => void;
  sound: (name: string) => void;
  getOrigin: () => Vector3;
  getColliders: () => readonly Collider[];
  getAttackColliders?: (point:Vector3,radius:number)=>readonly Collider[];
  /**
   * Optional. Structural damage in a blast radius around a world point; returns how many
   * buildings collapsed. Absent, every power behaves exactly as it did before destruction.
   */
  damage?: (point: Vector3, radius: number, amount: number) => number;
}

interface Clone { character: CharacterModel; life: number; attackTimer: number; angle: number }

export class PowerSystem {
  combatMode: 'ranged' | 'melee' = 'ranged';
  private punchIndex = 0;
  private kickIndex = 0;
  private meleePending: { kind: 'punch' | 'kick'; time: number } | null = null;
  laserActive=false;
  private laserTick=0;
  private readonly laser=new Mesh(new CylinderGeometry(1,1,1,8),new MeshBasicMaterial({color:0xdffff8,toneMapped:false}));
  private readonly laserGlow=new Mesh(new CylinderGeometry(1,1,1,10),new MeshBasicMaterial({color:0x25e9ff,transparent:true,opacity:.28,blending:AdditiveBlending,depthWrite:false,toneMapped:false}));
  private readonly laserImpact=new Mesh(new SphereGeometry(1,12,8),new MeshBasicMaterial({color:0xaaffee,transparent:true,opacity:.8,blending:AdditiveBlending,depthWrite:false,toneMapped:false}));
  private readonly laserRing=new Mesh(new TorusGeometry(1,.065,6,32),new MeshBasicMaterial({color:0x48dcff,transparent:true,opacity:.6,blending:AdditiveBlending,depthWrite:false,toneMapped:false}));
  private readonly laserAxis=new Vector3(0,1,0);
  temporal = false;
  selected = 'energy';
  teleporting = false;
  readonly cooldowns: Record<string, number> = { punch: 0, kick: 0, energy: 0, laser:0, teleport: 0, shockwave: 0, reconstruct: 0, giant: 0, clone: 0, temporal: 0 };
  readonly destination = new Vector3();
  private readonly effects: EffectPool;
  private readonly indicator: Mesh;
  private readonly clones: Clone[] = [];
  private readonly rayOrigin = new Vector3();
  private readonly rayDirection = new Vector3();
  private readonly offset = new Vector3();
  private readonly emission = new Vector3();
  private readonly aimPoint = new Vector3();
  private readonly cloneDestination = new Vector3();
  private targetId: string | null = null;
  private time = 0;
  private sizeIndex = 0;
  private aimTimer = 0;
  private temporalTime = 0;
  private destinationValid = false;
  private collapseNotice = -99;

  constructor(private readonly root: Group, private readonly player: PlayerController, private readonly camera: PerspectiveCamera, private readonly input: InputController, private readonly hooks: PowerHooks) {
    this.effects = new EffectPool(root);
    this.laser.visible=false;this.laser.name="continuous-laser";root.add(this.laser);
    this.laserGlow.name='laser-glow';this.laserImpact.name='laser-impact';this.laserRing.name='laser-impact-ring';
    for(const effect of [this.laserGlow,this.laserImpact,this.laserRing]){effect.visible=false;effect.frustumCulled=false;root.add(effect);}
    this.indicator = new Mesh(new TorusGeometry(1.5, 0.06, 6, 48), new MeshBasicMaterial({ color: 0x8cffdc, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    this.indicator.rotation.x = -Math.PI / 2; this.indicator.visible = false; root.add(this.indicator);
    for (let i = 0; i < 3; i++) {
      const character = new CharacterModel(true); character.group.visible = false; root.add(character.group);
      this.clones.push({ character, life: 0, attackTimer: i * 0.25, angle: i * Math.PI * 2 / 3 });
    }
  }

  get cloneCount(): number { return this.clones.reduce((n, clone) => n + Number(clone.life > 0), 0); }

  update(realDt: number, worldDt: number): void {
    this.time += realDt;
    for (const name of Object.keys(this.cooldowns)) this.cooldowns[name] = Math.max(0, this.cooldowns[name] - realDt);
    const keys: [string, string][] = [['KeyL','laser'],['Digit1', 'energy'], ['KeyE', 'teleport'], ['KeyQ', 'shockwave'], ['KeyR', 'reconstruct'], ['KeyG', 'giant'], ['KeyC', 'clone'], ['KeyT', 'temporal']];
    for (const [key, name] of keys) if (this.input.consume(key)) this.use(name);
    if (this.input.consume('KeyX')) {
      this.combatMode = this.combatMode === 'ranged' ? 'melee' : 'ranged';
      this.laserActive = false; this.meleePending = null;
      this.selected = this.combatMode === 'melee' ? 'punch' : 'energy';
      this.hooks.notify(this.combatMode === 'melee' ? 'Combate: clique = soco; botão direito = chute. X para energia.' : 'Energia: clique = tiro; L = laser. X para combate.');
    }
    if (this.meleePending) {
      this.meleePending.time -= realDt;
      if (this.meleePending.time <= 0) { this.meleeHit(this.meleePending.kind); this.meleePending = null; }
    }
    if (this.input.held('Mouse0') && !this.teleporting) this.use(this.combatMode === 'melee' ? 'punch' : 'energy');
    if (this.combatMode === 'melee' && this.input.held('Mouse2')) this.use('kick');
    if (this.temporal) {
      this.temporalTime -= realDt;
      if (this.temporalTime <= 0) { this.temporal = false; this.hooks.notify('O fluxo do tempo foi restaurado.'); }
    }
    this.aimTimer -= realDt;
    if (this.aimTimer <= 0) { this.updateDestination(); this.aimTimer = 0.08; }
    this.indicator.visible = this.selected === 'teleport' && this.destinationValid && !this.teleporting;
    this.indicator.position.copy(this.destination); this.indicator.position.y += 0.14;
    this.indicator.scale.setScalar((1 + Math.sin(this.time * 4) * 0.08) * Math.sqrt(this.player.size));
    this.effects.update(this.temporal ? worldDt + realDt * 0.35 : realDt);
    this.updateClones(realDt);
    this.updateLaser(realDt);
  }

  use(name: string): void {
    if (!(name in this.cooldowns)) return;
    this.selected = name;
    if (this.cooldowns[name] > 0 || this.teleporting) return;
    switch (name) {
      case 'punch': case 'kick':
        if (this.meleePending || this.cooldowns.punch > 0 || this.cooldowns.kick > 0) break;
        this.laserActive = false;
        this.cooldowns[name] = name === 'kick' ? .65 : .52;
        this.player.powerPose(name === 'kick'
          ? ['kick', 'kickSide', 'kickRound'][this.kickIndex++ % 3]
          : ['punch', 'punchCross', 'punchUpper'][this.punchIndex++ % 3], name === 'kick' ? .55 : .42);
        this.camera.getWorldDirection(this.rayDirection);
        this.player.model.rotation.y = Math.atan2(-this.rayDirection.x, -this.rayDirection.z);
        this.meleePending = { kind: name, time: name === 'kick' ? .22 : .13 };
        break;
      case 'laser': this.laserActive=!this.laserActive;this.hooks.notify(this.laserActive?'Laser continuo ativo - L para desligar.':'Laser desligado.');break;
      case 'energy': this.energy(); break;
      case 'teleport': this.updateDestination(); if (this.destinationValid) void this.teleportTo(this.destination.clone()); else this.hooks.notify('Aponte para uma superfície a até 2,5 km.'); break;
      case 'shockwave': this.shockwave(); break;
      case 'reconstruct': this.reconstruct(); break;
      case 'giant': this.giant(); break;
      case 'clone': this.clone(); break;
      case 'temporal': this.toggleTemporal(); break;
    }
  }

  async teleportTo(position: Vector3): Promise<void> {
    if (this.teleporting || !Number.isFinite(position.x + position.y + position.z) || Math.abs(position.x) > 100000 || Math.abs(position.z) > 100000) return;
    this.teleporting = true; this.cooldowns.teleport = 1.2;
    this.player.powerPose('teleport', 0.8);
    this.effects.burst(this.player.position, 0x91ffe1, this.player.size, 48);
    this.effects.wave(this.player.position, 9 * this.player.size);
    this.hooks.sound('teleport');
    document.body.classList.add('teleporting');
    try {
      await this.hooks.prepare(position);
      const safe = PhysicsWorld.safeLanding(position, this.hooks.getColliders(), 0.34 * this.player.size, 2.1 * this.player.size);
      this.player.teleport(safe);
      this.effects.burst(safe, 0x91ffe1, this.player.size, 48); this.effects.wave(safe, 13 * this.player.size);
      this.hooks.notify('Salto espacial concluído.');
    } catch (error) {
      this.hooks.notify('Não foi possível preparar o destino. Tente novamente.');
      console.warn('Teleport destination preparation failed', error);
    } finally {
      document.body.classList.remove('teleporting'); this.teleporting = false;
    }
  }

  private cameraRay(): void {
    this.rayOrigin.copy(this.camera.position).add(this.hooks.getOrigin());
    this.camera.getWorldDirection(this.rayDirection);
  }

  private meleeHit(kind: 'punch' | 'kick'): void {
    const size = this.player.size, reach = (kind === 'kick' ? 3 : 2.2) * size;
    this.camera.getWorldDirection(this.rayDirection);
    this.rayDirection.y = Math.max(-.65, Math.min(.65, this.rayDirection.y)); this.rayDirection.normalize();
    this.emission.copy(this.player.position); this.emission.y += (kind === 'kick' ? .9 : 1.5) * size;
    const colliders = this.hooks.getAttackColliders?.(this.emission, reach) ?? this.hooks.getColliders();
    const hit = PhysicsWorld.raycast(this.emission, this.rayDirection, colliders, reach, .2 * size, true);
    let distance = hit?.distance ?? reach;
    let target: Target | undefined;
    for (const candidate of this.hooks.targets()) {
      if (!candidate.active) continue;
      this.offset.subVectors(candidate.position, this.emission);
      const along = this.offset.dot(this.rayDirection);
      if (along < 0 || along - candidate.radius > distance || along > reach) continue;
      if (this.offset.lengthSq() - along * along > (candidate.radius + .25 * size) ** 2) continue;
      distance = Math.max(0, along - candidate.radius); target = candidate;
    }
    if (!hit && !target) return;
    this.aimPoint.copy(this.emission).addScaledVector(this.rayDirection, distance);
    if (target) this.hooks.hit(target.id, 150 * size);
    this.hooks.damage?.(this.aimPoint, (kind === 'kick' ? 1.2 : .7) * size, 30000 * size);
    this.effects.burst(this.aimPoint, 0xaaffed, Math.min(30, size), 24);
    this.hooks.impulse(this.aimPoint, 2 * size, 24 * size); this.hooks.sound('energy');
  }

  private updateDestination(): void {
    this.cameraRay();
    const hit = PhysicsWorld.raycast(this.rayOrigin, this.rayDirection, this.hooks.getColliders(), 2500, 0, true);
    this.destinationValid = hit !== null;
    if (!hit) return;
    this.destination.copy(hit.point);
    if (hit.collider) this.destination.y = hit.collider.y + hit.collider.height / 2 + 0.08;
    else this.destination.y = hit.point.y + 0.08;
  }

  private acquireTarget(maxDistance = 1200): Target | null {
    this.cameraRay();
    let best: Target | null = null, bestScore = Infinity;
    for (const target of this.hooks.targets()) {
      if (!target.active) continue;
      this.offset.subVectors(target.position, this.rayOrigin);
      const distance = this.offset.dot(this.rayDirection);
      if (distance <= 1 || distance > maxDistance) continue;
      const perpendicularSq = Math.max(0, this.offset.lengthSq() - distance * distance);
      const tolerance = target.radius + 1.5 + distance * 0.045;
      if (perpendicularSq > tolerance * tolerance) continue;
      const score = perpendicularSq / (distance * distance) + distance * 0.000001;
      if (score < bestScore) { bestScore = score; best = target; }
    }
    return best;
  }

  /** Clear the hero before aiming; then trace from the hand so nearby walls still block fire. */
  private aimBeam(reach:number){
    this.cameraRay();const size=this.player.size;
    const colliders=this.hooks.getAttackColliders?.(this.player.position,reach)??this.hooks.getColliders();
    this.player.model.rotation.y=Math.atan2(-this.rayDirection.x,-this.rayDirection.z);
    this.player.model.position.copy(this.player.position);this.player.model.scale.setScalar(size);
    this.player.character.aimEnergy(this.rayDirection);
    this.player.character.rightHand.getWorldPosition(this.emission);this.emission.add(this.hooks.getOrigin());
    this.emission.addScaledVector(this.rayDirection,.25*size);
    this.offset.copy(this.player.position);this.offset.y+=1.5*size;this.offset.sub(this.rayOrigin);
    this.rayOrigin.addScaledVector(this.rayDirection,Math.max(0,this.offset.dot(this.rayDirection)+.8*size));
    const aim=PhysicsWorld.raycast(this.rayOrigin,this.rayDirection,colliders,reach,0,true);
    this.aimPoint.copy(aim?aim.point:this.rayOrigin).addScaledVector(this.rayDirection,aim?0:reach);
    this.offset.subVectors(this.aimPoint,this.emission);
    if(this.offset.dot(this.rayDirection)<=0)this.aimPoint.copy(this.emission).addScaledVector(this.rayDirection,reach);
    this.offset.subVectors(this.aimPoint,this.emission).normalize();
    const hit=PhysicsWorld.raycast(this.emission,this.offset,colliders,reach,0,true);
    this.aimPoint.copy(hit?hit.point:this.emission).addScaledVector(this.offset,hit?0:reach);
    return hit;
  }

  private updateLaser(dt:number):void{
    this.laser.visible=this.laserActive&&this.input.enabled&&!this.teleporting;
    this.laserGlow.visible=this.laser.visible;this.laserImpact.visible=false;this.laserRing.visible=false;
    if(!this.laser.visible)return;
    const hit=this.aimBeam(Math.max(1600,this.player.size*24));
    this.offset.subVectors(this.aimPoint,this.emission);const length=this.offset.length();
    this.laser.position.copy(this.emission).addScaledVector(this.offset,.5);
    this.laser.quaternion.setFromUnitVectors(this.laserAxis,this.offset.normalize());
    const width=.07*this.player.size;this.laser.scale.set(width,length,width);
    const pulse=1+Math.sin(this.time*32)*.12;
    this.laserGlow.position.copy(this.laser.position);this.laserGlow.quaternion.copy(this.laser.quaternion);this.laserGlow.scale.set(width*3*pulse,length,width*3*pulse);
    this.laserImpact.visible=this.laserRing.visible=!!hit;
    if(hit){
      this.laserImpact.position.copy(this.aimPoint);this.laserImpact.scale.setScalar(Math.max(.35,width*3.5)*pulse);
      this.laserRing.position.copy(this.aimPoint);this.laserRing.quaternion.copy(this.laser.quaternion);this.laserRing.rotateX(Math.PI/2);
      this.laserRing.scale.setScalar(Math.max(.8,width*6)*(1+(this.time*3)%1));
      (this.laserRing.material as MeshBasicMaterial).opacity=.7*(1-(this.time*3)%1);
    }
    this.player.powerPose('energy',.15);this.laserTick-=dt;
    if(this.laserTick<=0){this.laserTick=.1;if(hit)this.hooks.damage?.(this.aimPoint,3*Math.pow(this.player.size,.7),220*this.player.size);}
  }

  private energy(): void {
    this.cooldowns.energy = 0.25;
    this.player.powerPose('energy', 0.3);
    const power = this.player.size;
    const target = this.acquireTarget();
    const surface = this.aimBeam(Math.max(1600,this.player.size*24));
    let collapsed = 0;
    // A generous aim cone helps target small airborne anomalies in third person.
    if (target && this.offset.subVectors(target.position,this.emission).dot(this.rayDirection)>this.player.size*.05 && (!surface || target.position.distanceTo(this.emission) < surface.distance + target.radius + 3)) {
      this.aimPoint.copy(target.position); this.hooks.hit(target.id, 38 * power); this.targetId = target.id;
    } else {
      // aimBeam already resolved the hit from the hand.
      // Only a beam that actually lands on a surface can cut into it; a shot at the sky does not.
      if (surface) collapsed = this.hooks.damage?.(this.aimPoint, DESTRUCTION.beamRadius * Math.pow(power,.7), DESTRUCTION.beamDamage * power) ?? 0;
    }
    this.effects.beam(this.emission, this.aimPoint, Math.pow(power,.6) * DESTRUCTION.beamThickness, 0x89ffe1, surface?1:0);
    this.effects.burst(this.aimPoint, 0xb6ffe7, Math.sqrt(power) * (1 + Math.min(3,collapsed) * 0.3), 18 + collapsed * 8);
    this.hooks.sound('energy');
    if (collapsed > 0) this.reportCollapse(collapsed, Math.min(2,0.55 * power));
  }

  /** Held fire can level a block a second; the shake and the notice are rate limited, not the beam. */
  private reportCollapse(count: number, shake: number): void {
    window.dispatchEvent(new CustomEvent('drmanaus-shake', { detail: shake }));
    if (this.time - this.collapseNotice < DESTRUCTION.noticeInterval) return;
    this.collapseNotice = this.time;
    this.hooks.notify(count === 1 ? 'Estrutura demolida.' : `${count} estruturas demolidas.`);
  }

  private shockwave(): void {
    this.cooldowns.shockwave = 2.4;
    const radius = 48 + (this.player.size-1)*3;
    this.player.powerPose('shockwave', 0.8);
    this.effects.wave(this.player.position, radius, 0x79ffcd, 1.15);
    this.effects.wave(this.player.position, radius * 0.75, 0xf4d296, 0.8);
    this.effects.burst(this.player.position, 0x8cffdc, Math.sqrt(this.player.size) * 2.5, 60);
    this.hooks.impulse(this.player.position, radius, 45 * this.player.size);
    for (const target of this.hooks.targets()) {
      if (!target.active) continue;
      const distance = target.position.distanceTo(this.player.position);
      // The outer wave throws props; only its inner core disintegrates them.
      if (distance < radius && (target.kind === 'anomaly' || distance < radius * 0.23)) this.hooks.hit(target.id, 95 * Math.sqrt(this.player.size));
    }
    const levelled = this.hooks.damage?.(this.player.position, radius, DESTRUCTION.shockwaveDamage * this.player.size) ?? 0;
    this.hooks.sound('shockwave');
    window.dispatchEvent(new CustomEvent('drmanaus-shake', { detail: (0.7 + Math.min(1.1, levelled * 0.12)) * Math.sqrt(this.player.size) }));
    this.hooks.notify(levelled > 0 ? `Onda de choque · ${levelled} ${levelled === 1 ? 'estrutura arrasada' : 'estruturas arrasadas'}.` : 'Onda de choque · matéria repelida.');
  }

  private reconstruct(): void {
    this.cooldowns.reconstruct = 2;
    const radius = 100 * Math.sqrt(this.player.size);
    const count = this.hooks.reconstruct(this.player.position, radius);
    this.player.powerPose('reconstruct', 1);
    this.effects.wave(this.player.position, radius, 0xeac780, 1.5);
    this.effects.burst(this.player.position, 0xffd699, this.player.size * 1.5, 44);
    this.hooks.sound('reconstruct');
    this.hooks.notify(count > 0 ? `${count} ${count === 1 ? 'objeto reconstruído' : 'objetos reconstruídos'}.` : 'Reconstrução · nenhuma matéria destruída ao alcance.');
  }

  private giant(): void {
    this.cooldowns.giant = 1.2;
    this.sizeIndex = (this.sizeIndex + 1) % 6;
    const size = [1, 7, 22, 200/2.07, 500/2.07, 1000/2.07][this.sizeIndex];
    this.player.setSize(size);
    this.effects.wave(this.player.position, size * 6, 0xf4d296, 1.3);
    this.hooks.sound('giant');
    this.hooks.notify(['Forma original: 2 m','Gigante: 15 m','Colossal: 46 m','Titã: 200 m','Titã: 500 m','Titã: 1 km'][this.sizeIndex]);
  }

  private clone(): void {
    this.cooldowns.clone = 10;
    for (const clone of this.clones) {
      clone.life = 22; clone.character.group.visible = true;
      clone.character.group.position.copy(this.player.position); clone.character.group.position.y += 1;
      this.effects.burst(clone.character.group.position, 0xf3d08d, this.player.size, 18);
    }
    const target = this.acquireTarget(); this.targetId = target?.id ?? this.targetId;
    this.hooks.sound('clone'); this.hooks.notify('Três ecos cósmicos · aliados por 22 segundos.');
  }

  private updateClones(dt: number): void {
    let target: Target | undefined;
    if (this.targetId) target = this.hooks.targets().find((candidate) => candidate.id === this.targetId && candidate.active);
    for (const clone of this.clones) {
      if (clone.life <= 0) continue;
      clone.life -= dt;
      if (clone.life <= 0) { clone.character.group.visible = false; this.effects.burst(clone.character.group.position, 0xf3d08d, this.player.size, 10); continue; }
      const angle = clone.angle + this.time * 0.35, radius = this.player.size * 4 + 2;
      this.cloneDestination.set(Math.cos(angle) * radius, this.player.size * (2 + Math.sin(this.time + clone.angle) * 0.25), Math.sin(angle) * radius).add(this.player.position);
      clone.character.group.position.lerp(this.cloneDestination, 1 - Math.exp(-dt * 6));
      clone.character.group.scale.setScalar(this.player.size * Math.min(1, clone.life));
      clone.character.group.rotation.y = this.player.model.rotation.y;
      clone.attackTimer -= dt;
      const attacking = !!target && target.position.distanceToSquared(clone.character.group.position) < 1500 * 1500;
      clone.character.animate(dt, this.player.velocity.length(), true, false, attacking ? 'energy' : '');
      if (attacking && target && clone.attackTimer <= 0) {
        clone.attackTimer = 1.2;
        this.emission.copy(clone.character.group.position); this.emission.y += 1.4 * this.player.size;
        this.effects.beam(this.emission, target.position, Math.sqrt(this.player.size) * 0.65, 0xf3d08d);
        this.hooks.hit(target.id, 22 * Math.sqrt(this.player.size));
      }
    }
  }

  private toggleTemporal(): void {
    this.cooldowns.temporal = 0.4;
    this.temporal = !this.temporal; this.temporalTime = 18;
    this.effects.wave(this.player.position, 90, 0xc9a3ff, 1.3);
    this.hooks.sound('temporal');
    this.hooks.notify(this.temporal ? 'Percepção temporal · o mundo desacelera por 18 segundos.' : 'O fluxo do tempo foi restaurado.');
  }

  dispose(): void {
    for(const effect of [this.laserGlow,this.laserImpact,this.laserRing]){effect.geometry.dispose();(effect.material as MeshBasicMaterial).dispose();effect.removeFromParent();}
    this.laser.geometry.dispose();(this.laser.material as MeshBasicMaterial).dispose();this.laser.removeFromParent();
    this.effects.dispose(); this.indicator.removeFromParent(); this.indicator.geometry.dispose(); (this.indicator.material as MeshBasicMaterial).dispose();
    for (const clone of this.clones) clone.character.dispose();
  }
}
