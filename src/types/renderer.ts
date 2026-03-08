import type { TimingHooks } from '../perf';

export type ColorMode = 'natural' | 'species';

export interface Renderer {
  render(selectedCell: { x: number; y: number } | null, hooks?: TimingHooks): void;
  cellAt(canvasX: number, canvasY: number): { x: number; y: number } | null;
  plantAt(canvasX: number, canvasY: number): { plantId: number; speciesId: number } | null;
  projectToScreen(gridX: number, gridY: number): { x: number; y: number } | null;
  moveTo(gridX: number, gridY: number): void;
  setColorMode(mode: ColorMode): void;
  setHighlightedSpecies(ids: Set<number> | null): void;
  setHighlightedLineageRoot(rootId: number | null): void;
  markPlantsDirty(): void;
  rebuildTerrain(): void;
  rebuildWater(): void;
  camera: import('three').PerspectiveCamera;
  mapControls: import('three/addons/controls/MapControls.js').MapControls;
}
