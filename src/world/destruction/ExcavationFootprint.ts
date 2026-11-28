export interface ExcavationFootprint {
  readonly radiusM: number;
  readonly depthM: number;
}

const profiles = {
  laser: [2, .9],
  energy: [5, 1.8],
  shockwave: [10, 2.5],
  kinetic: [6, 2.5],
  stomp: [2, .7],
} as const;

/** Structural damage and the area it affects are independent of this physical cut. */
export function powerExcavation(kind: keyof typeof profiles, size: number, exposureS = 1): ExcavationFootprint {
  const [baseRadius, baseDepth] = profiles[kind];
  const scale = Math.pow(Math.max(1, size), .7);
  const exposure = kind === 'laser' ? .3 + .7 * Math.min(1, Math.max(0, exposureS)) : 1;
  return { radiusM: baseRadius * scale, depthM: baseDepth * scale * exposure };
}
