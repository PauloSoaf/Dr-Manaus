/** Curated logical descriptors, shared by navigation and presentation. Mpc relative to Local Group. */
export interface CosmicAnchor {
  id: string;
  name: string;
  positionMpc: [number, number, number];
  massSolar: number;
}
export const KNOWN_COSMIC_ANCHORS: CosmicAnchor[] = [
  { id:'local_group', name:'Local Group', positionMpc:[0,0,0], massSolar:2e12 },
  { id:'virgo_cluster', name:'Virgo Cluster', positionMpc:[16.5,0,0], massSolar:1.2e15 },
  { id:'norma_cluster', name:'Norma Cluster / Great Attractor', positionMpc:[68,-10,20], massSolar:1e16 },
  { id:'shapley_supercluster', name:'Shapley Supercluster', positionMpc:[200,-30,60], massSolar:1e17 },
];
/** Existing observer-relative presentation radius. A reference horizon, not a physical boundary. */
export const OBSERVABLE_HORIZON_MPC = 14200;
