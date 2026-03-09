import { Scenario, ScenarioSpecies, ClimateZone } from '../types';

/**
 * Neutral Baseline: 80×80 all Soil, all Temperate.
 * No barriers, no terrain variation. Same 5 starter species scattered uniformly.
 * Null hypothesis — trait drift here is competition-driven, not environmental.
 */
export const experimentNeutralBaseline: Scenario = (() => {
  const size = 80;

  // Same starter genomes as Niche Matrix
  const starterGenomes: { name: string; genome: ScenarioSpecies['genome']; color: ScenarioSpecies['color'] }[] = [
    {
      name: 'Starter Grass',
      genome: { rootPriority: 0.40, heightPriority: 0.30, leafSize: 0.30, seedInvestment: 0.50, seedSize: 0.40, defense: 0.10, woodiness: 0.15, waterStorage: 0.10, longevity: 0.30 },
      color: { r: 0.3, g: 0.7, b: 0.2 },
    },
    {
      name: 'Starter Forb',
      genome: { rootPriority: 0.30, heightPriority: 0.25, leafSize: 0.60, seedInvestment: 0.50, seedSize: 0.35, defense: 0.25, woodiness: 0.20, waterStorage: 0.20, longevity: 0.35 },
      color: { r: 0.6, g: 0.3, b: 0.6 },
    },
    {
      name: 'Starter Shrub',
      genome: { rootPriority: 0.35, heightPriority: 0.30, leafSize: 0.40, seedInvestment: 0.40, seedSize: 0.45, defense: 0.30, woodiness: 0.55, waterStorage: 0.30, longevity: 0.50 },
      color: { r: 0.5, g: 0.5, b: 0.2 },
    },
    {
      name: 'Starter Tree',
      genome: { rootPriority: 0.40, heightPriority: 0.45, leafSize: 0.45, seedInvestment: 0.30, seedSize: 0.60, defense: 0.20, woodiness: 0.85, waterStorage: 0.20, longevity: 0.65 },
      color: { r: 0.2, g: 0.5, b: 0.3 },
    },
    {
      name: 'Starter Succulent',
      genome: { rootPriority: 0.35, heightPriority: 0.20, leafSize: 0.30, seedInvestment: 0.40, seedSize: 0.55, defense: 0.30, woodiness: 0.50, waterStorage: 0.65, longevity: 0.50 },
      color: { r: 0.4, g: 0.7, b: 0.5 },
    },
  ];

  // 50 plants per species, uniformly scattered across the 80×80 grid
  // Use deterministic grid placement: 5×10 grid per species, offset by species index
  const species: ScenarioSpecies[] = starterGenomes.map((s, i) => {
    const placements: { x: number; y: number }[] = [];
    // 50 plants in a ~7×7 sub-grid pattern offset by species
    const cols = 10;
    const rows = 5;
    const spacingX = Math.floor(size / cols);
    const spacingY = Math.floor(size / rows);
    const offsetX = (i % 3) * 2 + 1;
    const offsetY = Math.floor(i / 3) * 2 + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c * spacingX + offsetX) % size;
        const y = (r * spacingY + offsetY) % size;
        placements.push({ x, y });
      }
    }
    return {
      id: i + 1,
      name: s.name,
      genome: s.genome,
      color: s.color,
      placements,
    };
  });

  return {
    id: 'experiment-neutral-baseline',
    name: '[Exp] Neutral Baseline',
    description: 'All Soil, all Temperate, no barriers. Same 5 starter species. Null hypothesis for trait drift comparison against Niche Matrix.',
    size,
    defaultTerrain: 0, // TerrainType.Soil
    defaultElevation: 0.5,
    defaultZone: ClimateZone.Temperate,
    cells: [],
    species,
  };
})();
