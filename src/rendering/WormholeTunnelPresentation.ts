import {
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Group,
  LineBasicMaterial,
  LineSegments,
  type Object3D,
  Quaternion,
  Vector3,
} from 'three/webgpu';
import type { BlackHoleTransitPhase } from '../world/travel/BlackHoleTransitNetwork';

export interface WormholeTunnelPresentationOptions {
  readonly reducedMotion?: boolean;
}

export interface WormholePhaseProfile {
  readonly throatRadiusM: number;
  readonly streamSpeedMps: number;
  readonly swirlSpeedRadPerS: number;
  readonly opacity: number;
  readonly primaryColor: readonly [number, number, number];
  readonly secondaryColor: readonly [number, number, number];
}

export interface WormholeTunnelSnapshot {
  readonly phase: BlackHoleTransitPhase;
  readonly progress01: number;
  readonly throatRadiusM: number;
  readonly streamSpeedMps: number;
  readonly swirlSpeedRadPerS: number;
  readonly opacity: number;
  readonly primaryColor: readonly [number, number, number];
  readonly secondaryColor: readonly [number, number, number];
}

const RING_COUNT = 24;
const RING_SEGMENTS = 32;
const STREAM_LINE_COUNT = 32;
const TUNNEL_LENGTH_M = 1200;

export function resolveWormholePhaseProfile(
  phase: BlackHoleTransitPhase,
  progress01: number,
  reducedMotion = false
): WormholePhaseProfile {
  const t = Math.min(1, Math.max(0, progress01));
  let profile: WormholePhaseProfile;

  switch (phase) {
    case 'event-horizon-entry': {
      // 0.0 to 1.5s: Inward gravitational collapse into Kerr singularity
      const collapse = Math.min(1, Math.max(0, t / 0.25));
      const r = 250 * (1 - collapse * 0.65);
      profile = {
        throatRadiusM: r,
        streamSpeedMps: 400 + collapse * 1200,
        swirlSpeedRadPerS: 1.5 + collapse * 4.0,
        opacity: 0.4 + collapse * 0.5,
        primaryColor: [0.55, 0.15, 0.95], // Deep relativistic violet
        secondaryColor: [0.95, 0.20, 0.45], // Accretion shear magenta
      };
      break;
    }
    case 'wormhole-tunnel': {
      // 1.5s to 4.5s: Higher-dimensional Einstein-Rosen bridge traversal
      const tunnelProgress = Math.min(1, Math.max(0, (t - 0.25) / 0.50));
      const pulse = Math.sin(tunnelProgress * Math.PI * 6.0) * 0.15;
      profile = {
        throatRadiusM: 90 * (1 + pulse),
        streamSpeedMps: 2800,
        swirlSpeedRadPerS: 5.5,
        opacity: 0.90,
        primaryColor: [0.10, 0.85, 0.98], // Luminescent quantum cyan
        secondaryColor: [0.75, 0.50, 1.00], // Higher-dimensional lavender
      };
      break;
    }
    case 'destination-emergence': {
      // 4.5s to 6.0s: Outward relativistic ejection flash into exit galaxy
      const emergence = Math.min(1, Math.max(0, (t - 0.75) / 0.25));
      const r = 90 + emergence * 400;
      profile = {
        throatRadiusM: r,
        streamSpeedMps: 2800 * (1 - emergence * 0.8),
        swirlSpeedRadPerS: 5.5 * (1 - emergence * 0.7),
        opacity: Math.max(0, 0.95 * (1 - emergence * 0.95)),
        primaryColor: [1.0, 0.88, 0.40], // Radiant exit gold
        secondaryColor: [1.0, 1.0, 1.0], // Superluminal white
      };
      break;
    }
    case 'idle':
    case 'completed':
    default:
      profile = {
        throatRadiusM: 100,
        streamSpeedMps: 0,
        swirlSpeedRadPerS: 0,
        opacity: 0,
        primaryColor: [0, 0, 0],
        secondaryColor: [0, 0, 0],
      };
      break;
  }

  if (!reducedMotion) return profile;
  return {
    ...profile,
    streamSpeedMps: profile.streamSpeedMps * 0.25,
    swirlSpeedRadPerS: profile.swirlSpeedRadPerS * 0.2,
    opacity: Math.min(profile.opacity, 0.5),
  };
}

/**
 * 3D visual presentation for the Einstein-Rosen wormhole transit.
 * Renders concentric throat ribs, longitudinal geodesic stream lines, and an event horizon aperture
 * surrounding the camera during hyperspace traversal.
 */
export class WormholeTunnelPresentation {
  readonly root = new Group();
  private readonly ringsMesh: LineSegments;
  private readonly ringsGeometry: BufferGeometry;
  private readonly ringsMaterial: LineBasicMaterial;

  private readonly streamMesh: LineSegments;
  private readonly streamGeometry: BufferGeometry;
  private readonly streamMaterial: LineBasicMaterial;

  private readonly ringsPositions: Float32Array;
  private readonly streamPositions: Float32Array;

  private axialOffsetM = 0;
  private swirlAngleRad = 0;
  private lastSnapshot?: WormholeTunnelSnapshot;

  constructor(
    parent: Object3D,
    private readonly options: WormholeTunnelPresentationOptions = {}
  ) {
    this.root.name = 'wormhole-tunnel-presentation';
    this.root.visible = false;

    // 1. Concentric Throat Rings
    // RING_COUNT rings, each has RING_SEGMENTS segments = 2 vertices per segment
    const ringVertexCount = RING_COUNT * RING_SEGMENTS * 2;
    this.ringsPositions = new Float32Array(ringVertexCount * 3);
    this.ringsGeometry = new BufferGeometry();
    this.ringsGeometry.setAttribute('position', new BufferAttribute(this.ringsPositions, 3));

    this.ringsMaterial = new LineBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.ringsMesh = new LineSegments(this.ringsGeometry, this.ringsMaterial);
    this.ringsMesh.frustumCulled = false;
    this.root.add(this.ringsMesh);

    // 2. Longitudinal Geodesic Stream Lines
    // STREAM_LINE_COUNT lines along tunnel length = 2 vertices per line
    const streamVertexCount = STREAM_LINE_COUNT * 2;
    this.streamPositions = new Float32Array(streamVertexCount * 3);
    this.streamGeometry = new BufferGeometry();
    this.streamGeometry.setAttribute('position', new BufferAttribute(this.streamPositions, 3));

    this.streamMaterial = new LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.streamMesh = new LineSegments(this.streamGeometry, this.streamMaterial);
    this.streamMesh.frustumCulled = false;
    this.root.add(this.streamMesh);

    parent.add(this.root);
  }

  get snapshot(): WormholeTunnelSnapshot | undefined {
    return this.lastSnapshot;
  }

  update(
    transit: { phase: BlackHoleTransitPhase; progress01: number } | undefined,
    camera: Camera,
    dt: number
  ): void {
    if (!transit || transit.phase === 'idle' || transit.phase === 'completed') {
      this.root.visible = false;
      this.lastSnapshot = undefined;
      return;
    }

    this.root.visible = true;

    // Surrounds the camera in orientation and position
    camera.getWorldPosition(this.root.position);
    camera.getWorldQuaternion(this.root.quaternion);

    const profile = resolveWormholePhaseProfile(
      transit.phase,
      transit.progress01,
      this.options.reducedMotion ?? false
    );

    this.lastSnapshot = {
      phase: transit.phase,
      progress01: transit.progress01,
      throatRadiusM: profile.throatRadiusM,
      streamSpeedMps: profile.streamSpeedMps,
      swirlSpeedRadPerS: profile.swirlSpeedRadPerS,
      opacity: profile.opacity,
      primaryColor: profile.primaryColor,
      secondaryColor: profile.secondaryColor,
    };

    // Integrate animation parameters
    this.axialOffsetM = (this.axialOffsetM + profile.streamSpeedMps * dt) % (TUNNEL_LENGTH_M / RING_COUNT);
    this.swirlAngleRad += profile.swirlSpeedRadPerS * dt;

    // Apply material properties
    this.ringsMaterial.opacity = profile.opacity;
    this.ringsMaterial.color.setRGB(profile.primaryColor[0], profile.primaryColor[1], profile.primaryColor[2]);

    this.streamMaterial.opacity = profile.opacity * 0.85;
    this.streamMaterial.color.setRGB(profile.secondaryColor[0], profile.secondaryColor[1], profile.secondaryColor[2]);

    // Rebuild Throat Rings
    let ringIdx = 0;
    const ringSpacing = TUNNEL_LENGTH_M / RING_COUNT;
    const baseRadius = profile.throatRadiusM;

    for (let r = 0; r < RING_COUNT; r++) {
      // z coordinates: from just behind camera (-50m) to ahead in the corridor (+TUNNEL_LENGTH_M)
      const z = -50 + r * ringSpacing - this.axialOffsetM;
      // Hyperbolic throat flare: r(z) = r0 * sqrt(1 + (z / 400)^2)
      const normalizedZ = z / 400;
      const ringRadius = baseRadius * Math.sqrt(1 + normalizedZ * normalizedZ);
      const ringTwist = this.swirlAngleRad + (r * 0.12);

      for (let s = 0; s < RING_SEGMENTS; s++) {
        const theta1 = (s / RING_SEGMENTS) * Math.PI * 2 + ringTwist;
        const theta2 = ((s + 1) / RING_SEGMENTS) * Math.PI * 2 + ringTwist;

        const x1 = Math.cos(theta1) * ringRadius;
        const y1 = Math.sin(theta1) * ringRadius;
        const x2 = Math.cos(theta2) * ringRadius;
        const y2 = Math.sin(theta2) * ringRadius;

        this.ringsPositions[ringIdx++] = x1;
        this.ringsPositions[ringIdx++] = y1;
        this.ringsPositions[ringIdx++] = -z;

        this.ringsPositions[ringIdx++] = x2;
        this.ringsPositions[ringIdx++] = y2;
        this.ringsPositions[ringIdx++] = -z;
      }
    }
    this.ringsGeometry.attributes.position.needsUpdate = true;

    // Rebuild Geodesic Longitudinal Stream Lines
    let streamIdx = 0;
    for (let line = 0; line < STREAM_LINE_COUNT; line++) {
      const angle = (line / STREAM_LINE_COUNT) * Math.PI * 2 + this.swirlAngleRad;
      const x1 = Math.cos(angle) * (baseRadius * 0.95);
      const y1 = Math.sin(angle) * (baseRadius * 0.95);

      const endAngle = angle + 0.8;
      const endRadius = baseRadius * Math.sqrt(1 + (TUNNEL_LENGTH_M / 400) ** 2);
      const x2 = Math.cos(endAngle) * endRadius;
      const y2 = Math.sin(endAngle) * endRadius;

      this.streamPositions[streamIdx++] = x1;
      this.streamPositions[streamIdx++] = y1;
      this.streamPositions[streamIdx++] = 50;

      this.streamPositions[streamIdx++] = x2;
      this.streamPositions[streamIdx++] = y2;
      this.streamPositions[streamIdx++] = -TUNNEL_LENGTH_M;
    }
    this.streamGeometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.ringsGeometry.dispose();
    this.ringsMaterial.dispose();
    this.streamGeometry.dispose();
    this.streamMaterial.dispose();
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}

