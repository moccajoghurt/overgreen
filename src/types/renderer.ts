export interface Renderer {
  render(selectedCell: { x: number; y: number } | null): void;
  cellAt(canvasX: number, canvasY: number): { x: number; y: number } | null;
  projectToScreen(gridX: number, gridY: number): { x: number; y: number } | null;
  moveTo(gridX: number, gridY: number): void;
  setColorMode(mode: 'natural' | 'species'): void;
  setHoveredSpecies(speciesId: number | null): void;
}
