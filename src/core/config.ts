export const WORLD = {
  chunkSize: 128, detailRadius: 480, mediumRadius: 1350, aggregateRadius: 5400,
  horizonRadius: 24000, hysteresis: 64, maxActiveChunks: 64, maxCachedChunks: 30,
  maxRequests: 4, streamingBudgetMs: 4, prefetchSeconds: 2.8, originThreshold: 2048,
  /** Hard ceiling on chunk activations per frame: a time budget alone still let bursts through. */
  maxActivationsPerFrame: 2,
  /** Above this the world is passing too fast for actors to be worth simulating. */
  actorSpeedLimit: 420, actorCutoffSpeed: 1400,
  maxNPCs: 32, maxVehicles: 20, maxParticles: 600, maxPhysicsBodies: 96,
  groundY: 0, waterY: -3,
  /**
   * On the Largo de São Sebastião, east of the Monumento à Abertura dos Portos, which is world
   * zero, looking west across the square at the Teatro Amazonas 98 m away.
   */
  spawn: { x: 38, y: 2.2, z: 12 }, spawnYaw: 1.432,
} as const;
/** Streaming and representation bands for the compiled Overture/OpenStreetMap city. */
export const REAL_CITY = {
  tileSize: 1024,
  /** Near tier: facades, windows, roofs and collision, promoted per 256 m cell. */
  detailEnter: 340, detailExit: 400,
  /** Shell tier: real footprints in flat colour, measured to the tile footprint. */
  shellRadius: 1850, shellRadiusCruise: 1500, shellRadiusFast: 1050,
  evictMargin: 600, planStep: 220, planInterval: .4, maxTiles: 24, maxConcurrentLoads: 3,
  /** Back-pressure: requesting more tiles while the build queue is deep only starves it further. */
  maxQueuedJobs: 8,
  /** Above these speeds the ring narrows and the near tier stands down entirely. */
  fastSpeed: 700, megaSpeed: 2400, detailSpeedLimit: 620,
  /** Prediction: the ring rides ahead of the player instead of loading what is behind. */
  leadSeconds: 1.6, maxLead: 3200,
  buildBudgetMs: 3.5,
  /** The physical region is far smaller than the visible one at every flight speed. */
  maxColliders: 900,
  /** Levelled buildings remembered before the oldest is allowed to rebuild. */
  maxDestroyed: 65536,
} as const;

/** Structural damage, rubble and scorch. Metres, seconds and metres per second throughout. */
export const DESTRUCTION = {
  /** Health = base + volume·perVolume, capped. A shack falls to one beam, a tower to a volley. */
  baseHealth: 60, healthPerVolume: .02, maxHealth: 9000,
  /** Energy beam. Radius and damage are both multiplied by sqrt(player size). */
  beamDamage: 700, beamRadius: 7, beamThickness: 2.6, shockwaveDamage: 2600, noticeInterval: 2.5,
  /** Gravel and a scorch on every hit, so a shot that fells nothing still reads as a hit. */
  impactChunks: 5, impactEnergy: 1.6, impactColour: 0x9b9184,
  /** Rubble released by a collapse, scaled by the building's cube-root extent. */
  chunksPerCollapse: 9, maxChunksPerCollapse: 46, maxChunkEnergy: 26,
  /** Bounds the cost of a single frame: surplus damage collapses the rest on the next one. */
  maxCollapsesPerFrame: 16,
  /** Debris pool. `maxDebris` is the hard instance cap; `debrisPerParticle` scales it by preset. */
  maxDebris: 420, debrisPerParticle: .7, debrisGravity: 26, debrisBounce: .26, debrisFriction: 3.2,
  debrisLifetime: 4.5, debrisSpeed: 1, debrisSize: 1, debrisCullRadius: 1400,
  /** Scars. `scarHeight` clears the road ribbons and their lane paint, which top out at 38 mm. */
  maxScars: 256, scarsPerParticle: .42, scarLifetime: 95, scarHotTime: 3.2, scarFadeTime: 14,
  scarHeight: .06, scarMaxHeight: 6, scarRadiusScale: 1.35,
  /** The high-speed ram: damage is per metre driven through a mass, so it is frame-rate free. */
  ploughSpeed: 420, ploughDamage: .02, ploughMaxSweep: 220,
  ploughRadius: 8, ploughRadiusPerSpeed: .006, ploughMaxRadius: 70,
  /** Damage map bound: buildings stream forever, so records age out and the map is capped. */
  maxEntries: 512, entryTtl: 25, evictInterval: 2,
} as const;

/**
 * Phase switches for the planetary and cosmic architecture.
 *
 * Each one is temporary and exists so a phase can ship without a second complete architecture
 * living alongside the first. `spatialCore` is on because it only observes; everything that
 * changes what is drawn stays off until its phase is finished and verified in play.
 */
export const FEATURES = {
  /** The reference frames, floating origin and solar system model. Observes; draws nothing. */
  spatialCore: true,
  /** Global tile streaming through the new scheduler. */
  planetStreaming: false,
  /** The WGS84 globe as visible geometry. */
  earthGlobe: false,
  /** Global terrain from a DEM. */
  planetTerrain: false,
  /** Manaus curved onto the ellipsoid. */
  curvedManaus: false,
  /** Planet-aware atmosphere and the render-domain composer. */
  newAtmosphere: false,
  /** Leaving the atmosphere, and the bodies beyond it. */
  solarSystem: false,
  galaxyTravel: false,
} as const;

/** Altitude bands for the flight-to-orbit transition. */
export const SPACE = {
  atmosphereTop: 9000, karman: 26000, orbit: 60000, maxAltitude: 140000,
} as const;
export const QUALITY = {
  Low: { pixelRatio: .7, shadows: false, detailRadius: 280, npcs: 10, vehicles: 7, particles: 160 },
  Medium: { pixelRatio: 1, shadows: true, detailRadius: 380, npcs: 20, vehicles: 12, particles: 300 },
  High: { pixelRatio: 1.35, shadows: true, detailRadius: 480, npcs: 32, vehicles: 20, particles: 450 },
  Ultra: { pixelRatio: 1.75, shadows: true, detailRadius: 600, npcs: 40, vehicles: 28, particles: 600 },
} as const;
export type QualityPreset = keyof typeof QUALITY;
