import {
  Genome, Plant, SIM, SpeciesColor, TerrainType, World,
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
  return Math.sqrt(dr * dr + dh * dh + dl * dl + ds * ds);
}

export function randomGenome(): Genome {
  return {
    rootPriority: 0.1 + Math.random() * 0.8,
    heightPriority: 0.1 + Math.random() * 0.8,
    leafSize: 0.1 + Math.random() * 0.8,
    seedInvestment: 0.1 + Math.random() * 0.8,
  };
}

export function createPlant(id: number, x: number, y: number, genome: Genome, speciesId: number): Plant {
  return {
    id, speciesId, x, y, genome,
    height: 1, rootDepth: 1, leafArea: 1,
    energy: 3.0, age: 0, alive: true,
    lastLightReceived: 0, lastWaterAbsorbed: 0,
    lastEnergyProduced: 0, lastMaintenanceCost: 0, isDiseased: false,
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
  };
}

export function seedInitialPlants(world: World, count: number): void {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 10) {
    attempts++;
    const x = Math.floor(Math.random() * world.width);
    const y = Math.floor(Math.random() * world.height);
    if (world.grid[y][x].plantId !== null) continue;
    const t = world.grid[y][x].terrainType;
    if (t === TerrainType.River || t === TerrainType.Rock) continue;

    const speciesId = world.nextSpeciesId++;
    world.speciesColors.set(speciesId, generateSpeciesColor(speciesId));
    const id = world.nextPlantId++;
    const genome = randomGenome();
    world.speciesNames.set(speciesId, generateSpeciesName(genome, speciesId));
    const plant = createPlant(id, x, y, genome, speciesId);
    world.plants.set(id, plant);
    world.grid[y][x].plantId = id;
    world.grid[y][x].lastSpeciesId = speciesId;
    placed++;
  }
}
