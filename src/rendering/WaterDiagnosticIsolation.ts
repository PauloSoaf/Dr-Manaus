import type { Group, Object3D } from 'three/webgpu';

export type VisualIsolationMode =
  | 'none'
  | 'water-only'
  | 'riverbed-only'
  | 'ground-cover-only'
  | 'terrain-backdrop-only'
  | 'roads-only'
  | 'real-city-only'
  | 'water-vfx-only';

export const VISUAL_ISOLATION_MODES: readonly VisualIsolationMode[] = [
  'none',
  'water-only',
  'riverbed-only',
  'ground-cover-only',
  'terrain-backdrop-only',
  'roads-only',
  'real-city-only',
  'water-vfx-only',
] as const;

export const VISUAL_ISOLATION_LABELS: Readonly<Record<VisualIsolationMode, string>> = {
  'none': 'NENHUM (Todas as camadas visíveis)',
  'water-only': 'SOMENTE ÁGUA (WaterSystem)',
  'riverbed-only': 'SOMENTE LEITO 3D (manaus-riverbed)',
  'ground-cover-only': 'SOMENTE TERRENO (ground-cover)',
  'terrain-backdrop-only': 'SOMENTE HORIZONTE (terrain-backdrop)',
  'roads-only': 'SOMENTE ESTRADAS (legacy-osm-roads)',
  'real-city-only': 'SOMENTE CIDADE REAL (RealCityLayer)',
  'water-vfx-only': 'SOMENTE EFEITOS AQUÁTICOS (WaterVFX)',
};

export interface VisualIsolationTargets {
  waterMesh?: Object3D | null;
  waterVfxGroup?: Object3D | null;
  flatTerrainGroup?: Group | null;
  realCityRoot?: Object3D | null;
  streamerRoot?: Object3D | null;
  hlodRoot?: Object3D | null;
  landmarksRoot?: Object3D | null;
  largoRoot?: Object3D | null;
  forestRoot?: Object3D | null;
}

/**
 * Non-persistent runtime visual layer isolation controller for diagnosing checkerboard patterns,
 * overlapping geometry, z-fighting, and water/riverbed alignment.
 */
export class WaterDiagnosticIsolationController {
  private currentMode: VisualIsolationMode = 'none';

  get mode(): VisualIsolationMode {
    return this.currentMode;
  }

  get label(): string {
    return VISUAL_ISOLATION_LABELS[this.currentMode];
  }

  get isActive(): boolean {
    return this.currentMode !== 'none';
  }

  cycleNext(targets: VisualIsolationTargets): VisualIsolationMode {
    const idx = VISUAL_ISOLATION_MODES.indexOf(this.currentMode);
    const next = VISUAL_ISOLATION_MODES[(idx + 1) % VISUAL_ISOLATION_MODES.length];
    return this.setMode(next, targets);
  }

  reset(targets: VisualIsolationTargets): VisualIsolationMode {
    return this.setMode('none', targets);
  }

  setMode(mode: VisualIsolationMode, targets: VisualIsolationTargets): VisualIsolationMode {
    this.currentMode = VISUAL_ISOLATION_MODES.includes(mode) ? mode : 'none';
    this.apply(targets);
    return this.currentMode;
  }

  apply(targets: VisualIsolationTargets): void {
    const mode = this.currentMode;
    const terrain = targets.flatTerrainGroup;
    const riverbed = terrain?.getObjectByName('manaus-riverbed');
    const groundCover = terrain?.getObjectByName('ground-cover');
    const backdrop = terrain?.getObjectByName('terrain-backdrop');
    const osmRoads = terrain?.getObjectByName('legacy-osm-roads');
    const osmLines = terrain?.getObjectByName('legacy-osm-road-markings');

    if (mode === 'none') {
      if (targets.waterMesh) targets.waterMesh.visible = true;
      if (targets.waterVfxGroup) targets.waterVfxGroup.visible = true;
      if (terrain) terrain.visible = true;
      if (riverbed) riverbed.visible = true;
      if (groundCover) groundCover.visible = true;
      if (backdrop) backdrop.visible = true;
      if (osmRoads) osmRoads.visible = true;
      if (osmLines) osmLines.visible = true;
      if (targets.realCityRoot) targets.realCityRoot.visible = true;
      if (targets.streamerRoot) targets.streamerRoot.visible = true;
      if (targets.hlodRoot) targets.hlodRoot.visible = true;
      if (targets.landmarksRoot) targets.landmarksRoot.visible = true;
      if (targets.largoRoot) targets.largoRoot.visible = true;
      if (targets.forestRoot) targets.forestRoot.visible = true;
      return;
    }

    // In any isolation mode, first hide all candidate layers, then enable only the isolated target
    if (targets.waterMesh) targets.waterMesh.visible = mode === 'water-only';
    if (targets.waterVfxGroup) targets.waterVfxGroup.visible = mode === 'water-vfx-only';

    const needsTerrainGroup =
      mode === 'riverbed-only'
      || mode === 'ground-cover-only'
      || mode === 'terrain-backdrop-only'
      || mode === 'roads-only';
    if (terrain) terrain.visible = needsTerrainGroup;
    if (riverbed) riverbed.visible = mode === 'riverbed-only';
    if (groundCover) groundCover.visible = mode === 'ground-cover-only';
    if (backdrop) backdrop.visible = mode === 'terrain-backdrop-only';
    if (osmRoads) osmRoads.visible = mode === 'roads-only';
    if (osmLines) osmLines.visible = mode === 'roads-only';

    if (targets.realCityRoot) targets.realCityRoot.visible = mode === 'real-city-only';
    if (targets.streamerRoot) targets.streamerRoot.visible = false;
    if (targets.hlodRoot) targets.hlodRoot.visible = false;
    if (targets.landmarksRoot) targets.landmarksRoot.visible = false;
    if (targets.largoRoot) targets.largoRoot.visible = false;
    if (targets.forestRoot) targets.forestRoot.visible = false;
  }
}
