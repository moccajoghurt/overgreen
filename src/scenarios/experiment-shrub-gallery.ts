import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * Shrub Gallery — visual showcase of shrub morphology variants.
 *
 * 8 species arranged in vertical strips across the map:
 *   Left half: 4 shrub archetypes (max → moderate shrubiness)
 *   Right half: 2 borderline shrubs + 2 non-shrub trees for comparison
 *
 * Shrubiness formula: clamp((1 - heightPriority) * leafSize - seedInvestment * 0.2, 0, 1)
 */
export const experimentShrubGallery: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  return {
    id: 'experiment-shrub-gallery',
    name: '[Exp] Shrub Gallery',
    description: 'Visual showcase of shrub morphology: 6 shrub variants + 2 comparison trees, arranged in strips.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      // ── HIGH SHRUBINESS ──

      {
        // shrubiness = (0.9)(0.9) - 0.1*0.2 = 0.79
        id: 1,
        name: 'Broad Thicket',
        genome: {
          rootPriority: 0.3,
          heightPriority: 0.1,
          leafSize: 0.9,
          seedInvestment: 0.1,
          seedSize: 0.3,
          defense: 0.1,
          woodiness: 0.7,
          waterStorage: 0.2,
        },
        color: { r: 0.2, g: 0.7, b: 0.2 },
        placements: strip(2, 9, 5, 75, 50),
      },
      {
        // shrubiness = (0.85)(0.8) - 0.15*0.2 = 0.65
        id: 2,
        name: 'Deep Chaparral',
        genome: {
          rootPriority: 0.7,
          heightPriority: 0.15,
          leafSize: 0.8,
          seedInvestment: 0.15,
          seedSize: 0.2,
          defense: 0.2,
          woodiness: 0.75,
          waterStorage: 0.4,
        },
        color: { r: 0.5, g: 0.6, b: 0.2 },
        placements: strip(12, 19, 5, 75, 50),
      },
      {
        // shrubiness = (0.9)(0.7) - 0.4*0.2 = 0.55
        id: 3,
        name: 'Berry Bush',
        genome: {
          rootPriority: 0.2,
          heightPriority: 0.1,
          leafSize: 0.7,
          seedInvestment: 0.4,
          seedSize: 0.6,
          defense: 0.1,
          woodiness: 0.6,
          waterStorage: 0.3,
        },
        color: { r: 0.3, g: 0.6, b: 0.4 },
        placements: strip(22, 29, 5, 75, 50),
      },
      {
        // shrubiness = (0.9)(0.85) - 0.1*0.2 = 0.745
        id: 4,
        name: 'Thorny Bramble',
        genome: {
          rootPriority: 0.2,
          heightPriority: 0.1,
          leafSize: 0.85,
          seedInvestment: 0.1,
          seedSize: 0.2,
          defense: 0.8,
          woodiness: 0.65,
          waterStorage: 0.15,
        },
        color: { r: 0.4, g: 0.5, b: 0.2 },
        placements: strip(32, 39, 5, 75, 50),
      },

      // ── MODERATE / BORDERLINE SHRUBINESS ──

      {
        // shrubiness = (0.65)(0.8) - 0.15*0.2 = 0.49
        id: 5,
        name: 'Tall Shrub',
        genome: {
          rootPriority: 0.3,
          heightPriority: 0.35,
          leafSize: 0.8,
          seedInvestment: 0.15,
          seedSize: 0.3,
          defense: 0.1,
          woodiness: 0.7,
          waterStorage: 0.2,
        },
        color: { r: 0.25, g: 0.65, b: 0.3 },
        placements: strip(42, 49, 5, 75, 50),
      },
      {
        // shrubiness = (0.8)(0.5) - 0.1*0.2 = 0.38
        id: 6,
        name: 'Compact Hedge',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.2,
          leafSize: 0.5,
          seedInvestment: 0.1,
          seedSize: 0.3,
          defense: 0.3,
          woodiness: 0.7,
          waterStorage: 0.3,
        },
        color: { r: 0.3, g: 0.55, b: 0.25 },
        placements: strip(52, 59, 5, 75, 50),
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
        placements: strip(62, 69, 5, 75, 50),
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
        placements: strip(72, 78, 5, 75, 50),
      },
    ],
  };
})();

/** Dense vertical strip placement */
function strip(x0: number, x1: number, y0: number, y1: number, count: number) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({
      x: x0 + Math.floor(Math.random() * (x1 - x0)),
      y: y0 + Math.floor(Math.random() * (y1 - y0)),
    });
  }
  return pts;
}
