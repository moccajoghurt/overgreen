import { Cell, Genome, GRID_WIDTH, Plant, PlantConstants, Seed, SIM, TERRAIN_PROPS, World, getPlantConstants, ZoneModifiers } from '../types';
import { getEffectiveEnv, computeTraitModifier, CellEnvironment, getEnvIdx, NICHE_COUNT } from './trait-effects';
import { NEIGHBORS, inBounds } from './neighbors';
import {
  mutateGenome, crossoverGenome,
  archetype,
} from './plants';
import { cellPlantIds } from './tiers';
import { classifySubtype } from '../types/subtypes';
import { absorbWater } from './water';

// Flat arrays — allocated once, reused every tick.
const _gridSize = GRID_WIDTH * GRID_WIDTH;
const _diseasedGrid = new Uint8Array(_gridSize);
const _archetypeMask = new Uint8Array(_gridSize);

// ── Subtype frequency-dependent selection (FDS) ──
// Per-niche (terrain×climate) subtype population counts, computed each tick.
// Dominant subtypes get a seed production penalty; rare subtypes get a boost.
// This maintains multi-subtype coexistence within each niche.
const SUBTYPE_COUNT = 40;
const _nicheSubtypeCounts = new Uint16Array(NICHE_COUNT * SUBTYPE_COUNT);
const _nicheTotalPlants = new Uint16Array(NICHE_COUNT);

function photosynthesize(plant: Plant, cell: Cell, waterFraction: number, isDiseased: boolean, pc: PlantConstants, cellEnv: CellEnvironment): number {
  const effectiveLeaf = Math.pow(plant.leafArea, SIM.LEAF_EFFICIENCY_EXPONENT);
  const heightLightBonus = plant.height / pc.maxHeight * pc.heightLightBonus;

  // Shade tolerance: short plants are adapted to capture diffuse understory light.
  // Scales inversely with actual height — groundcover & forbs benefit most, trees get nothing.
  // Suppressed in drought-stressed environments where open canopy makes shade adaptation irrelevant.
  const lightInput = plant.effectiveLight;
  const isShaded = lightInput < SIM.BASE_LIGHT * SIM.SHADE_THRESHOLD;
  const heightFactor = Math.max(0, 1 - plant.height / SIM.SHADE_HEIGHT_CUTOFF);
  const shadeStrength = Math.max(SIM.SHADE_FLOOR, 1.0 - cellEnv.droughtStress * 0.8);
  const shadeTolerance = isShaded ? 1.0 + heightFactor * 0.5 * shadeStrength : 1.0;

  // Broad-leaf shade adaptation: large, thin leaves capture diffuse light efficiently.
  // Only applies in shade; benefits forbs (high leafSize) over grasses in understory.
  const leafEfficiency = isShaded ? 1.0 + plant.genome.leafSize * heightFactor * SIM.SHADE_LEAF_EFFICIENCY * shadeStrength : 1.0;

  const rawEnergy = (lightInput + heightLightBonus) * effectiveLeaf * SIM.PHOTOSYNTHESIS_RATE * shadeTolerance * leafEfficiency;

  // Root-gated nutrient access: absolute depth determines access (not relative to archetype max)
  const rootAccess = SIM.NUTRIENT_ROOT_ACCESS_MIN
    + (1 - SIM.NUTRIENT_ROOT_ACCESS_MIN) * (plant.rootDepth / SIM.MAX_ROOT_DEPTH);
  const nutrientBonus = 1 + cell.nutrients * rootAccess * SIM.NUTRIENT_GROWTH_BONUS;

  let energyProduced = rawEnergy * waterFraction * nutrientBonus;
  plant.lastLightReceived = lightInput;

  // Trait tradeoff modifier: genome × environment interaction
  const traitMod = computeTraitModifier(plant.genome, cellEnv);
  plant.lastTraitModifier = traitMod;
  energyProduced *= Math.max(0.15, 1.0 + traitMod);

  if (isDiseased) energyProduced *= SIM.DISEASE_PHOTO_PENALTY + plant.genome.defense * SIM.DEFENSE_DISEASE_PHOTO_RECOVER;
  return energyProduced;
}

function calculateMaintenance(plant: Plant, _world: World, isDiseased: boolean, pc: PlantConstants): number {
  const mBase = pc.maintenanceBase;
  const mHeight = pc.maintenancePerHeight;
  const mRoot = pc.maintenancePerRoot;
  const mLeaf = pc.maintenancePerLeaf;

  const effectiveLeaf = Math.pow(plant.leafArea, SIM.LEAF_EFFICIENCY_EXPONENT);
  const leafMaint = effectiveLeaf * mLeaf;

  // Trait maintenance scales with maturity — seedlings haven't built specialized tissue yet
  const maturity = Math.min(1, plant.height / pc.maxHeight);

  let maintenance = mBase
    + plant.height * mHeight
    + plant.rootDepth * mRoot
    + leafMaint
    + maturity * (
        plant.genome.defense * SIM.DEFENSE_MAINTENANCE_RATE
      + plant.genome.waterStorage * SIM.WATER_STORAGE_MAINTENANCE
      + plant.genome.seedInvestment * SIM.REPRODUCTIVE_MAINTENANCE_RATE
      + plant.genome.longevity * SIM.LONGEVITY_MAINTENANCE_RATE
    );

  if (isDiseased) maintenance += SIM.DISEASE_DRAIN_PER_TICK * (1 - plant.genome.defense * SIM.DEFENSE_DISEASE_DRAIN_RESIST);

  // Senescence: maintenance scales up quadratically past onset fraction of maxAge
  const maxAge = pc.maxAge;
  const onsetAge = maxAge * SIM.SENESCENCE_ONSET;
  if (plant.age > onsetAge) {
    const t = (plant.age - onsetAge) / (maxAge - onsetAge); // 0→1 over senescent period
    maintenance *= 1 + (SIM.SENESCENCE_MAX_MULT - 1) * t * t;
  }

  return maintenance;
}

function allocateGrowthAndSeeds(plant: Plant, surplus: number, world: World, zm: ZoneModifiers, pc: PlantConstants, cellEnv: CellEnvironment): void {
  const growthEff = pc.growthEfficiency;
  const capRoot = pc.maxRootDepth;
  // Wind stunting (krummholz effect): high wind exposure limits maximum height and leaf area.
  // Rigid woody plants are stunted in height; broad-leaved plants lose foliage.
  const windStunt = Math.max(0.1, 1 - cellEnv.windExposure * plant.genome.woodiness * SIM.WIND_STUNT_WOODINESS);
  const capHeight = pc.maxHeight * windStunt;
  const leafWindStunt = Math.max(0.15, 1 - cellEnv.windExposure * plant.genome.leafSize * SIM.WIND_STUNT_LEAF_SIZE);
  const capLeaf = pc.maxLeafArea * leafWindStunt;
  const seedCost = pc.seedEnergyCost;
  const seedRangeMax = pc.seedRangeMax;
  const seedRangeDiv = pc.seedRangeHeightDivisor;
  const seedEnergy = pc.seedInitialEnergy;

  const seedBudget = surplus * plant.genome.seedInvestment * zm.seedMult;
  const growthBudget = surplus * (1 - plant.genome.seedInvestment) * zm.growthMult;

  // Normalize genome priorities for growth allocation
  const total = plant.genome.rootPriority + plant.genome.heightPriority + plant.genome.leafSize;
  const rFrac = total > 0 ? plant.genome.rootPriority / total : 0;
  const hFrac = total > 0 ? plant.genome.heightPriority / total : 0;
  const lFrac = total > 0 ? plant.genome.leafSize / total : 0;

  // Growth allocation — track actual usage so unused budget can redirect to seeds
  let usedGrowthBudget = growthBudget;
  if (total > 0) {
    const rootGrowth = growthBudget * rFrac * growthEff;
    const heightGrowth = growthBudget * hFrac * growthEff;
    const leafGrowth = growthBudget * lFrac * growthEff;

    const maxRoot = capRoot * (0.3 + 0.7 * rFrac);
    const maxHeight = capHeight * (0.3 + 0.7 * hFrac);
    const maxLeaf = capLeaf * (0.3 + 0.7 * lFrac);

    const oldRoot = plant.rootDepth;
    const oldHeight = plant.height;
    const oldLeaf = plant.leafArea;

    plant.rootDepth = Math.min(maxRoot, plant.rootDepth + rootGrowth);
    const newHeight = Math.min(maxHeight, plant.height + heightGrowth);
    if (newHeight !== plant.height) {
      plant.height = newHeight;
      world.heightChangedIds.add(plant.id);
    }
    plant.leafArea = Math.min(maxLeaf, plant.leafArea + leafGrowth);

    // Compute actual growth consumed (reverse efficiency to get budget units)
    const actualRoot = (plant.rootDepth - oldRoot) / growthEff;
    const actualHeight = (plant.height - oldHeight) / growthEff;
    const actualLeaf = (plant.leafArea - oldLeaf) / growthEff;
    usedGrowthBudget = actualRoot + actualHeight + actualLeaf;
  }

  // Redirect unused growth budget to seed production at 50% efficiency
  const unusedGrowth = Math.max(0, growthBudget - usedGrowthBudget);
  // Frequency-dependent selection: dominant subtypes in a niche produce fewer seeds,
  // rare subtypes produce more. Maintains multi-subtype coexistence.
  const fdsCell = world.grid[plant.y][plant.x];
  const fdsNiche = getEnvIdx(fdsCell.climateZone, fdsCell.terrainType);
  const fdsTotal = _nicheTotalPlants[fdsNiche];
  let fdsMult = 1.0;
  if (fdsTotal > 10) {
    const freq = _nicheSubtypeCounts[fdsNiche * SUBTYPE_COUNT + (plant.subtype ?? 0)] / fdsTotal;
    fdsMult = Math.max(0.3, Math.min(2.0, 1.0 - (freq - 1.0 / SUBTYPE_COUNT) * SIM.FDS_STRENGTH));
  }
  const totalSeedBudget = (seedBudget + unusedGrowth * 0.5) * fdsMult;

  // Seed size scaling — small seeds: cheap & far, large seeds: expensive & close
  const seedSizeMult = SIM.SEED_SIZE_MULT_MIN + plant.genome.seedSize * SIM.SEED_SIZE_MULT_RANGE;
  const effectiveSeedCost = seedCost * seedSizeMult;
  const effectiveSeedEnergy = seedEnergy * seedSizeMult;
  const dispersalBonus = Math.round((1 - plant.genome.seedSize) * SIM.SEED_SIZE_DISPERSAL_BONUS);

  // Seed spawning — taller plants disperse further
  const seedRange = Math.round(seedRangeMax) + Math.floor(plant.height / seedRangeDiv) + dispersalBonus;
  const seedsToSpawn = Math.floor(totalSeedBudget / effectiveSeedCost);
  for (let i = 0; i < seedsToSpawn; i++) {
    world.seedsAttempted++;
    const dx = Math.floor(Math.random() * (seedRange * 2 + 1)) - seedRange;
    const dy = Math.floor(Math.random() * (seedRange * 2 + 1)) - seedRange;
    if (dx === 0 && dy === 0) continue;
    const tx = plant.x + dx;
    const ty = plant.y + dy;
    if (!inBounds(tx, ty, world.width, world.height)) continue;
    const targetCell = world.grid[ty][tx];
    if (!TERRAIN_PROPS[targetCell.terrainType].plantable) continue;
    if (targetCell.seeds.length >= SIM.SEED_MAX_PER_CELL) continue;

    // Mate search: scan nearby cells for a same-species mate
    let mateGenome: Genome | null = null;
    const mateR = SIM.CROSSOVER_MATE_RADIUS;
    outer:
    for (let my = plant.y - mateR; my <= plant.y + mateR; my++) {
      for (let mx = plant.x - mateR; mx <= plant.x + mateR; mx++) {
        if (!inBounds(mx, my, world.width, world.height)) continue;
        const mc = world.grid[my][mx];
        for (const mid of cellPlantIds(mc)) {
          if (mid === plant.id) continue;
          const mate = world.plants.get(mid);
          if (mate && mate.alive && mate.speciesId === plant.speciesId) {
            mateGenome = mate.genome;
            break outer;
          }
        }
      }
    }

    const childGenome = mateGenome
      ? mutateGenome(crossoverGenome(plant.genome, mateGenome))
      : mutateGenome(plant.genome);

    // Create dormant seed instead of a live plant
    const childConstants = getPlantConstants(childGenome);
    const seed: Seed = {
      speciesId: plant.speciesId,
      lineageRoot: plant.lineageRoot,
      genome: childGenome,
      energy: effectiveSeedEnergy,
      age: 0,
      generation: plant.generation + 1,
      seedMaxAge: childConstants.seedMaxAge,
      seedGerminationWater: childConstants.seedGerminationWater,
    };
    plant.offspringCount++;
    targetCell.seeds.push(seed);

    // Track seed population per species
    world.seedPopulations.set(seed.speciesId,
      (world.seedPopulations.get(seed.speciesId) ?? 0) + 1);

    world.seedLandingEvents.push({
      parentX: plant.x, parentY: plant.y,
      childX: tx, childY: ty,
      speciesId: plant.speciesId,
      woodiness: childGenome.woodiness,
    });
  }

  plant.energy -= Math.min(seedBudget + growthBudget, surplus);
}

export function phaseUpdatePlants(world: World): void {
  // Build flat disease grid to avoid string-key lookups per plant
  const W = world.width;
  _diseasedGrid.fill(0);

  // Reset subtype FDS counters for this tick
  _nicheSubtypeCounts.fill(0);
  _nicheTotalPlants.fill(0);
  for (const disease of world.environment.diseases) {
    for (const [key] of disease.cells) {
      const i = key.indexOf(',');
      const dx = Number(key.slice(0, i));
      const dy = Number(key.slice(i + 1));
      _diseasedGrid[dy * W + dx] = 1;
    }
  }

  // Pre-compute per-cell archetype bitmasks for facilitation check
  _archetypeMask.fill(0);
  for (const p of world.plants.values()) {
    if (!p.alive) continue;
    _archetypeMask[p.y * W + p.x] |= (1 << archetype(p.genome));
  }

  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const cell = world.grid[plant.y][plant.x];
    const pc = getPlantConstants(plant.genome);

    // Check disease status from pre-built grid
    const isDiseased = _diseasedGrid[plant.y * W + plant.x] === 1;
    plant.isDiseased = isDiseased;

    // Establishment delay — seedlings can't photosynthesize until roots/leaves are built
    // Harsh terrains take longer, rewarding large seeds with more energy reserves
    // Small seedlings take longer to establish (vigor-scaled)
    const cellTp = TERRAIN_PROPS[cell.terrainType];
    const baseEstTicks = cellTp.establishmentTicks;
    const rawVigorEst = SIM.SEED_SIZE_VIGOR_MIN + plant.genome.seedSize * SIM.SEED_SIZE_VIGOR_RANGE;
    const dampenEst = cellTp.vigorDampen;
    const vigorEst = Math.max(0.1, rawVigorEst + (1.0 - rawVigorEst) * dampenEst);
    const estTicks = Math.ceil(baseEstTicks / vigorEst);
    const establishing = plant.age < estTicks;

    const cellEnv = getEffectiveEnv(cell.climateZone, cell.terrainType);

    const waterFraction = establishing ? 0 : absorbWater(plant, cell, world);
    let energyProduced = establishing ? 0 : photosynthesize(plant, cell, waterFraction, isDiseased, pc, cellEnv);

    // Facilitation: DIFFERENT archetypes in neighborhood boost photosynthesis.
    // Excludes own archetype — minority archetypes in a pocket benefit most.
    // Models complementary resource use (different root depths, nutrient cycling).
    if (!establishing) {
      let archetypeSet = 0;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = plant.x + dx, ny = plant.y + dy;
        if (!inBounds(nx, ny, world.width, world.height)) continue;
        archetypeSet |= _archetypeMask[ny * W + nx];
      }
      // Exclude self-archetype: trees among trees get 0 bonus, forbs among trees get bonus
      archetypeSet &= ~(1 << archetype(plant.genome));
      const archetypeCount = (archetypeSet & 1) + ((archetypeSet >> 1) & 1)
        + ((archetypeSet >> 2) & 1) + ((archetypeSet >> 3) & 1) + ((archetypeSet >> 4) & 1);
      energyProduced *= 1.0 + archetypeCount * SIM.FACILITATION_BONUS;

      // Accumulate subtype counts for frequency-dependent selection
      const fdsNiche = getEnvIdx(cell.climateZone, cell.terrainType);
      _nicheSubtypeCounts[fdsNiche * SUBTYPE_COUNT + (plant.subtype ?? 0)]++;
      _nicheTotalPlants[fdsNiche]++;
    }

    const maintenance = calculateMaintenance(plant, world, isDiseased, pc);

    plant.lastEnergyProduced = energyProduced;
    plant.lastMaintenanceCost = maintenance;

    // Update health EMA — smoothed energy ratio for visual health state
    // During establishing, reset peakEnergy so it doesn't stay inflated by
    // germination reserves (2-3 energy). After establishing, track normally
    // from a realistic baseline (~1.0 operating energy).
    if (establishing) {
      plant.peakEnergy = plant.energy;
    } else {
      plant.peakEnergy *= 0.99;
      plant.peakEnergy = Math.max(plant.peakEnergy, plant.energy);
    }
    let healthTarget: number;
    if (establishing) {
      // Establishing seedlings aren't producing yet by design — don't penalize health
      healthTarget = 1.0;
    } else if (maintenance > 0.01) {
      const prodRatio = Math.min(energyProduced / maintenance, 1.5);
      const peakRatio = plant.peakEnergy > 1.0
        ? Math.min(plant.energy / plant.peakEnergy, 1.0)
        : 1.0;
      healthTarget = Math.min(prodRatio, peakRatio);
    } else {
      healthTarget = 1.0;
    }
    // Floor: low absolute energy forces visual decline regardless of ratios
    const energyFloor = Math.min(plant.energy / SIM.ENERGY_FLOOR_THRESHOLD, 1.0);
    healthTarget = Math.min(healthTarget, energyFloor);
    // Floor: approaching maxAge forces visible senescence
    const maxAge = pc.maxAge;
    if (plant.age > maxAge * SIM.VISUAL_SENESCENCE_ONSET) {
      const ageFrac = (plant.age - maxAge * SIM.VISUAL_SENESCENCE_ONSET) / (maxAge * (1 - SIM.VISUAL_SENESCENCE_ONSET));
      healthTarget = Math.min(healthTarget, 1 - ageFrac * ageFrac);
    }
    // Asymmetric smoothing: decline faster than recovery
    const alpha = healthTarget < plant.healthEMA ? SIM.HEALTH_EMA_DECLINE_ALPHA : SIM.HEALTH_EMA_RECOVERY_ALPHA;
    plant.healthEMA += (healthTarget - plant.healthEMA) * alpha;

    // Establishing seedlings can offset maintenance with stored water
    if (establishing && plant.storedWater > 0) {
      const offset = Math.min(maintenance, plant.storedWater);
      plant.storedWater -= offset;
      plant.energy += energyProduced - (maintenance - offset);
    } else {
      plant.energy += energyProduced - maintenance;
    }

    // Energy-based leaf drop: plant sheds leaves when losing energy in harsh conditions
    if (energyProduced < maintenance && (cellEnv.droughtStress > 0.3 || cellEnv.frostRisk > 0.3)) {
      plant.leafArea = 0.1;
    }

    const zmPlant = world.environment.zoneModifiers[cell.climateZone];
    if (plant.energy > 1.0) {
      allocateGrowthAndSeeds(plant, plant.energy - 1.0, world, zmPlant, pc, cellEnv);
    }

    plant.age++;
  }
}
