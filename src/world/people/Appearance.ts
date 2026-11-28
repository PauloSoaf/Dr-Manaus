import { Color } from 'three/webgpu';
import type { Outfit } from './NpcMaterial';

/**
 * Who a pedestrian is: archetype, body, clothes, hair, height, accessories and gait — all derived
 * deterministically from a seed, so the same street corner hands out the same people.
 */
export type Archetype =
  | 'trabalhador' | 'turista' | 'executivo' | 'estudante' | 'idoso' | 'comerciante'
  | 'passageiro' | 'guarda' | 'esportista' | 'motorista';

export type HairStyle = 'long' | 'buns' | 'buzzed' | 'buzzed_female' | 'simple_parted' | 'beard' | 'none';

export interface Appearance {
  readonly seed: number;
  readonly archetype: Archetype;
  readonly body: 'male' | 'female';
  readonly outfit: Outfit;
  readonly hair: HairStyle;
  readonly beard: boolean;
  /** Uniform scale of the 1.81/1.77 m body. */
  readonly scale: number;
  readonly backpack: boolean;
  readonly cap: boolean;
  readonly capColor: Color;
  /** Walking speed in m/s at this person's scale (stride-matched by the animation graph). */
  readonly walkSpeed: number;
  readonly walkClip: 'Walk_Loop' | 'Walk_Formal_Loop' | 'Walk_Carry_Loop';
  /** pt-BR name for dialogue. */
  readonly name: string;
  readonly label: string;
}

const SKIN = ['#f1d3b8', '#e3b796', '#cf9a72', '#b07a55', '#90603f', '#734a2e', '#55341f'];
const HAIR_DARK = ['#15100c', '#2b1c13', '#3f2a1b', '#5c3d26'];
const HAIR_LIGHT = ['#7a5434', '#a8834f', '#c8a46a'];
const HAIR_OLD = ['#8f8c87', '#b9b6b0', '#dcdad4'];
const NAMES_M = ['João', 'Raimundo', 'Francisco', 'Antônio', 'Carlos', 'Paulo', 'José', 'Marcos', 'Rafael', 'Lucas', 'Pedro', 'Thiago', 'Bruno', 'Eduardo', 'Mateus', 'Igor', 'Davi', 'Caio', 'Sebastião', 'Manoel'];
const NAMES_F = ['Maria', 'Ana', 'Francisca', 'Raimunda', 'Juliana', 'Patrícia', 'Fernanda', 'Camila', 'Luana', 'Beatriz', 'Larissa', 'Jéssica', 'Aline', 'Bruna', 'Tainá', 'Iracema', 'Graça', 'Socorro', 'Valéria', 'Débora'];
const LABEL: Record<Archetype, string> = {
  trabalhador: 'Trabalhador', turista: 'Turista', executivo: 'Executivo', estudante: 'Estudante', idoso: 'Morador idoso',
  comerciante: 'Comerciante', passageiro: 'Passageiro', guarda: 'Guarda municipal', esportista: 'Esportista', motorista: 'Motorista',
};

/** Small deterministic PRNG (mulberry32). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];
const c = (hex: string) => new Color(hex);
const vary = (r: () => number, hex: string, amount = 0.06) => {
  const col = c(hex); const hsl = { h: 0, s: 0, l: 0 }; col.getHSL(hsl);
  return col.setHSL((hsl.h + (r() - 0.5) * amount + 1) % 1, Math.min(1, Math.max(0, hsl.s + (r() - 0.5) * amount)), Math.min(1, Math.max(0, hsl.l + (r() - 0.5) * amount)));
};

/** Archetype mix for a city street during the day. */
const WEIGHTS: readonly [Archetype, number][] = [
  ['trabalhador', 18], ['turista', 9], ['executivo', 9], ['estudante', 13], ['idoso', 10], ['comerciante', 7],
  ['passageiro', 14], ['guarda', 3], ['esportista', 6], ['motorista', 11],
];

export function archetypeFor(r: () => number): Archetype {
  const total = WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [a, w] of WEIGHTS) { x -= w; if (x <= 0) return a; }
  return 'trabalhador';
}

export function createAppearance(seed: number, forced?: Archetype): Appearance {
  const r = prng(seed * 2654435761 + 97);
  const archetype = forced ?? archetypeFor(r);
  const body: 'male' | 'female' = archetype === 'guarda' ? (r() < 0.3 ? 'female' : 'male') : r() < 0.5 ? 'female' : 'male';
  const elder = archetype === 'idoso';
  const skin = vary(r, pick(r, SKIN), 0.03);
  const hairColor = c(elder ? pick(r, HAIR_OLD) : r() < 0.82 ? pick(r, HAIR_DARK) : pick(r, HAIR_LIGHT));
  let shirt = '#4f7ca8', pants = '#2f3a4c', shoes = '#1c1c1e', sleeves = 0, trousers = 1;
  let backpack = false, cap = false, capColor = '#20252c';
  let walkClip: Appearance['walkClip'] = 'Walk_Loop';
  switch (archetype) {
    case 'trabalhador': shirt = pick(r, ['#e0782f', '#2d6db5', '#3b8f5a', '#7a8a99', '#c9a227']); pants = pick(r, ['#2b3a55', '#3a3a3a', '#55492f']); shoes = '#3b2a1c'; sleeves = r() < 0.6 ? 1 : 0; cap = r() < 0.35; capColor = shirt; break;
    case 'turista': shirt = pick(r, ['#ffffff', '#f4d35e', '#7fd1d9', '#f28c8c', '#a7d672', '#ff9f43']); pants = pick(r, ['#c2b280', '#6b8fb3', '#3c5a7a']); trousers = r() < 0.7 ? 0 : 1; shoes = pick(r, ['#f2f2f2', '#2a2a2a']); backpack = r() < 0.6; cap = r() < 0.45; capColor = pick(r, ['#ffffff', '#1d3557', '#e63946']); break;
    case 'executivo': shirt = pick(r, ['#f5f5f0', '#cfe0f0', '#e8e2d0']); pants = pick(r, ['#1f2430', '#2d2d34', '#3a3f4a']); shoes = '#121212'; sleeves = 1; walkClip = 'Walk_Formal_Loop'; break;
    case 'estudante': shirt = pick(r, ['#ffffff', '#1d3557', '#2a9d8f', '#e76f51', '#6d597a']); pants = pick(r, ['#2f4b7c', '#355c8a', '#1f1f24']); shoes = pick(r, ['#f2f2f2', '#d62828', '#1d1d1d']); backpack = r() < 0.85; break;
    case 'idoso': shirt = pick(r, ['#c8b89a', '#9aa7b0', '#b5838d', '#e5e5e0']); pants = pick(r, ['#6b6b6b', '#4b4f56', '#7a6a55']); shoes = '#2b2420'; sleeves = r() < 0.5 ? 1 : 0; cap = body === 'male' && r() < 0.4; capColor = '#d8d2c0'; break;
    case 'comerciante': shirt = pick(r, ['#d62828', '#f77f00', '#fcbf49', '#2a9d8f']); pants = pick(r, ['#264653', '#3d405b']); shoes = '#2b2b2b'; cap = r() < 0.3; capColor = shirt; walkClip = r() < 0.4 ? 'Walk_Carry_Loop' : 'Walk_Loop'; break;
    case 'passageiro': shirt = pick(r, ['#5e60ce', '#48bfe3', '#ffffff', '#8d99ae', '#e9c46a', '#264653']); pants = pick(r, ['#22223b', '#3c6e71', '#4a4e69']); shoes = pick(r, ['#1d1d1d', '#f2f2f2']); backpack = r() < 0.35; break;
    case 'guarda': shirt = '#1f3a68'; pants = '#16233d'; shoes = '#0f0f10'; sleeves = 1; cap = true; capColor = '#16233d'; break;
    case 'esportista': shirt = pick(r, ['#ff006e', '#3a86ff', '#ffbe0b', '#06d6a0', '#ffffff']); pants = '#1b1b1f'; trousers = 0; shoes = pick(r, ['#f2f2f2', '#ff006e', '#3a86ff']); break;
    case 'motorista': shirt = pick(r, ['#2b2d42', '#8d99ae', '#ffffff', '#457b9d']); pants = pick(r, ['#22223b', '#1d3557']); shoes = '#1d1d1d'; break;
  }
  const hair: HairStyle = body === 'female'
    ? pick(r, elder ? ['buns', 'buzzed_female', 'long'] as const : ['long', 'long', 'buns', 'buzzed_female'] as const)
    : pick(r, elder ? ['none', 'buzzed', 'simple_parted'] as const : ['buzzed', 'simple_parted', 'simple_parted', 'none'] as const);
  const beard = body === 'male' && r() < (elder ? 0.45 : 0.25);
  const height = (body === 'male' ? 0.92 + r() * 0.11 : 0.9 + r() * 0.09) * (elder ? 0.96 : 1);
  const walkSpeed = (elder ? 0.95 + r() * 0.2 : archetype === 'esportista' ? 1.45 : 1.15 + r() * 0.35) * height;
  const name = body === 'female' ? pick(r, NAMES_F) : pick(r, NAMES_M);
  return {
    seed, archetype, body,
    outfit: { skin, shirt: vary(r, shirt), pants: vary(r, pants, 0.04), shoes: c(shoes), hair: hairColor, sleeves, trousers },
    hair, beard, scale: height, backpack, cap, capColor: c(capColor), walkSpeed, walkClip, name, label: LABEL[archetype],
  };
}
