export const WORLD = {
  chunkSize: 128, detailRadius: 330, mediumRadius: 1200, aggregateRadius: 5000,
  horizonRadius: 24000, hysteresis: 48, maxActiveChunks: 42, maxCachedChunks: 24,
  maxRequests: 4, streamingBudgetMs: 3, prefetchSeconds: 2.4, originThreshold: 2048,
  maxNPCs: 32, maxVehicles: 20, maxParticles: 600, maxPhysicsBodies: 96,
  groundY: 0, waterY: -3, spawn: { x: 0, y: 38.5, z: 0 },
} as const;
export const QUALITY = {
  Low: { pixelRatio: .7, shadows: false, detailRadius: 210, npcs: 10, vehicles: 7, particles: 160 },
  Medium: { pixelRatio: 1, shadows: true, detailRadius: 275, npcs: 20, vehicles: 12, particles: 300 },
  High: { pixelRatio: 1.35, shadows: true, detailRadius: 330, npcs: 32, vehicles: 20, particles: 450 },
  Ultra: { pixelRatio: 1.75, shadows: true, detailRadius: 390, npcs: 40, vehicles: 28, particles: 600 },
} as const;
export type QualityPreset = keyof typeof QUALITY;
