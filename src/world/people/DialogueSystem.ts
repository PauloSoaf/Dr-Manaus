import { Vector3 } from 'three/webgpu';
import { LANDMARKS } from '../geodata/geodata';
import { Priority } from '../../player/animations/graph/AnimationGraph';
import type { PlayerController } from '../../player/PlayerController';
import type { PedestrianPresenter } from './PedestrianPresenter';
import type { Archetype } from './Appearance';

/**
 * Talking to people on the street. Walk up to a pedestrian, press Y: they stop, turn to face the
 * hero and talk with the authored conversation clip; the hero answers with the same body language;
 * choices are picked with 1–5. Replies depend on who they are (archetype), the time, the weather,
 * the district, what they remember of the hero and how scared they are. All local and
 * deterministic — no paid API.
 */
export interface DialogueHooks {
  notify?(text: string): void;
  district?(): string;
  timeOfDay?(): string;
  weather?(): string;
  mission?(): string | null;
  sound?(name: string): void;
  setInputEnabled?(enabled: boolean): void;
}

interface Memory { talks: number; mood: number; intimidated: boolean }
interface Choice { label: string; reply: () => string; mood?: number; end?: boolean; intimidate?: boolean }

const pick = <T>(list: readonly T[], seed: number): T => list[Math.abs(seed) % list.length];

const FACTS = [
  'O Teatro Amazonas foi inaugurado em 1896, no auge do ciclo da borracha. A cúpula tem 36 mil escamas de cerâmica.',
  'No Encontro das Águas, o Rio Negro e o Solimões correm lado a lado por quilômetros sem se misturar.',
  'O Mercado Adolpho Lisboa tem estrutura de ferro inspirada no Les Halles de Paris.',
  'A Ponta Negra é onde todo mundo vê o pôr do sol. Domingo à tarde enche.',
  'A ponte Rio Negro liga Manaus a Iranduba. São mais de três quilômetros e meio.',
  'Aqui chove quase todo dia no inverno amazônico. O calor não perdoa, mas a chuva lava a cidade.',
];
const STRANGE: Record<string, readonly string[]> = {
  calm: [
    'Dizem que um homem anda voando por cima do Centro. Achei que era drone…',
    'Ontem o céu ficou verde por uns segundos. Minha vó jurou que era sinal.',
    'Teve um tremor perto do porto. Ninguém sabe explicar.',
  ],
  scared: [
    'Tu viu aquele buraco na avenida? Parecia que caiu um meteoro!',
    'Eu vi prédio sumindo e voltando. Não tô doido não, eu vi!',
    'Melhor ficar em casa hoje. Tão falando de uma criatura enorme lá no céu.',
  ],
};
const GREET: Record<Archetype, readonly string[]> = {
  trabalhador: ['Opa, chefe! Rapidinho que tô no batente.', 'E aí, parceiro. Tudo na paz?'],
  turista: ['Oi! Você é daqui? Que cidade incrível!', 'Hello… quer dizer, olá! Tô tirando foto de tudo.'],
  executivo: ['Boa tarde. Pois não?', 'Pode falar, mas tenho reunião daqui a pouco.'],
  estudante: ['Eita, oi! Você não é aquele cara do vídeo?', 'Fala aí! Tô indo pra aula.'],
  idoso: ['Bom dia, meu filho. Em que posso ajudar?', 'Ah, os jovens de hoje… diga, diga.'],
  comerciante: ['Opa! Vai levar alguma coisa? Tem tucumã fresquinho!', 'Chega mais, freguês!'],
  passageiro: ['Oi. Tô esperando o ônibus faz meia hora…', 'Fala. Esse busão não chega nunca.'],
  guarda: ['Guarda Municipal. Tudo em ordem por aqui?', 'Boa. Precisa de alguma orientação?'],
  esportista: ['Ufa… oi! Tô no meu treino.', 'E aí! Correndo pra manter o pique.'],
  motorista: ['Fala, amigo. Cuidado com o trânsito aí.', 'Opa. Tô procurando onde estacionar.'],
};
const VEHICLE_TALK = [
  'Carro aqui é tudo no calor: ar-condicionado é item de sobrevivência.',
  'Se for dirigir no Centro, paciência. A Getúlio Vargas trava fácil.',
  'Meu cunhado tem uma picape que atravessa até a BR-319 na seca.',
];
const HELP = [
  'Se precisar de ajuda, procure a Guarda Municipal perto da praça.',
  'Tem uma farmácia ali na esquina. E água — bebe água que o sol tá rachando.',
  'Precisa de carona? Táxi é fácil de achar perto do Teatro.',
];

function compass(dx: number, dz: number): string {
  // World -Z is north in the local Manaus frame used by the map.
  const angle = Math.atan2(dx, -dz);
  const names = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
  return names[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}

export class DialogueSystem {
  private readonly memory = new Map<string, Memory>();
  private active: { id: string; name: string; label: string; archetype: Archetype; seed: number } | null = null;
  private panel?: HTMLDivElement;
  private choices: Choice[] = [];
  private speakTimer = 0;
  private readonly onKey = (event: KeyboardEvent) => {
    if (!this.active) return;
    const n = Number(event.key);
    if (event.key === 'Escape') { event.preventDefault(); this.end(); return; }
    if (n >= 1 && n <= this.choices.length) { event.preventDefault(); this.choose(n - 1); }
  };
  /** How much the city has seen of the hero (raised by destruction elsewhere, read here). */
  fame = 0;

  constructor(private readonly player: PlayerController, private readonly hooks: DialogueHooks = {}) {
    if (typeof window !== 'undefined') window.addEventListener('keydown', this.onKey);
  }

  get talking(): boolean { return this.active !== null; }

  prompt(presenter: PedestrianPresenter | null): string | null {
    if (this.active || !presenter || this.player.isScripted) return null;
    const near = presenter.nearest(this.player.position, 2.6);
    return near ? `[Y] Conversar com ${near.body.appearance.name} (${near.body.appearance.label})` : null;
  }

  tryStart(presenter: PedestrianPresenter | null): boolean {
    if (this.active || !presenter || this.player.isScripted || this.player.isFlying) return false;
    const near = presenter.nearest(this.player.position, 2.6);
    if (!near) return false;
    const ap = near.body.appearance;
    this.active = { id: near.npc.id, name: ap.name, label: ap.label, archetype: ap.archetype, seed: ap.seed };
    this.presenterRef = presenter;
    this.populationHold(true);
    // Face each other.
    const toPlayer = this.player.position.clone().sub(near.body.group.position);
    near.body.group.rotation.y = Math.atan2(-toPlayer.x, -toPlayer.z);
    near.body.walk(0);
    this.player.beginScripted();
    this.player.setScriptedPose(this.player.position, Math.atan2(toPlayer.x, toPlayer.z), 0);
    const memory = this.memoryOf(this.active.id);
    const scared = memory.mood < -1 || memory.intimidated;
    near.body.play(scared ? 'Hit_React_A' : 'Wave', { priority: Priority.Gesture, part: 'upper', fadeIn: 0.15, fadeOut: 0.3 });
    this.hooks.sound?.('ui-click');
    this.hooks.setInputEnabled?.(false);
    this.openPanel();
    this.say(this.greeting(memory));
    return true;
  }

  private presenterRef: PedestrianPresenter | null = null;
  private populationHold(on: boolean): void {
    const p = this.active && this.presenterRef?.bodies.get(this.active.id);
    const population = p ? (p as unknown as { npc: { id: string } }).npc : null;
    if (!population || !this.active) return;
    // The hold set lives on PopulationManager; the presenter's entry knows its pedestrian.
    const manager = (this.presenterRef as unknown as { lastPopulation?: { held: Set<string> } }).lastPopulation;
    if (manager) { if (on) manager.held.add(this.active.id); else manager.held.delete(this.active.id); }
  }

  private memoryOf(id: string): Memory {
    let m = this.memory.get(id);
    if (!m) { m = { talks: 0, mood: 0, intimidated: false }; this.memory.set(id, m); }
    return m;
  }

  private greeting(memory: Memory): string {
    const a = this.active!;
    memory.talks++;
    if (memory.intimidated) return 'D-de novo você? Por favor, eu não quero problema…';
    if (memory.talks > 1) return pick(['Você de novo! Esqueceu alguma coisa?', 'Opa, a gente já se falou, né? Diga.', 'Voltou! Sabia que ia voltar.'], a.seed + memory.talks);
    if (this.fame > 3) return pick(['M-meu Deus… você é o Dr. Manaus?! Posso tirar uma foto?', 'É ele! O cara que voa! Calma, calma… oi!'], a.seed);
    const time = this.hooks.timeOfDay?.() ?? 'Day';
    const salute = time === 'Night' ? 'Boa noite' : time === 'Dusk' ? 'Boa tarde' : 'Bom dia';
    return `${salute}. ${pick(GREET[a.archetype], a.seed)}`;
  }

  private nearestLandmark(): string {
    let best: (typeof LANDMARKS)[number] | null = null, bestD = Infinity;
    const p = this.player.position;
    for (const l of LANDMARKS) { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < bestD) { bestD = d; best = l; } }
    if (!best) return 'Daqui eu não sei te dizer não…';
    const name = (best as { shortName?: string; name?: string }).shortName ?? (best as { name?: string }).name ?? 'o ponto turístico';
    if (bestD < 150) return `Você já tá praticamente no ${name}! É logo ali.`;
    return `O ${name} fica a uns ${bestD > 1000 ? `${(bestD / 1000).toFixed(1)} km` : `${Math.round(bestD / 10) * 10} m`} daqui, sentido ${compass(best.x - p.x, best.z - p.z)}.`;
  }

  private buildChoices(): Choice[] {
    const a = this.active!;
    const memory = this.memoryOf(a.id);
    const scared = memory.mood < -1 || memory.intimidated;
    const weather = this.hooks.weather?.() ?? '';
    const district = this.hooks.district?.() ?? 'Manaus';
    const list: Choice[] = [
      { label: 'Perguntar sobre Manaus', mood: 1, reply: () => (a.archetype === 'turista' ? `Cheguei ontem! Me disseram que: ${pick(FACTS, a.seed + memory.talks)}` : pick(FACTS, a.seed + memory.talks * 7)) },
      { label: 'Perguntar sobre acontecimentos estranhos', reply: () => pick(scared || this.fame > 2 ? STRANGE.scared : STRANGE.calm, a.seed + memory.talks) },
      { label: 'Pedir informação (ponto turístico)', mood: 1, reply: () => this.nearestLandmark() },
      { label: `Perguntar sobre ${district}`, reply: () => (/chuv|rain|storm/i.test(weather) ? `Com essa chuva o ${district} fica alagado rapidinho. Cuidado aí.` : `O ${district}? ${pick(['É movimentado, mas é gente boa.', 'De noite é mais tranquilo.', 'Tem comida boa por aqui, procura um tacacá.'], a.seed)}`) },
    ];
    const mission = this.hooks.mission?.();
    if (mission) list.push({ label: 'Perguntar sobre a missão', reply: () => `"${mission}"? ${a.archetype === 'guarda' ? 'Fique de olho, cidadão. A área está sob observação.' : 'Ouvi falar… dizem que tem a ver com o rio. Vai com cuidado.'}` });
    list.push({ label: a.archetype === 'guarda' ? 'Pedir ajuda à Guarda' : 'Pedir ajuda', mood: 1, reply: () => (a.archetype === 'guarda' ? 'Qualquer emergência, liga 153. Estamos de patrulha por aqui.' : pick(HELP, a.seed)) });
    if (Math.abs(a.seed) % 3 === 0) list.push({ label: 'Falar de carros', reply: () => pick(VEHICLE_TALK, a.seed) });
    list.push({ label: 'Intimidar', mood: -3, intimidate: true, reply: () => (a.archetype === 'guarda' ? 'Opa, opa. Calma lá. Isso aqui é desacato, viu?' : pick(['T-tá bom, tá bom! Eu já tô indo!', 'Ei, calma! Eu não fiz nada!', 'Socorro! Alguém chama a guarda!'], a.seed)) });
    list.push({ label: 'Tchau', end: true, reply: () => pick(['Até mais! Vai com Deus.', 'Falou! Se cuida.', 'Tchau, tchau!'], a.seed + memory.talks) });
    // Keep the panel short: always the first three topics, the intimidation and the goodbye.
    const head = list.filter(c => !c.end && !c.intimidate).slice(0, 4);
    return [...head, list.find(c => c.intimidate)!, list.find(c => c.end)!];
  }

  private choose(index: number): void {
    const choice = this.choices[index];
    if (!choice || !this.active) return;
    const memory = this.memoryOf(this.active.id);
    memory.mood += choice.mood ?? 0;
    if (choice.intimidate) memory.intimidated = true;
    // The hero speaks first (authored talking clip on the base), then the pedestrian answers.
    this.player.character.setBaseOverride('Talk_Loop');
    this.speakTimer = 1.1;
    const reply = choice.reply();
    this.say(reply, choice.label);
    const body = this.presenterRef?.bodies.get(this.active.id)?.body;
    if (body) {
      if (choice.intimidate) body.play(this.active.archetype === 'guarda' ? 'Shake_No' : 'Hit_React_B', { priority: Priority.Gesture, part: 'upper', fadeIn: 0.1, fadeOut: 0.3 });
      else if ((choice.mood ?? 0) > 0) body.play('Nod_Yes', { priority: Priority.Gesture, part: 'upper', from: 0.1, to: 0.7, fadeIn: 0.2, fadeOut: 0.3 });
    }
    if (choice.end || (choice.intimidate && this.active.archetype !== 'guarda')) {
      window.setTimeout(() => this.end(), choice.end ? 1600 : 1100);
    }
  }

  private openPanel(): void {
    if (typeof document === 'undefined') return;
    this.panel ??= Object.assign(document.createElement('div'), { className: 'dialogue-panel' });
    Object.assign(this.panel.style, {
      position: 'fixed', left: '50%', bottom: '7%', transform: 'translateX(-50%)', width: 'min(640px, calc(100vw - 32px))',
      background: 'rgba(10, 18, 22, 0.88)', color: '#eaf6f2', border: '1px solid rgba(140, 255, 220, 0.35)', borderRadius: '10px',
      padding: '14px 18px', font: '15px/1.45 system-ui, sans-serif', zIndex: '60', boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
    });
    if (!this.panel.isConnected) document.body.append(this.panel);
  }

  private say(line: string, asked?: string): void {
    if (!this.active || !this.panel) { this.hooks.notify?.(`${this.active?.name}: ${line}`); return; }
    this.choices = this.buildChoices();
    const escape = (t: string) => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    this.panel.innerHTML = `<div style="opacity:.7;font-size:12px;letter-spacing:.06em;text-transform:uppercase">${escape(this.active.name)} · ${escape(this.active.label)}</div>`
      + (asked ? `<div style="margin:6px 0 2px;color:#9fe;opacity:.85">Você: ${escape(asked)}</div>` : '')
      + `<div style="margin:6px 0 10px;font-size:16px">“${escape(line)}”</div>`
      + this.choices.map((c, i) => `<div data-choice="${i}" style="cursor:pointer;padding:3px 0"><b style="color:#8fffdc">${i + 1}</b> ${escape(c.label)}</div>`).join('')
      + `<div style="margin-top:8px;opacity:.55;font-size:12px">1–${this.choices.length} escolher · Esc encerrar</div>`;
    this.panel.querySelectorAll<HTMLDivElement>('[data-choice]').forEach(el => { el.onclick = () => this.choose(Number(el.dataset.choice)); });
  }

  end(): void {
    if (!this.active) return;
    const body = this.presenterRef?.bodies.get(this.active.id)?.body;
    body?.play('Wave', { priority: Priority.Gesture, part: 'upper', from: 0.2, to: 0.8, fadeIn: 0.15, fadeOut: 0.3 });
    this.populationHold(false);
    this.player.character.setBaseOverride(null);
    this.player.endScripted();
    this.panel?.remove();
    this.hooks.setInputEnabled?.(true);
    this.active = null;
  }

  /** Per frame: the talking pedestrian keeps facing the hero and gestures while speaking. */
  update(dt: number, presenter: PedestrianPresenter | null): void {
    if (!this.active) return;
    const p = presenter?.bodies.get(this.active.id);
    if (!p) { this.end(); return; }
    const toPlayer = new Vector3().subVectors(this.player.position, p.body.group.position);
    p.body.group.rotation.y = Math.atan2(-toPlayer.x, -toPlayer.z);
    if (this.speakTimer > 0) {
      this.speakTimer -= dt;
      if (this.speakTimer <= 0) { this.player.character.setBaseOverride(null); p.body.pose('Talk_Loop', 1, 0.25); }
    }
    if (toPlayer.length() > 4.5) this.end();
  }

  dispose(): void { if (typeof window !== 'undefined') window.removeEventListener('keydown', this.onKey); this.panel?.remove(); }
}
