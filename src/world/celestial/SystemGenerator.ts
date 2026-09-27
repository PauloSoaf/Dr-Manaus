import { circularOrbitRateRadS, type CelestialBody } from './CelestialBody';

export interface ProceduralSystem {
  readonly starId: string;
  readonly seed: bigint;
  readonly bodies: readonly CelestialBody[];
}

export function generateSystem(starId: string, starSeed: bigint, starMass: number): ProceduralSystem {
  let state = starSeed || 0x9e37_79b9_7f4a_7c15n;
  const nextFloat = () => {
    state ^= (state << 13n) & 0xffff_ffff_ffff_ffffn;
    state ^= state >> 7n;
    state ^= (state << 17n) & 0xffff_ffff_ffff_ffffn;
    state &= 0xffff_ffff_ffff_ffffn;
    return Number(state >> 11n) / 2 ** 53;
  };

  const nextInt = (min: number, max: number) => {
    return Math.floor(nextFloat() * (max - min + 1)) + min;
  };

  const planetCount = nextInt(2, 10);
  const bodies: CelestialBody[] = [];

  // Generate the star itself. One radius, not two draws: a star drawn with an equatorial radius
  // from one random and a polar radius from the next is not oblate, it is arbitrary.
  const starRadiusM = 6.957e8 * Math.max(0.1, nextFloat() * 5);
  const starMassKg = 1.989e30 * starMass;
  bodies.push({
    id: starId,
    name: starId,
    equatorialRadiusM: starRadiusM,
    polarRadiusM: starRadiusM,
    massKg: starMassKg,
    rotationPeriodS: 2.14e6,
    frameId: `${starId}-fixed`
  });

  // Generate planets
  let currentOrbitM = 5e10; // 0.3 AU starting point

  for (let i = 0; i < planetCount; i++) {
    currentOrbitM += nextFloat() * 1.5e11 + 2e10; // Spacing between planets
    const isGasGiant = nextFloat() > 0.7;
    const radiusM = isGasGiant ? nextFloat() * 5e7 + 2e7 : nextFloat() * 6e6 + 2e6;
    const massKg = isGasGiant ? radiusM * 1e20 : radiusM * 1e18; // Simple proxy

    const planetId = `${starId}_planet_${i}`;
    bodies.push({
      id: planetId,
      name: planetId,
      parentId: starId,
      equatorialRadiusM: radiusM,
      polarRadiusM: radiusM,
      massKg,
      rotationPeriodS: nextFloat() * 86400 * 2,
      frameId: `${planetId}-fixed`,
      // The orbit this planet was just given, recorded where the runtime will find it.
      orbit: {
        semiMajorAxisM: currentOrbitM,
        phaseRad: nextFloat() * Math.PI * 2,
        angularRateRadS: circularOrbitRateRadS(currentOrbitM, starMassKg),
        // A few degrees at most: a planetary system is a disc, not a swarm.
        inclinationRad: (nextFloat() - 0.5) * 0.12,
      },
    });

    // Moons
    const moonCount = isGasGiant ? nextInt(0, 5) : nextInt(0, 2);
    let moonOrbitM = radiusM * 3;
    for (let m = 0; m < moonCount; m++) {
      moonOrbitM += nextFloat() * radiusM * 2;
      const moonRadiusM = nextFloat() * 1e6 + 1e5;
      bodies.push({
        id: `${planetId}_moon_${m}`,
        name: `${planetId}_moon_${m}`,
        parentId: planetId,
        equatorialRadiusM: moonRadiusM,
        polarRadiusM: moonRadiusM,
        massKg: moonRadiusM * 1e17,
        rotationPeriodS: nextFloat() * 86400 * 5,
        frameId: `${planetId}_moon_${m}-fixed`,
        orbit: {
          semiMajorAxisM: moonOrbitM,
          phaseRad: nextFloat() * Math.PI * 2,
          angularRateRadS: circularOrbitRateRadS(moonOrbitM, massKg),
          inclinationRad: (nextFloat() - 0.5) * 0.3,
        },
      });
    }
  }

  return { starId, seed: starSeed, bodies };
}
