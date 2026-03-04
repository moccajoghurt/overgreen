export type ColorMode = 'natural' | 'species';

export interface Renderer {
  render(selectedCell: { x: number; y: number } | null): void;
  cellAt(canvasX: number, canvasY: number): { x: number; y: number } | null;
  projectToScreen(gridX: number, gridY: number): { x: number; y: number } | null;
  moveTo(gridX: number, gridY: number): void;
  setColorMode(mode: ColorMode): void;
  setHoveredSpecies(speciesId: number | null): void;
  markPlantsDirty(): void;
  rebuildTerrain(): void;
  rebuildWater(): void;
}
