/**
 * Close-range surface detail for rocky planets, computed per pixel.
 *
 * The bundled relief and albedo grids have one sample every few kilometres, so a planet seen from
 * its own ground would be a smooth, even colour with nothing to judge distance by. Four octaves of
 * mottling and craters (2 m, 16 m, 128 m and 1 km cells) are shaded on top of the measured
 * surface. Each fades in as the camera nears it, so the view sharpens from far to near instead of
 * switching textures. Only colour and shading change: geometry and collision stay the measured
 * surface.
 *
 * Detail is anchored to the body: every vertex carries its body-fixed position reduced modulo
 * `DETAIL_PERIOD_M`, a multiple of every octave's lattice period, so it never slides with the
 * floating origin and matches across tile edges. The reduction keeps float32 precision near 3 cm.
 */
import {
  attribute, exp, float, floor, Fn, hash, If, length, max, mix, mod, normalize, positionView, smoothstep, uint, vec3, vec4,
} from 'three/tsl';
import type Node from 'three/src/nodes/core/Node.js';

export const DETAIL_CELLS_M = [2, 16, 128, 1024] as const;
/** Lattice cells before an octave repeats. */
export const DETAIL_LATTICE = 256;
export const DETAIL_PERIOD_M = DETAIL_LATTICE * DETAIL_CELLS_M[DETAIL_CELLS_M.length - 1];
/** An octave is fully drawn within this many of its cells from the camera, and gone at twice that. */
export const DETAIL_FADE_CELLS = 90;

export interface PlanetDetailStyle {
  /** Share of lattice cells that hold a crater, per octave. */
  readonly craters: number;
  /** Relative brightness variation of the ground. */
  readonly mottling: number;
  /** How strongly crater slopes tilt the shading. */
  readonly relief: number;
}

const STYLES: Readonly<Record<string, PlanetDetailStyle>> = {
  moon: { craters: .6, mottling: .22, relief: .85 },
  mercury: { craters: .55, mottling: .18, relief: .8 },
  mars: { craters: .2, mottling: .24, relief: .6 },
  venus: { craters: .05, mottling: .12, relief: .4 },
};
const DEFAULT_STYLE: PlanetDetailStyle = { craters: .3, mottling: .18, relief: .65 };
export const planetDetailStyle = (bodyId: string): PlanetDetailStyle => STYLES[bodyId] ?? DEFAULT_STYLE;

/** Distance at which an octave stops contributing, metres. */
export const detailVisibleWithinM = (cellM: number) => cellM * DETAIL_FADE_CELLS * 2;

/** Fraction of an octave drawn at a camera distance; mirrors the shader's fade. */
export function detailWeight(cellM: number, distanceM: number): number {
  const t = Math.max(0, Math.min(1, (distanceM - cellM * DETAIL_FADE_CELLS) / (cellM * DETAIL_FADE_CELLS)));
  return 1 - t * t * (3 - 2 * t);
}

/** Body-fixed position reduced modulo the detail period, component-wise and never negative. */
export function detailBase(bodyFixedM: number): number {
  return ((bodyFixedM % DETAIL_PERIOD_M) + DETAIL_PERIOD_M) % DETAIL_PERIOD_M;
}

/** One random value per lattice cell; the cell index wraps so every octave tiles with the period. */
const cellValue = (cell: Node<'vec3'>, salt: number) => {
  const wrapped = mod(cell, float(DETAIL_LATTICE));
  return hash(uint(wrapped.x).add(uint(wrapped.y).mul(uint(DETAIL_LATTICE)))
    .add(uint(wrapped.z).mul(uint(DETAIL_LATTICE * DETAIL_LATTICE)))
    .add(uint(salt * DETAIL_LATTICE ** 3)));
};

const valueNoise = (q: Node<'vec3'>, salt: number) => {
  const cell = floor(q), f = q.sub(cell), u = f.mul(f).mul(f.mul(-2).add(3));
  const corner = (x: number, y: number, z: number) => cellValue(cell.add(vec3(x, y, z)), salt);
  return mix(
    mix(mix(corner(0, 0, 0), corner(1, 0, 0), u.x), mix(corner(0, 1, 0), corner(1, 1, 0), u.x), u.y),
    mix(mix(corner(0, 0, 1), corner(1, 0, 1), u.x), mix(corner(0, 1, 1), corner(1, 1, 1), u.x), u.y),
    u.z);
};

/**
 * Returns vec4(slope in body-fixed axes, brightness factor) for the fragment.
 *
 * `strength` scales everything and skips the work when zero.
 */
export function planetDetailNode(style: PlanetDetailStyle, strength: Node<'float'>) {
  return Fn(() => {
    const position = attribute('detailCoord', 'vec3');
    const distance = length(positionView);
    const brightness = float(1).toVar();
    const slope = vec3(0, 0, 0).toVar();
    DETAIL_CELLS_M.forEach((cellM, octave) => {
      const weight = float(1).sub(smoothstep(cellM * DETAIL_FADE_CELLS, detailVisibleWithinM(cellM), distance)).mul(strength);
      If(weight.greaterThan(.002), () => {
        const q = position.div(cellM);
        brightness.addAssign(valueNoise(q.mul(1.7), octave).sub(.5).mul(style.mottling).mul(weight));
        // At most one crater per cell, small enough to stay inside it, so one lookup suffices.
        const cell = floor(q);
        const present = float(cellValue(cell, 8 + octave).lessThan(style.craters));
        const centre = cell.add(vec3(cellValue(cell, 12 + octave), cellValue(cell, 16 + octave), cellValue(cell, 20 + octave))
          .mul(.4).add(.3));
        const radius = cellValue(cell, 24 + octave).mul(.18).add(.12);
        const offset = q.sub(centre);
        const span = max(length(offset), float(1e-4));
        const t = span.div(radius);
        const bowl = float(1).sub(smoothstep(.85, 1.05, t));
        const rimShape = t.sub(1).div(.22);
        const rim = exp(rimShape.mul(rimShape).negate());
        // d(height)/dt of a parabolic bowl with a raised rim, in crater radii.
        const rise = t.mul(bowl).add(rim.mul(rimShape).mul(-.2 / .22 * 2));
        const amount = present.mul(weight);
        slope.addAssign(offset.div(span).mul(rise).mul(amount));
        brightness.addAssign(rim.mul(.16).sub(bowl.mul(float(1).sub(t).max(0)).mul(.14)).mul(amount));
      });
    });
    return vec4(slope, brightness);
  })();
}

/** Tilts the surface normal by the detail slope, ignoring the part along the normal itself. */
export function detailNormalNode(normal: Node<'vec3'>, slope: Node<'vec3'>, relief: number) {
  return normalize(normal.sub(slope.sub(normal.mul(slope.dot(normal))).mul(relief)));
}
