import {
  Genome, Plant, SIM, SpeciesCentroid,
  SpeciesColor, TerrainType, World, getPlantConstants,
  Archetype, archetype,
} from '../types';
import { generateSpeciesName } from '../species-names';
import { classifySubtype } from '../renderer3d/subtypes';

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

export function generateSpeciesColor(speciesId: number): SpeciesColor {
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
  const dsz = a.seedSize - b.seedSize;
  const dd = a.defense - b.defense;
  const dw = a.woodiness - b.woodiness;
  const dwst = a.waterStorage - b.waterStorage;
  const dlon = a.longevity - b.longevity;
  return Math.sqrt(dr * dr + dh * dh + dl * dl + ds * ds + dsz * dsz + dd * dd + dw * dw + dwst * dwst + dlon * dlon);
}

export { Archetype, archetype } from '../types';

export function createSpeciesCentroid(genome: Genome): SpeciesCentroid {
  return {
    sumRoot: genome.rootPriority,
    sumHeight: genome.heightPriority,
    sumLeaf: genome.leafSize,
    sumSeed: genome.seedInvestment,
    sumSeedSize: genome.seedSize,
    sumDefense: genome.defense,
    sumWoodiness: genome.woodiness,
    sumWaterStorage: genome.waterStorage,
    sumLongevity: genome.longevity,
    count: 1,
    foundingGenome: { ...genome },
  };
}

export function addToCentroid(centroid: SpeciesCentroid, genome: Genome): void {
  centroid.sumRoot += genome.rootPriority;
  centroid.sumHeight += genome.heightPriority;
  centroid.sumLeaf += genome.leafSize;
  centroid.sumSeed += genome.seedInvestment;
  centroid.sumSeedSize += genome.seedSize;
  centroid.sumDefense += genome.defense;
  centroid.sumWoodiness += genome.woodiness;
  centroid.sumWaterStorage += genome.waterStorage;
  centroid.sumLongevity += genome.longevity;
  centroid.count++;
}

export function removeFromCentroid(centroid: SpeciesCentroid, genome: Genome): void {
  centroid.sumRoot -= genome.rootPriority;
  centroid.sumHeight -= genome.heightPriority;
  centroid.sumLeaf -= genome.leafSize;
  centroid.sumSeed -= genome.seedInvestment;
  centroid.sumSeedSize -= genome.seedSize;
  centroid.sumDefense -= genome.defense;
  centroid.sumWoodiness -= genome.woodiness;
  centroid.sumWaterStorage -= genome.waterStorage;
  centroid.sumLongevity -= genome.longevity;
  centroid.count--;
}

export function getCentroidGenome(centroid: SpeciesCentroid): Genome {
  if (centroid.count < SIM.SPECIATION_MIN_SPECIES_SIZE) {
    return centroid.foundingGenome;
  }
  const n = centroid.count;
  return {
    rootPriority: centroid.sumRoot / n,
    heightPriority: centroid.sumHeight / n,
    leafSize: centroid.sumLeaf / n,
    seedInvestment: centroid.sumSeed / n,
    seedSize: centroid.sumSeedSize / n,
    defense: centroid.sumDefense / n,
    woodiness: centroid.sumWoodiness / n,
    waterStorage: centroid.sumWaterStorage / n,
    longevity: centroid.sumLongevity / n,
  };
}

export function crossoverGenome(a: Genome, b: Genome): Genome {
  const pick = (va: number, vb: number) => Math.random() < 0.5 ? va : vb;
  return {
    rootPriority: pick(a.rootPriority, b.rootPriority),
    heightPriority: pick(a.heightPriority, b.heightPriority),
    leafSize: pick(a.leafSize, b.leafSize),
    seedInvestment: pick(a.seedInvestment, b.seedInvestment),
    seedSize: pick(a.seedSize, b.seedSize),
    defense: pick(a.defense, b.defense),
    woodiness: pick(a.woodiness, b.woodiness),
    waterStorage: pick(a.waterStorage, b.waterStorage),
    longevity: pick(a.longevity, b.longevity),
  };
}

export function randomGenome(): Genome {
  return {
    rootPriority: 0.1 + Math.random() * 0.8,
    heightPriority: 0.1 + Math.random() * 0.8,
    leafSize: 0.1 + Math.random() * 0.8,
    seedInvestment: 0.1 + Math.random() * 0.8,
    seedSize: 0.1 + Math.random() * 0.8,
    defense: 0.1 + Math.random() * 0.8,
    woodiness: 0.1 + Math.random() * 0.8,
    waterStorage: 0.1 + Math.random() * 0.8,
    longevity: 0.1 + Math.random() * 0.8,
  };
}

export function createPlant(id: number, x: number, y: number, genome: Genome, speciesId: number): Plant {
  const pc = getPlantConstants(genome);
  return {
    id, speciesId, x, y, genome,
    height: pc.seedlingHeight,
    rootDepth: pc.seedlingRoot,
    leafArea: pc.seedlingLeaf,
    energy: 3.0, age: 0, alive: true,
    lastLightReceived: 0, lastWaterAbsorbed: 0,
    lastEnergyProduced: 0, lastMaintenanceCost: 0, isDiseased: false, storedWater: 0,
    generation: 0, parentId: null, offspringCount: 0,
  };
}

export function mutateGenome(parent: Genome, mutationRate?: number): Genome {
  const rate = mutationRate ?? SIM.MUTATION_RATE;
  const clamp = (val: number) => Math.max(0.01, Math.min(0.99, val));
  const keys: (keyof Genome)[] = [
    'rootPriority', 'heightPriority', 'leafSize',
    'seedInvestment', 'seedSize', 'defense', 'woodiness', 'waterStorage', 'longevity',
  ];
  // Pick 1-2 genes to mutate (like real point mutations)
  const count = Math.random() < 0.5 ? 1 : 2;
  const toMutate = new Set<keyof Genome>();
  while (toMutate.size < count) {
    toMutate.add(keys[Math.floor(Math.random() * keys.length)]);
  }
  const result = { ...parent };
  for (const key of toMutate) {
    result[key] = clamp(result[key] + (Math.random() * 2 - 1) * rate);
  }
  return result;
}

export function seedSinglePlant(world: World): void {
  const cx = Math.floor(world.width / 2);
  const cy = Math.floor(world.height / 2);
  const genome: Genome = {
    rootPriority: 0.5,
    heightPriority: 0.5,
    leafSize: 0.5,
    seedInvestment: 0.5,
    seedSize: 0.5,
    defense: 0.5,
    woodiness: 0.5,
    waterStorage: 0.5,
    longevity: 0.5,
  };
  const speciesId = world.nextSpeciesId++;
  const subtype = classifySubtype(genome);
  world.speciesColors.set(speciesId, generateSpeciesColor(speciesId));
  world.speciesNames.set(speciesId, generateSpeciesName(genome, speciesId, subtype));
  world.speciesSubtypes.set(speciesId, subtype);

  const id = world.nextPlantId++;
  const plant = createPlant(id, cx, cy, genome, speciesId);
  world.plants.set(id, plant);
  const cell = world.grid[cy][cx];
  cell.plantId = id;
  cell.lastSpeciesId = speciesId;
  world.speciesCentroids.set(speciesId, createSpeciesCentroid(genome));
}

export function seedInitialPlants(world: World, _count: number): void {
  const CLUSTER_COUNT = 10;
  const CLUSTER_RADIUS = 8;
  const SPECIES_PER_CLUSTER = 4;
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

  // Shuffle and take 10 centers
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const centers = candidates.slice(0, CLUSTER_COUNT);

  // Seed species in each cluster
  for (const center of centers) {
    for (let s = 0; s < SPECIES_PER_CLUSTER; s++) {
      const genome = randomGenome();
      const speciesId = world.nextSpeciesId++;
      const subtype = classifySubtype(genome);
      world.speciesColors.set(speciesId, generateSpeciesColor(speciesId));
      world.speciesNames.set(speciesId, generateSpeciesName(genome, speciesId, subtype));
      world.speciesSubtypes.set(speciesId, subtype);

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
          const plant = createPlant(id, px, py, genome, speciesId);
          world.plants.set(id, plant);
          cell.plantId = id;
          cell.lastSpeciesId = speciesId;

          // Track species centroid
          const existing = world.speciesCentroids.get(speciesId);
          if (!existing) {
            world.speciesCentroids.set(speciesId, createSpeciesCentroid(genome));
          } else {
            addToCentroid(existing, genome);
          }
          break;
        }
      }
    }
  }
}
