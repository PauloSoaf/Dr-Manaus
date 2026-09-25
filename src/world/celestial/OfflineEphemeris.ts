import { degToRad, type Vec3 } from '../spatial/units';
import {
  type EphemerisProvider, type EphemerisSample, type OrbitalElements,
  auToM, positionFromElements, velocityFromElements,
} from './EphemerisProvider';

/**
 * Offline ephemerides from published Keplerian elements.
 *
 * The specification allows either sampled JPL Horizons data or simplified orbital elements. This
 * takes the second road deliberately: it is a few hundred numbers instead of a dataset, it needs
 * no download and no network at any point, and it is exactly reproducible on every machine.
 *
 * The source is JPL's "Approximate Positions of the Major Planets" (Standish), whose elements and
 * per-century rates are fitted for 1800–2050. Accuracy is arcminutes rather than the arcseconds a
 * spacecraft would need — and the specification says as much: what matters for play is that the
 * order, the distances and the motion are right, not navigation-grade precision.
 *
 * Longitudes are referred to the J2000 ecliptic. Epochs are seconds from J2000.
 */

interface ElementRow {
  /** Semi-major axis, astronomical units, and its rate per Julian century. */
  readonly a: readonly [number, number];
  readonly e: readonly [number, number];
  /** Degrees, and degrees per Julian century, for the four angles. */
  readonly i: readonly [number, number];
  readonly meanLongitude: readonly [number, number];
  readonly longitudeOfPerihelion: readonly [number, number];
  readonly longitudeOfAscendingNode: readonly [number, number];
}

const ROWS: Readonly<Record<string, ElementRow>> = {
  mercury: {
    a: [0.387_099_27, 0.000_000_37], e: [0.205_635_93, 0.000_019_06],
    i: [7.004_979_02, -0.005_947_49], meanLongitude: [252.250_323_50, 149_472.674_111_75],
    longitudeOfPerihelion: [77.457_796_28, 0.160_476_89],
    longitudeOfAscendingNode: [48.330_765_93, -0.125_340_81],
  },
  venus: {
    a: [0.723_335_66, 0.000_003_90], e: [0.006_776_72, -0.000_041_07],
    i: [3.394_676_05, -0.000_788_90], meanLongitude: [181.979_099_50, 58_517.815_387_29],
    longitudeOfPerihelion: [131.602_467_18, 0.002_683_29],
    longitudeOfAscendingNode: [76.679_842_55, -0.277_694_18],
  },
  // The published row is the Earth–Moon barycentre. Earth itself wanders about 4 700 km from it,
  // which is under a thousandth of the distance to the Sun and far below what this model resolves.
  earth: {
    a: [1.000_002_61, 0.000_005_62], e: [0.016_711_23, -0.000_043_92],
    i: [-0.000_015_31, -0.012_946_68], meanLongitude: [100.464_571_66, 35_999.372_449_81],
    longitudeOfPerihelion: [102.937_681_93, 0.323_273_64],
    longitudeOfAscendingNode: [0, 0],
  },
  mars: {
    a: [1.523_710_34, 0.000_018_47], e: [0.093_394_10, 0.000_078_82],
    i: [1.849_691_42, -0.008_131_31], meanLongitude: [-4.553_432_05, 19_140.302_684_99],
    longitudeOfPerihelion: [-23.943_629_59, 0.444_410_88],
    longitudeOfAscendingNode: [49.559_538_91, -0.292_573_43],
  },
  jupiter: {
    a: [5.202_887_00, -0.000_116_07], e: [0.048_386_24, -0.000_132_53],
    i: [1.304_396_95, -0.001_837_14], meanLongitude: [34.396_440_51, 3_034.746_127_75],
    longitudeOfPerihelion: [14.728_479_83, 0.212_526_68],
    longitudeOfAscendingNode: [100.473_909_09, 0.204_691_06],
  },
  saturn: {
    a: [9.536_675_94, -0.001_250_60], e: [0.053_861_79, -0.000_509_91],
    i: [2.485_991_87, 0.001_936_09], meanLongitude: [49.954_244_23, 1_222.493_622_01],
    longitudeOfPerihelion: [92.598_878_31, -0.418_972_16],
    longitudeOfAscendingNode: [113.662_424_48, -0.288_677_94],
  },
  uranus: {
    a: [19.189_164_64, -0.001_961_76], e: [0.047_257_44, -0.000_043_97],
    i: [0.772_637_83, -0.002_429_39], meanLongitude: [313.238_104_51, 428.482_027_85],
    longitudeOfPerihelion: [170.954_276_30, 0.408_052_81],
    longitudeOfAscendingNode: [74.016_925_03, 0.042_405_89],
  },
  neptune: {
    a: [30.069_922_76, 0.000_262_91], e: [0.008_590_48, 0.000_051_05],
    i: [1.770_043_47, 0.000_353_72], meanLongitude: [-55.120_029_69, 218.459_453_25],
    longitudeOfPerihelion: [44.964_762_27, -0.322_414_64],
    longitudeOfAscendingNode: [131.784_225_74, -0.005_086_64],
  },
};

/**
 * The Moon, about Earth. Mean elements only: the real lunar orbit is perturbed strongly enough
 * that a Keplerian ellipse is worth a few tenths of a degree, which is visible against the stars
 * but entirely adequate for flying there and landing on it.
 */
const MOON_ROW: ElementRow = {
  a: [384_400_000 / 149_597_870_700, 0], e: [0.054_900, 0],
  i: [5.145, 0],
  // A sidereal month is 27.321 582 days, so the mean longitude advances 360 degrees in that time.
  meanLongitude: [218.316, 481_267.881],
  longitudeOfPerihelion: [83.353, 4_069.013_4],
  longitudeOfAscendingNode: [125.044_5, -1_934.136_2],
};

function toElements(row: ElementRow): OrbitalElements {
  return {
    semiMajorAxisM: auToM(row.a[0]),
    eccentricity: row.e[0],
    inclinationRad: degToRad(row.i[0]),
    meanLongitudeRad: degToRad(row.meanLongitude[0]),
    longitudeOfPerihelionRad: degToRad(row.longitudeOfPerihelion[0]),
    longitudeOfAscendingNodeRad: degToRad(row.longitudeOfAscendingNode[0]),
    semiMajorAxisRateMPerCentury: auToM(row.a[1]),
    eccentricityRatePerCentury: row.e[1],
    inclinationRateRadPerCentury: degToRad(row.i[1]),
    meanLongitudeRateRadPerCentury: degToRad(row.meanLongitude[1]),
    longitudeOfPerihelionRateRadPerCentury: degToRad(row.longitudeOfPerihelion[1]),
    longitudeOfAscendingNodeRateRadPerCentury: degToRad(row.longitudeOfAscendingNode[1]),
  };
}

const ELEMENTS: ReadonlyMap<string, OrbitalElements> = new Map([
  ...Object.entries(ROWS).map(([id, row]) => [id, toElements(row)] as const),
  ['moon', toElements(MOON_ROW)] as const,
]);

export class OfflineEphemeris implements EphemerisProvider {
  /** Which bodies this provider can answer for. The Sun is the origin and needs no entry. */
  get bodyIds(): readonly string[] { return ['sun', ...ELEMENTS.keys()]; }

  elementsFor(bodyId: string): OrbitalElements | undefined { return ELEMENTS.get(bodyId); }

  sample(bodyId: string, epochS: number): EphemerisSample | undefined {
    // The Sun is at the origin of the frame every other body is measured in.
    if (bodyId === 'sun') {
      return { epochS, positionM: [0, 0, 0] as Vec3, velocityMps: [0, 0, 0] as Vec3 };
    }
    const elements = ELEMENTS.get(bodyId);
    if (!elements) return undefined;
    return {
      epochS,
      positionM: positionFromElements(elements, epochS),
      velocityMps: velocityFromElements(elements, epochS),
    };
  }
}
