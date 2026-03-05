import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * Shrub Gallery — visual showcase of shrub morphology variants.
 *
 * 8 species in isolated strips separated by rock walls.
 * Each strip has rich water/nutrients so plants thrive.
 *   Left: 4 shrub archetypes (max → moderate shrubiness)
 *   Right: 2 borderline shrubs + 2 non-shrub trees for comparison
 *
 * Shrubiness formula: clamp((1 - heightPriority) * leafSize - seedInvestment * 0.2, 0, 1)
 */
export const experimentShrubGallery: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Strip layout: 8 strips of width 8, separated by 2-wide rock walls
  // Strips at x: 0-7, 10-17, 20-27, 30-37, 40-47, 50-57, 60-67, 70-77
  const stripStarts = [0, 10, 20, 30, 40, 50, 60, 70];
  const stripWidth = 8;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Check if this cell is in a rock wall (gap between strips)
      let inStrip = false;
      for (const sx of stripStarts) {
        if (x >= sx && x < sx + stripWidth) { inStrip = true; break; }
      }

      if (inStrip) {
        cells.push({ x, y, terrain: TerrainType.Soil, elevation: 0.5, water: 10, waterRecharge: 3.0, nutrients: 8 });
      } else {
        cells.push({ x, y, terrain: TerrainType.Rock, elevation: 0.6 });
      }
    }
  }

  return {
    id: 'experiment-shrub-gallery',
    name: '[Exp] Shrub Gallery',
    description: 'Visual showcase of shrub morphology: 6 shrub variants + 2 comparison trees in isolated strips.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      // ── HIGH SHRUBINESS ──

      {
        // shrubiness = (0.8)(0.85) - 0.25*0.2 = 0.63
        id: 1,
        name: 'Broad Thicket',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.2,
          leafSize: 0.85,
          seedInvestment: 0.25,
          seedSize: 0.3,
          defense: 0.1,
          woodiness: 0.7,
          waterStorage: 0.2,
        },
        color: { r: 0.2, g: 0.7, b: 0.2 },
        placements: spacedStrip(0, 8, 5, 75, 6),
      },
      {
        // shrubiness = (0.8)(0.8) - 0.25*0.2 = 0.59
        id: 2,
        name: 'Deep Chaparral',
        genome: {
          rootPriority: 0.6,
          heightPriority: 0.2,
          leafSize: 0.8,
          seedInvestment: 0.25,
          seedSize: 0.2,
          defense: 0.2,
          woodiness: 0.75,
          waterStorage: 0.4,
        },
        color: { r: 0.5, g: 0.6, b: 0.2 },
        placements: spacedStrip(10, 18, 5, 75, 6),
      },
      {
        // shrubiness = (0.8)(0.7) - 0.4*0.2 = 0.48
        id: 3,
        name: 'Berry Bush',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.2,
          leafSize: 0.7,
          seedInvestment: 0.4,
          seedSize: 0.6,
          defense: 0.1,
          woodiness: 0.6,
          waterStorage: 0.3,
        },
        color: { r: 0.3, g: 0.6, b: 0.4 },
        placements: spacedStrip(20, 28, 5, 75, 6),
      },
      {
        // shrubiness = (0.8)(0.8) - 0.25*0.2 = 0.59
        id: 4,
        name: 'Thorny Bramble',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.2,
          leafSize: 0.8,
          seedInvestment: 0.25,
          seedSize: 0.2,
          defense: 0.8,
          woodiness: 0.65,
          waterStorage: 0.15,
        },
        color: { r: 0.4, g: 0.5, b: 0.2 },
        placements: spacedStrip(30, 38, 5, 75, 6),
      },

      // ── MODERATE / BORDERLINE SHRUBINESS ──

      {
        // shrubiness = (0.65)(0.8) - 0.25*0.2 = 0.47
        id: 5,
        name: 'Tall Shrub',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.35,
          leafSize: 0.8,
          seedInvestment: 0.25,
          seedSize: 0.3,
          defense: 0.1,
          woodiness: 0.7,
          waterStorage: 0.2,
        },
        color: { r: 0.25, g: 0.65, b: 0.3 },
        placements: spacedStrip(40, 48, 5, 75, 6),
      },
      {
        // shrubiness = (0.8)(0.5) - 0.25*0.2 = 0.35
        id: 6,
        name: 'Compact Hedge',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.2,
          leafSize: 0.5,
          seedInvestment: 0.25,
          seedSize: 0.3,
          defense: 0.3,
          woodiness: 0.7,
          waterStorage: 0.3,
        },
        color: { r: 0.3, g: 0.55, b: 0.25 },
        placements: spacedStrip(50, 58, 5, 75, 6),
      },

      // ── COMPARISON TREES (not shrubby) ──

      {
        // shrubiness = (0.2)(0.3) - 0.2*0.2 = 0.02 (tall conifer)
        id: 7,
        name: 'Tall Conifer',
        genome: {
          rootPriority: 0.3,
          heightPriority: 0.8,
          leafSize: 0.3,
          seedInvestment: 0.2,
          seedSize: 0.3,
          defense: 0.1,
          woodiness: 0.85,
          waterStorage: 0.2,
        },
        color: { r: 0.15, g: 0.4, b: 0.3 },
        placements: spacedStrip(60, 68, 5, 75, 6),
      },
      {
        // shrubiness = (0.5)(0.5) - 0.3*0.2 = 0.19 (barely above threshold, mild blend)
        id: 8,
        name: 'Broadleaf Tree',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.5,
          leafSize: 0.5,
          seedInvestment: 0.3,
          seedSize: 0.4,
          defense: 0.1,
          woodiness: 0.8,
          waterStorage: 0.25,
        },
        color: { r: 0.25, g: 0.55, b: 0.2 },
        placements: spacedStrip(70, 78, 5, 75, 6),
      },
    ],
  };
})();

/** Place plants on a regular grid within a strip, spaced `gap` cells apart */
function spacedStrip(x0: number, x1: number, y0: number, y1: number, gap: number) {
  const pts: { x: number; y: number }[] = [];
  for (let y = y0; y < y1; y += gap) {
    for (let x = x0; x < x1; x += gap) {
      pts.push({ x, y });
    }
  }
  return pts;
}
