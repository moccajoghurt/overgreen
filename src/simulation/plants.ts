import {
  Archetype, Genome, Plant, SIM, GRASS,
  SpeciesColor, TerrainType, World,
} from '../types';
import { generateSpeciesName } from '../species-names';

function hsl2rgb(h: number, s: number, l: number): SpeciesColor {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: r + m, g: g + m, b: b + m };
}

function generateSpeciesColor(speciesId: number): SpeciesColor {
  const hue = (speciesId * 137.508) % 360;
  const s = 0.65 + (speciesId % 3) * 0.1;
  const l = 0.45 + (speciesId % 5) * 0.05;
  return hsl2rgb(hue, s, l);
}

export function genomeDistance(a: Genome, b: Genome): number {
  const dr = a.rootPriority - b.rootPriority;
  const dh = a.heightPriority - b.heightPriority;
  const dl = a.leafSize - b.leafSize;
  const ds = a.seedInvestment - b.seedInvestment;
  const da = a.allelopathy - b.allelopathy;
  const dd = a.defense - b.defense;
  return Math.sqrt(dr * dr + dh * dh + dl * dl + ds * ds + da * da + dd * dd);
}

export function randomGenome(): Genome {
  return {
    rootPriority: 0.1 + Math.random() * 0.8,
    heightPriority: 0.1 + Math.random() * 0.8,
    leafSize: 0.1 + Math.random() * 0.8,
    seedInvestment: 0.1 + Math.random() * 0.8,
    allelopathy: 0.1 + Math.random() * 0.8,
    defense: 0.1 + Math.random() * 0.8,
  };
}

export function createPlant(id: number, x: number, y: number, genome: Genome, speciesId: number, archetype: Archetype = 'tree'): Plant {
  const isGrass = archetype === 'grass';
  return {
    id, speciesId, archetype, x, y, genome,
    height: isGrass ? GRASS.SEEDLING_HEIGHT : 1,
    rootDepth: isGrass ? GRASS.SEEDLING_ROOT : 1,
    leafArea: isGrass ? GRASS.SEEDLING_LEAF : 1,
    energy: 3.0, age: 0, alive: true,
    lastLightReceived: 0, lastWaterAbsorbed: 0,
    lastEnergyProduced: 0, lastMaintenanceCost: 0, isDiseased: false,
    generation: 0, parentId: null, offspringCount: 0,
  };
}

export function mutateGenome(parent: Genome, mutationRate?: number): Genome {
  const rate = mutationRate ?? SIM.MUTATION_RATE;
  const mutate = (val: number) =>
    Math.max(0.01, Math.min(0.99, val + (Math.random() * 2 - 1) * rate));
  return {
    rootPriority: mutate(parent.rootPriority),
    heightPriority: mutate(parent.heightPriority),
    leafSize: mutate(parent.leafSize),
    seedInvestment: mutate(parent.seedInvestment),
    allelopathy: mutate(parent.allelopathy),
    defense: mutate(parent.defense),
  };
}

export function seedInitialPlants(world: World, _count: number): void {
  const CLUSTER_COUNT = 10;
  const CLUSTER_RADIUS = 8;
  const SPECIES_PER_CLUSTER = 4;
  const GRASS_PER_CLUSTER = 2;
  const COPIES_PER_SPECIES = 2;

  // Generate 12 candidate centers on a jittered 4x3 grid, take 10
  const gridCols = 4, gridRows = 3;
  const cellW = world.width / (gridCols + 1);
  const cellH = world.height / (gridRows + 1);
  const candidates: { x: number; y: number }[] = [];

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const cx = Math.round(cellW * (c + 1) + (Math.random() - 0.5) * cellW * 0.5);
      const cy = Math.round(cellH * (r + 1) + (Math.random() - 0.5) * cellH * 0.5);
      candidates.push({
        x: Math.max(CLUSTER_RADIUS, Math.min(world.width - CLUSTER_RADIUS - 1, cx)),
        y: Math.max(CLUSTER_RADIUS, Math.min(world.height - CLUSTER_RADIUS - 1, cy)),
      });
    }
  }

  // Shuffle and take 8 centers
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const centers = candidates.slice(0, CLUSTER_COUNT);

  // Seed species in each cluster
  for (const center of centers) {
    for (let s = 0; s < SPECIES_PER_CLUSTER; s++) {
      const archetype: Archetype = s < GRASS_PER_CLUSTER ? 'grass' : 'tree';
      const genome = randomGenome();
      const speciesId = world.nextSpeciesId++;
      world.speciesColors.set(speciesId, generateSpeciesColor(speciesId));
      world.speciesNames.set(speciesId, generateSpeciesName(genome, speciesId, archetype));

      // Place 2 copies of this species within cluster radius
      for (let copy = 0; copy < COPIES_PER_SPECIES; copy++) {
        for (let attempt = 0; attempt < 20; attempt++) {
          const dx = Math.floor(Math.random() * (CLUSTER_RADIUS * 2 + 1)) - CLUSTER_RADIUS;
          const dy = Math.floor(Math.random() * (CLUSTER_RADIUS * 2 + 1)) - CLUSTER_RADIUS;
          const px = center.x + dx;
          const py = center.y + dy;
          if (px < 0 || px >= world.width || py < 0 || py >= world.height) continue;
          const cell = world.grid[py][px];
          if (cell.plantId !== null) continue;
          if (cell.terrainType === TerrainType.River || cell.terrainType === TerrainType.Rock) continue;

          const id = world.nextPlantId++;
          const plant = createPlant(id, px, py, genome, speciesId, archetype);
          world.plants.set(id, plant);
          cell.plantId = id;
          cell.lastSpeciesId = speciesId;
          break;
        }
      }
    }
  }
}
