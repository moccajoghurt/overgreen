import { Scenario, ScenarioCell, TerrainType } from '../types';

/**
 * Succulent Gallery — visual showcase of succulent morphology variants.
 *
 * 8 species in isolated strips separated by rock walls.
 * Each strip has rich water/nutrients so plants thrive and reach full size.
 *   Left: 4 high-succulence archetypes (barrel, columnar, prickly pear, jade)
 *   Middle: 2 transitional/borderline succulents (bottle tree, desert rose)
 *   Right: 1 succulent grass + 1 normal tree for comparison
 *
 * Succulence formula: waterStorage < 0.5 or terrain not arid/hill → 0,
 *   else clamp(waterStorage*0.7 + (1-heightPriority)*0.1 + (1-leafSize)*0.1 + rootPriority*0.1, 0, 1)
 * Threshold: succulence >= 0.45 triggers succulent render path (non-grass, woodiness >= 0.4)
 */
export const experimentSucculentGallery: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];

  // Strip layout: 8 strips of width 8, separated by 2-wide rock walls
  // Strips at x: 0-7, 10-17, 20-27, 30-37, 40-47, 50-57, 60-67, 70-77
  const stripStarts = [0, 10, 20, 30, 40, 50, 60, 70];
  const stripWidth = 8;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inStrip = false;
      for (const sx of stripStarts) {
        if (x >= sx && x < sx + stripWidth) { inStrip = true; break; }
      }

      if (inStrip) {
        cells.push({ x, y, terrain: TerrainType.Soil, elevation: 0.5, water: 15, waterRecharge: 6.0, nutrients: 12 });
      } else {
        cells.push({ x, y, terrain: TerrainType.Rock, elevation: 0.6 });
      }
    }
  }

  return {
    id: 'experiment-succulent-gallery',
    name: '[Exp] Succulent Gallery',
    description: 'Visual showcase of succulent morphology: 6 succulent variants + 1 succulent grass + 1 comparison tree in isolated strips.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      // ── HIGH SUCCULENCE ──

      {
        // succulence = 0.9*0.7 + 0.9*0.1 + 0.7*0.1 + 0.5*0.1 = 0.84
        id: 1,
        name: 'Barrel Cactus',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.1,
          leafSize: 0.3,
          seedInvestment: 0.3,
          seedSize: 0.3,
          defense: 0.3,
          woodiness: 0.6,
          waterStorage: 0.9,
          longevity: 0.5,
        },
        color: { r: 0.2, g: 0.4, b: 0.35 },
        placements: spacedStrip(0, 8, 5, 75, 4),
      },
      {
        // succulence = 0.8*0.7 + 0.3*0.1 + 0.65*0.1 + 0.4*0.1 = 0.70
        id: 2,
        name: 'Saguaro Column',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.7,
          leafSize: 0.35,
          seedInvestment: 0.3,
          seedSize: 0.3,
          defense: 0.2,
          woodiness: 0.7,
          waterStorage: 0.8,
          longevity: 0.5,
        },
        color: { r: 0.15, g: 0.35, b: 0.3 },
        placements: spacedStrip(10, 18, 5, 75, 4),
      },
      {
        // succulence = 0.7*0.7 + 0.85*0.1 + 0.2*0.1 + 0.5*0.1 = 0.65
        id: 3,
        name: 'Prickly Pear',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.15,
          leafSize: 0.8,
          seedInvestment: 0.3,
          seedSize: 0.4,
          defense: 0.6,
          woodiness: 0.55,
          waterStorage: 0.7,
          longevity: 0.5,
        },
        color: { r: 0.25, g: 0.45, b: 0.3 },
        placements: spacedStrip(20, 28, 5, 75, 4),
      },
      {
        // succulence = 0.6*0.7 + 0.7*0.1 + 0.5*0.1 + 0.4*0.1 = 0.58
        id: 4,
        name: 'Jade Tree',
        genome: {
          rootPriority: 0.4,
          heightPriority: 0.3,
          leafSize: 0.5,
          seedInvestment: 0.35,
          seedSize: 0.3,
          defense: 0.1,
          woodiness: 0.65,
          waterStorage: 0.6,
          longevity: 0.5,
        },
        color: { r: 0.2, g: 0.5, b: 0.25 },
        placements: spacedStrip(30, 38, 5, 75, 4),
      },

      // ── TRANSITIONAL / BORDERLINE ──

      {
        // succulence = 0.5*0.7 + 0.6*0.1 + 0.55*0.1 + 0.5*0.1 = 0.52
        id: 5,
        name: 'Bottle Tree',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.4,
          leafSize: 0.45,
          seedInvestment: 0.35,
          seedSize: 0.4,
          defense: 0.15,
          woodiness: 0.7,
          waterStorage: 0.5,
          longevity: 0.5,
        },
        color: { r: 0.3, g: 0.4, b: 0.3 },
        placements: spacedStrip(40, 48, 5, 75, 4),
      },
      {
        // succulence = 0.5*0.7 + 0.75*0.1 + 0.4*0.1 + 0.35*0.1 = 0.50
        id: 6,
        name: 'Desert Rose',
        genome: {
          rootPriority: 0.35,
          heightPriority: 0.25,
          leafSize: 0.6,
          seedInvestment: 0.35,
          seedSize: 0.5,
          defense: 0.15,
          woodiness: 0.6,
          waterStorage: 0.50,
          longevity: 0.5,
        },
        color: { r: 0.35, g: 0.45, b: 0.35 },
        placements: spacedStrip(50, 58, 5, 75, 4),
      },

      // ── COMPARISON ──

      {
        // Succulent grass (woodiness < 0.4 — renders via grass path with waterStorage visuals)
        id: 7,
        name: 'Agave Grass',
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.3,
          leafSize: 0.6,
          seedInvestment: 0.2,
          seedSize: 0.3,
          defense: 0.3,
          woodiness: 0.25,
          waterStorage: 0.85,
          longevity: 0.5,
        },
        color: { r: 0.2, g: 0.5, b: 0.4 },
        placements: spacedStrip(60, 68, 5, 75, 4),
      },
      {
        // Normal tree (low waterStorage, not succulent)
        id: 8,
        name: 'Normal Tree',
        genome: {
          rootPriority: 0.3,
          heightPriority: 0.6,
          leafSize: 0.5,
          seedInvestment: 0.4,
          seedSize: 0.4,
          defense: 0.1,
          woodiness: 0.8,
          waterStorage: 0.1,
          longevity: 0.5,
        },
        color: { r: 0.25, g: 0.55, b: 0.2 },
        placements: spacedStrip(70, 78, 5, 75, 4),
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
