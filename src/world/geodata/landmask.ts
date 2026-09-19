export interface LandMaskPayload {
  originX: number;
  originZ: number;
  /** Metres covered by one cell. */
  cell: number;
  width: number;
  height: number;
  /** Base64 bitmask, row-major in z, bit set means water. */
  bits: string;
}

function decodeBase64(text: string): Uint8Array<ArrayBuffer> {
  // Workers have neither Buffer nor a DOM, so atob is the one decoder available in every context.
  if (typeof atob === 'function') {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const globals = globalThis as { Buffer?: { from(input: string, encoding: string): Uint8Array } };
  if (globals.Buffer) return Uint8Array.from(globals.Buffer.from(text, 'base64'));
  return new Uint8Array(0);
}

/**
 * A 128 m land/water grid baked from the real Overture river polygons.
 *
 * `isLand` gates where procedural buildings and vegetation may be generated, and it is called
 * from inside the chunk worker, so it has to be synchronous and allocation-free. A bitmask is
 * a few tens of kilobytes and answers in constant time, where the hand-drawn shoreline polyline
 * it replaces was both a scan and wrong.
 */
export class LandMask {
  private bytes: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private originX = 0;
  private originZ = 0;
  private cell = 128;
  private width = 0;
  private height = 0;

  get ready(): boolean { return this.width > 0 && this.bytes.length > 0; }
  get waterCells(): number {
    let total = 0;
    for (const byte of this.bytes) {
      let value = byte;
      while (value) { total += value & 1; value >>>= 1; }
    }
    return total;
  }

  load(payload: LandMaskPayload | null | undefined): boolean {
    this.bytes = new Uint8Array(0); this.width = this.height = 0;
    if (!payload?.bits || !payload.width || !payload.height || !payload.cell) return false;
    const bytes = decodeBase64(payload.bits);
    const rowBytes = Math.ceil(payload.width / 8);
    if (bytes.length < rowBytes * payload.height) return false;
    this.bytes = bytes;
    this.originX = payload.originX; this.originZ = payload.originZ;
    this.cell = payload.cell; this.width = payload.width; this.height = payload.height;
    return true;
  }

  /** Outside the baked extent the answer is `false`, so callers keep their own fallback. */
  isWater(x: number, z: number): boolean {
    if (!this.width) return false;
    const cx = Math.floor((x - this.originX) / this.cell);
    const cz = Math.floor((z - this.originZ) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.width || cz >= this.height) return false;
    const rowBytes = Math.ceil(this.width / 8);
    return (this.bytes[cz * rowBytes + (cx >> 3)] >> (cx & 7) & 1) === 1;
  }

  /** True when the point falls inside the baked extent at all. */
  covers(x: number, z: number): boolean {
    if (!this.width) return false;
    const cx = Math.floor((x - this.originX) / this.cell);
    const cz = Math.floor((z - this.originZ) / this.cell);
    return cx >= 0 && cz >= 0 && cx < this.width && cz < this.height;
  }
}

/** One shared instance; `geodata` consults it and falls back to the generalized shoreline. */
export const LAND_MASK = new LandMask();
