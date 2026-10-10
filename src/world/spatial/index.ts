/**
 * The spatial core: coordinates, reference frames and addressing.
 *
 * Everything in this folder is pure arithmetic on physical quantities. It has no dependency on
 * Three.js, on the renderer, or on any game system, which is what lets it run in a worker and be
 * tested without a browser. The rule the rest of the world relies on:
 *
 *   the logical model is the truth; rendering is a projection of it, never its source.
 */

export * from './units';
export * from './WGS84';
export * from './Geodetic';
export * from './ECEF';
export * from './ENU';
export * from './SpatialPose';
export * from './ReferenceFrame';
export * from './ReferenceFrameGraph';
export * from './FloatingOrigin3D';
export * from './ManausFrameAdapter';
export * from './UniverseAddress';
