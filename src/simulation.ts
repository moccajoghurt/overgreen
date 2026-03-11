import { Cell, ClimateZone, Genome, GRID_WIDTH, Plant, PlantConstants, Seed, SIM, TERRAIN_PROPS, TerrainType, World, getPlantConstants, ZoneModifiers } from './types';
import { getEffectiveEnv, computeTraitModifier, CellEnvironment } from './simulation/trait-effects';
import type { TimingHooks } from './perf';
import { NEIGHBORS, inBounds } from './simulation/neighbors';
import {
  mutateGenome, crossoverGenome,
  Archetype, archetype,
  generateSpeciesColor,
} from './simulation/plants';
import { generateSpeciesName } from './species-names';
import { phaseEnvironment } from './simulation/environment';
import { phaseHerbivores } from './simulation/herbivores';
import { phaseTierAssignment, phaseTierLight, cellPlantIds, cellIsEmpty, cellHasSpace, cellPrimaryPlantId, setCellPlant, clearCellPlant, Tier } from './simulation/tiers';
import { classifySubtype } from './types/subtypes';

export { createWorld } from './simulation/terrain';
export { seedInitialPlants, seedSinglePlant } from './simulation/plants';
export { spawnFire, spawnDisease } from './simulation/environment';

// ── Simulation phases ──

function phaseRechargeWater(world: World): void {
  const env = world.environment;
  const nutrientDecay = SIM.NUTRIENT_DECAY;
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      const zm = env.zoneModifiers[cell.climateZone];
      let recharge = cell.waterRechargeRate * zm.waterMult;

      // Drought: reduce recharge + evaporate water
      for (const d of env.droughts) {
        const dx = x - d.centerX;
        const dy = y - d.centerY;
        const dist2 = dx * dx + dy * dy;
        const r2 = d.radius * d.radius;
        if (dist2 < r2) {
          const falloff = 1 - Math.sqrt(dist2) / d.radius;
          recharge *= 1 - falloff * d.intensity;
          cell.waterLevel = Math.max(0, cell.waterLevel - falloff * SIM.DROUGHT_EVAPORATION_RATE);
        }
      }

      // Arid dry spell: zero recharge + mild evaporation for all arid cells
      if (cell.terrainType === TerrainType.Arid && env.aridDrySpell) {
        recharge = 0;
        cell.waterLevel = Math.max(0, cell.waterLevel - SIM.ARID_DRY_SPELL_EVAP);
      }

      cell.waterLevel = Math.min(cell.waterLevel + recharge, SIM.MAX_WATER);
      cell.nutrients = Math.max(0, cell.nutrients - nutrientDecay);
      // Hill bedrock nutrient extraction: deep roots weather minerals
      if (cell.terrainType === TerrainType.Hill && !cellIsEmpty(cell)) {
        const hillPlantId = cellPrimaryPlantId(cell);
        const hillPlant = hillPlantId !== null ? world.plants.get(hillPlantId) : undefined;
        if (hillPlant && hillPlant.alive) {
          const hillMaxRoot = getPlantConstants(hillPlant.genome).maxRootDepth;
          const hillRootFrac = hillPlant.rootDepth / hillMaxRoot;
          if (hillRootFrac > SIM.HILL_ROOT_NUTRIENT_THRESHOLD) {
            const extraction = (hillRootFrac - SIM.HILL_ROOT_NUTRIENT_THRESHOLD)
              * SIM.HILL_ROOT_NUTRIENT_BONUS * hillPlant.rootDepth;
            cell.nutrients = Math.min(SIM.HILL_NUTRIENT_MAX, cell.nutrients + extraction);
          }
        }
      }
      cell.nutrients = Math.min(TERRAIN_PROPS[cell.terrainType].nutrientMax, cell.nutrients);
    }
  }

  // River seepage: river cells share water with neighbors
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      if (cell.terrainType !== TerrainType.River) continue;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, world.width, world.height)) continue;
        const neighbor = world.grid[ny][nx];
        if (neighbor.terrainType === TerrainType.River) continue;
        neighbor.waterLevel = Math.min(SIM.MAX_WATER, neighbor.waterLevel + SIM.RIVER_SEEPAGE);
        neighbor.nutrients = Math.min(SIM.MAX_NUTRIENTS, neighbor.nutrients + SIM.RIVER_NUTRIENT_SEEPAGE);
      }
    }
  }
}

// Flat arrays for light calculation — allocated once, reused every tick.
// Replaces per-neighbor Map.get() lookups with direct Float32Array indexing.
const _gridSize = GRID_WIDTH * GRID_WIDTH;
const _heightGrid = new Float32Array(_gridSize);
const _srGrid = new Float32Array(_gridSize);
const _shsGrid = new Float32Array(_gridSize);
const _diseasedGrid = new Uint8Array(_gridSize);
const _archetypeMask = new Uint8Array(_gridSize);

function phaseCalculateLight(world: World): void {
  const W = world.width;
  const H = world.height;

  // Build flat grids from live plants (dead/absent → 0)
  // With multi-plant cells, use tallest plant's height and woodiness for shadow params
  _heightGrid.fill(0);
  _srGrid.fill(0);
  _shsGrid.fill(0);
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const idx = plant.y * W + plant.x;
    if (plant.height > _heightGrid[idx]) {
      _heightGrid[idx] = plant.height;
      const w = Math.max(0, Math.min(1, plant.genome.woodiness));
      _srGrid[idx] = 0.05 + 0.20 * w;
      _shsGrid[idx] = 1.0 + 2.0 * w;
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const myIdx = y * W + x;
      const myHeight = _heightGrid[myIdx];

      let shadeSum = 0;
      // Extended shade radius: tall plants shade up to 2 cells away
      for (let sdy = -2; sdy <= 2; sdy++) {
        const ny = y + sdy;
        if (ny < 0 || ny >= H) continue;
        for (let sdx = -2; sdx <= 2; sdx++) {
          if (sdx === 0 && sdy === 0) continue;
          const nx = x + sdx;
          if (nx < 0 || nx >= W) continue;
          const nIdx = ny * W + nx;
          const nHeight = _heightGrid[nIdx];
          if (nHeight <= myHeight) continue;
          const dist = Math.max(Math.abs(sdx), Math.abs(sdy));
          // Only tall plants cast shade at distance 2 (canopy reach)
          if (dist > 1 && nHeight < 3.0) continue;
          const diff = nHeight - myHeight;
          const nShadow = _srGrid[nIdx] / dist;
          shadeSum += nShadow * Math.min(1, diff / _shsGrid[nIdx]);
        }
      }

      const cell = world.grid[y][x];
      const rawBase = SIM.BASE_LIGHT + TERRAIN_PROPS[cell.terrainType].lightBonus;
      const zm = world.environment.zoneModifiers[cell.climateZone];
      const baseLight = rawBase * zm.lightMult;
      cell.lightLevel = Math.max(SIM.MIN_LIGHT, baseLight - shadeSum);
    }
  }
}

function absorbWater(plant: Plant, cell: Cell, world: World): number {
  const effectiveLeaf = Math.pow(plant.leafArea, SIM.LEAF_EFFICIENCY_EXPONENT);
  const capacity = plant.genome.waterStorage * SIM.WATER_STORAGE_CAPACITY;
  const waterNeeded = effectiveLeaf * SIM.TRANSPIRATION_PER_LEAF;

  // Surface absorption: full rootDepth, draws from cell water
  const waterCanAbsorb = plant.rootDepth * SIM.WATER_ABSORPTION_PER_ROOT;
  let waterAbsorbed = Math.min(waterNeeded, waterCanAbsorb, cell.waterLevel);
  cell.waterLevel -= waterAbsorbed;

  // Root competition: drain water from neighboring cells
  let remainingDemand = Math.min(waterNeeded, waterCanAbsorb) - waterAbsorbed;
  if (remainingDemand > 0.01) {
    const drainRate = plant.rootDepth / SIM.MAX_ROOT_DEPTH * SIM.ROOT_COMPETITION_RATE;
    for (const [dx, dy] of NEIGHBORS) {
      if (remainingDemand <= 0.01) break;
      const nx = plant.x + dx;
      const ny = plant.y + dy;
      if (!inBounds(nx, ny, world.width, world.height)) continue;
      const nc = world.grid[ny][nx];
      const drained = Math.min(remainingDemand, nc.waterLevel * drainRate);
      nc.waterLevel -= drained;
      waterAbsorbed += drained;
      remainingDemand -= drained;
    }
  }

  // Groundwater: roots below water table access saturated zone (all terrains)
  const waterTable = TERRAIN_PROPS[cell.terrainType].waterTable;

  if (plant.rootDepth > waterTable) {
    const saturatedDepth = plant.rootDepth - waterTable;
    const groundwaterAvail = saturatedDepth * SIM.GROUNDWATER_ABSORPTION_RATE;
    const deficit = waterNeeded - waterAbsorbed;
    if (deficit > 0.01) {
      waterAbsorbed += Math.min(deficit, groundwaterAvail);
    }
  }

  // DRAW: if transpiration not fully met, draw from stored water
  if (waterAbsorbed < waterNeeded && plant.storedWater > 0) {
    const deficit = waterNeeded - waterAbsorbed;
    const drawn = Math.min(deficit, plant.storedWater);
    plant.storedWater -= drawn;
    waterAbsorbed += drawn;
  }

  // FILL: if transpiration fully met, absorb extra cell water into tank
  if (waterAbsorbed >= waterNeeded) {
    const space = capacity - plant.storedWater;
    if (space > 0.01) {
      const fillRate = plant.rootDepth * SIM.WATER_STORAGE_FILL_RATE;
      const filled = Math.min(space, fillRate, cell.waterLevel);
      cell.waterLevel -= filled;
      plant.storedWater += filled;
    }
  }

  plant.lastWaterAbsorbed = waterAbsorbed;
  return waterNeeded > 0.01 ? waterAbsorbed / waterNeeded : 0;
}

function photosynthesize(plant: Plant, cell: Cell, waterFraction: number, isDiseased: boolean, pc: PlantConstants, cellEnv: CellEnvironment): number {
  const effectiveLeaf = Math.pow(plant.leafArea, SIM.LEAF_EFFICIENCY_EXPONENT);
  const heightLightBonus = plant.height / pc.maxHeight * pc.heightLightBonus;

  // Shade tolerance: short plants are adapted to capture diffuse understory light.
  // Scales inversely with actual height — groundcover & forbs benefit most, trees get nothing.
  // Suppressed in drought-stressed environments where open canopy makes shade adaptation irrelevant.
  const lightInput = plant.effectiveLight;
  const isShaded = lightInput < SIM.BASE_LIGHT * 0.8;
  const heightFactor = Math.max(0, 1 - plant.height / 5.0);
  const shadeStrength = Math.max(0.3, 1.0 - cellEnv.droughtStress * 0.8);
  const shadeTolerance = isShaded ? 1.0 + heightFactor * 0.5 * shadeStrength : 1.0;

  // Broad-leaf shade adaptation: large, thin leaves capture diffuse light efficiently.
  // Only applies in shade; benefits forbs (high leafSize) over grasses in understory.
  const leafEfficiency = isShaded ? 1.0 + plant.genome.leafSize * heightFactor * 1.5 * shadeStrength : 1.0;

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
  const windStunt = Math.max(0.1, 1 - cellEnv.windExposure * plant.genome.woodiness * 2.0);
  const capHeight = pc.maxHeight * windStunt;
  const leafWindStunt = Math.max(0.15, 1 - cellEnv.windExposure * plant.genome.leafSize * 1.5);
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
  const totalSeedBudget = seedBudget + unusedGrowth * 0.5;

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

function phaseUpdatePlants(world: World): void {
  // Build flat disease grid to avoid string-key lookups per plant
  const W = world.width;
  _diseasedGrid.fill(0);
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
      energyProduced *= 1.0 + archetypeCount * 0.25;
    }

    const maintenance = calculateMaintenance(plant, world, isDiseased, pc);

    plant.lastEnergyProduced = energyProduced;
    plant.lastMaintenanceCost = maintenance;

    // Update health EMA — smoothed energy ratio for visual health state
    // Track peak energy for long-term decline detection
    // Decay peak slowly so normal seed/growth spending doesn't trigger false stress
    plant.peakEnergy *= 0.99;
    plant.peakEnergy = Math.max(plant.peakEnergy, plant.energy);
    let healthTarget: number;
    if (maintenance > 0.01) {
      const prodRatio = Math.min(energyProduced / maintenance, 1.5);
      // Energy relative to historical peak — gives slow visible decline over 100+ ticks
      const peakRatio = plant.peakEnergy > 1.0
        ? Math.min(plant.energy / plant.peakEnergy, 1.0)
        : 1.0;
      healthTarget = Math.min(prodRatio, peakRatio);
    } else {
      healthTarget = establishing ? 0.5 : 1.0;
    }
    // Floor: low absolute energy forces visual decline regardless of ratios
    const energyFloor = Math.min(plant.energy / 0.6, 1.0);
    healthTarget = Math.min(healthTarget, energyFloor);
    // Floor: approaching maxAge forces visible senescence
    const maxAge = pc.maxAge;
    const ageOnset = 0.85;
    if (plant.age > maxAge * ageOnset) {
      const ageFrac = (plant.age - maxAge * ageOnset) / (maxAge * (1 - ageOnset));
      healthTarget = Math.min(healthTarget, 1 - ageFrac * ageFrac);
    }
    // Asymmetric smoothing: decline faster (0.25) than recovery (0.12)
    const alpha = healthTarget < plant.healthEMA ? 0.25 : 0.12;
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

function phaseDeath(world: World): void {
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const maxAge = getPlantConstants(plant.genome).maxAge;

    // Environmental stress mortality — poorly adapted plants die from environmental pressure
    if (plant.age > 10) { // skip seedlings
      const traitMod = plant.lastTraitModifier;
      const stressGap = SIM.STRESS_MORTALITY_THRESHOLD - traitMod;
      if (stressGap > 0 && Math.random() < stressGap * SIM.STRESS_MORTALITY_RATE) {
        plant.alive = false;
        world.deathEvents.push({
          id: plant.id,
          speciesId: plant.speciesId,
          cause: 'stress',
          age: plant.age,
          offspringCount: plant.offspringCount,
          generation: plant.generation,
        });
        continue;
      }
    }

    if (plant.energy <= SIM.STARVATION_THRESHOLD || plant.age >= maxAge) {
      plant.alive = false;

      // Use disease flag computed in phaseUpdatePlants
      let cause: 'starvation' | 'age' | 'disease' = plant.age >= maxAge ? 'age' : 'starvation';
      if (cause === 'starvation' && plant.isDiseased) {
        cause = 'disease';
        plant.causeOfDeath = 'disease';
        for (const disease of world.environment.diseases) {
          if (disease.cells.has(`${plant.x},${plant.y}`)) {
            disease.killCount++;
            break;
          }
        }
      }

      world.deathEvents.push({
        id: plant.id,
        speciesId: plant.speciesId,
        cause,
        age: plant.age,
        offspringCount: plant.offspringCount,
        generation: plant.generation,
      });
    }
  }
}

function phaseGermination(world: World): void {
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      if (cell.seeds.length === 0) continue;

      // Age and decay all seeds; remove dead ones
      for (let i = cell.seeds.length - 1; i >= 0; i--) {
        const seed = cell.seeds[i];
        seed.age++;
        seed.energy -= SIM.SEED_DECAY_RATE;
        const maxAge = seed.seedMaxAge;
        if (seed.energy <= 0 || seed.age >= maxAge) {
          // Decrement seed population tracking
          const count = world.seedPopulations.get(seed.speciesId) ?? 1;
          if (count <= 1) world.seedPopulations.delete(seed.speciesId);
          else world.seedPopulations.set(seed.speciesId, count - 1);
          cell.seeds[i] = cell.seeds[cell.seeds.length - 1];
          cell.seeds.pop();
        }
      }

      // Germinate if cell has space and has enough water
      if (!cellHasSpace(cell) || cell.seeds.length === 0) continue;

      // Weighted lottery — each qualifying seed's chance proportional to energy
      let totalEnergy = 0;
      const qualifying: number[] = [];
      for (let i = 0; i < cell.seeds.length; i++) {
        const seed = cell.seeds[i];
        // Succulent germination restrictions:
        // - Only on terrains marked succulentGermination (Hill, Arid)
        // - In wet climates (Temperate, Tropical), further restricted to Arid only
        if (archetype(seed.genome) === Archetype.Succulent) {
          if (!TERRAIN_PROPS[cell.terrainType].succulentGermination) continue;
          if ((cell.climateZone === ClimateZone.Temperate || cell.climateZone === ClimateZone.Tropical)
            && cell.terrainType !== TerrainType.Arid) continue;
        }
        // Shrub germination restrictions:
        // - Blocked on Hill terrain in Temperate/Tropical climates
        // - Woody shrub seedlings are killed by persistent cold/humid wind before establishment
        // - Allowed on Hill in Mediterranean/Desert (garrigue/scrubland conditions)
        if (archetype(seed.genome) === Archetype.Shrub) {
          if (!TERRAIN_PROPS[cell.terrainType].shrubGermination
            && (cell.climateZone === ClimateZone.Temperate || cell.climateZone === ClimateZone.Tropical)) {
            continue;
          }
        }
        // Tree germination restrictions:
        // - Hill: blocked in Temperate/Desert (cloud forest & Mediterranean cypress ok)
        // - Arid: blocked in Temperate/Desert/Mediterranean (only Tropical ok for Acacia)
        // - Exposed wind and extreme drought prevent tree establishment
        if (archetype(seed.genome) === Archetype.Tree) {
          if (!TERRAIN_PROPS[cell.terrainType].treeGermination) {
            if (cell.climateZone === ClimateZone.Temperate || cell.climateZone === ClimateZone.Desert) {
              continue;
            }
            if (cell.terrainType === TerrainType.Arid && cell.climateZone === ClimateZone.Mediterranean) {
              continue;
            }
          }
        }
        const waterThreshold = seed.seedGerminationWater;
        if (cell.waterLevel >= waterThreshold) {
          qualifying.push(i);
          totalEnergy += seed.energy;
        }
      }
      let bestIdx = -1;
      if (qualifying.length === 1) {
        bestIdx = qualifying[0];
      } else if (qualifying.length > 1) {
        let roll = Math.random() * totalEnergy;
        for (const idx of qualifying) {
          roll -= cell.seeds[idx].energy;
          if (roll <= 0) { bestIdx = idx; break; }
        }
        if (bestIdx < 0) bestIdx = qualifying[qualifying.length - 1];
      }

      if (bestIdx < 0) continue;
      const winner = cell.seeds[bestIdx];
      cell.seeds[bestIdx] = cell.seeds[cell.seeds.length - 1];
      cell.seeds.pop();

      // Decrement seed population tracking
      const count = world.seedPopulations.get(winner.speciesId) ?? 1;
      if (count <= 1) world.seedPopulations.delete(winner.speciesId);
      else world.seedPopulations.set(winner.speciesId, count - 1);

      // Create plant from seed — large seeds produce larger seedlings
      // On productive terrain, dampen vigor toward 1.0 (resources equalize seedling size)
      const wpc = getPlantConstants(winner.genome);
      const rawVigor = SIM.SEED_SIZE_VIGOR_MIN + winner.genome.seedSize * SIM.SEED_SIZE_VIGOR_RANGE;
      const dampen = TERRAIN_PROPS[cell.terrainType].vigorDampen;
      const seedSizeVigor = Math.max(0.1, rawVigor + (1.0 - rawVigor) * dampen);

      // Janzen-Connell effect: two levels of density-dependent establishment failure
      const childSubtype = classifySubtype(winner.genome);
      const childArch = archetype(winner.genome);
      let conspecificCount = 0;
      let archConspecific = 0;
      for (let jy = y - 2; jy <= y + 2; jy++) {
        for (let jx = x - 2; jx <= x + 2; jx++) {
          if (jx === x && jy === y) continue;
          if (!inBounds(jx, jy, world.width, world.height)) continue;
          const jc = world.grid[jy][jx];
          for (const jid of cellPlantIds(jc)) {
            const jn = world.plants.get(jid);
            if (jn && jn.alive) {
              if (classifySubtype(jn.genome) === childSubtype) conspecificCount++;
              if (archetype(jn.genome) === childArch) archConspecific++;
            }
          }
        }
      }
      // Subtype JC: strong penalty near same-subtype adults
      if (conspecificCount > 0 && Math.random() > 1.0 / (1.0 + conspecificCount * 3.0)) {
        cell.seeds.push(winner);
        world.seedPopulations.set(winner.speciesId,
          (world.seedPopulations.get(winner.speciesId) ?? 0) + 1);
        continue;
      }
      // Archetype JC: weaker penalty near same-archetype adults (prevents monoculture biomes)
      if (archConspecific > 2 && Math.random() > 1.0 / (1.0 + (archConspecific - 2) * 1.0)) {
        cell.seeds.push(winner);
        world.seedPopulations.set(winner.speciesId,
          (world.seedPopulations.get(winner.speciesId) ?? 0) + 1);
        continue;
      }

      // Speciation check: subtype-based
      let finalSpeciesId = winner.speciesId;
      const parentSubtype = world.speciesSubtypes.get(winner.speciesId);
      if (childSubtype !== parentSubtype) {
        const existingSpeciesForSubtype = world.subtypeSpecies.get(childSubtype);
        if (existingSpeciesForSubtype !== undefined) {
          // Join existing species for this subtype
          finalSpeciesId = existingSpeciesForSubtype;
        } else {
          // Create new species for this subtype
          finalSpeciesId = world.nextSpeciesId++;
          world.speciesColors.set(finalSpeciesId, generateSpeciesColor(finalSpeciesId));
          const newName = generateSpeciesName(winner.genome, finalSpeciesId, childSubtype);
          world.speciesNames.set(finalSpeciesId, newName);
          world.speciesSubtypes.set(finalSpeciesId, childSubtype);
          world.subtypeSpecies.set(childSubtype, finalSpeciesId);
          world.speciationEvents.push({
            newSpeciesId: finalSpeciesId,
            parentSpeciesId: winner.speciesId,
            newSpeciesName: newName,
          });
        }
      }

      const childId = world.nextPlantId++;
      const child: Plant = {
        id: childId, speciesId: finalSpeciesId, lineageRoot: winner.lineageRoot,
        x, y,
        height: wpc.seedlingHeight * seedSizeVigor, rootDepth: wpc.seedlingRoot * seedSizeVigor, leafArea: wpc.seedlingLeaf * seedSizeVigor,
        energy: winner.energy, age: 0, alive: true,
        genome: winner.genome,
        lastLightReceived: 0, lastWaterAbsorbed: 0,
        lastEnergyProduced: 0, lastMaintenanceCost: 0, isDiseased: false,
        storedWater: seedSizeVigor * winner.genome.waterStorage * SIM.WATER_STORAGE_SEEDLING_PROVISION,
        healthEMA: 1.0, peakEnergy: 2.0,
        generation: winner.generation, parentId: null, offspringCount: 0, effectiveLight: 0, lastTraitModifier: 0,
      };
      world.plants.set(childId, child);
      setCellPlant(cell, Tier.Ground, childId);
      cell.lastSpeciesId = finalSpeciesId;

      world.germinationEvents.push({
        x, y,
        plantId: childId,
        speciesId: finalSpeciesId,
        woodiness: winner.genome.woodiness,
      });
    }
  }
}

function phaseDecomposition(world: World): void {
  const toRemove: number[] = [];
  for (const plant of world.plants.values()) {
    if (plant.alive) continue;
    const dpc = getPlantConstants(plant.genome);
    const dWater = dpc.decompWaterBoost;
    const dNutrient = dpc.decompNutrientBoost;
    const dNutrientH = dpc.decompNutrientPerHeight;
    const cell = world.grid[plant.y][plant.x];
    cell.waterLevel = Math.min(SIM.MAX_WATER, cell.waterLevel + dWater);
    cell.nutrients = Math.min(SIM.MAX_NUTRIENTS,
      cell.nutrients + dNutrient + plant.height * dNutrientH);
    cell.nutrients = Math.min(TERRAIN_PROPS[cell.terrainType].nutrientMax, cell.nutrients);
    clearCellPlant(cell, plant.id);
    toRemove.push(plant.id);
  }
  for (const id of toRemove) {
    world.plants.delete(id);
  }
}

/** Clear renderer event arrays. Call once per frame before the tick batch. */
export function clearFrameEvents(world: World): void {
  world.seedLandingEvents.length = 0;
  world.germinationEvents.length = 0;
  world.fireDeathEvents.length = 0;
  world.heightChangedIds.clear();
}

export function tickWorld(world: World, hooks?: TimingHooks): void {
  // Per-tick arrays consumed by history/diagnostics — must clear each tick
  world.deathEvents.length = 0;
  world.seedsAttempted = 0;
  world.environmentEvents.length = 0;
  world.speciationEvents.length = 0;
  hooks?.begin('environment');  phaseEnvironment(world);       hooks?.end('environment');
  hooks?.begin('rechargeWater'); phaseRechargeWater(world);    hooks?.end('rechargeWater');
  hooks?.begin('calculateLight'); phaseCalculateLight(world);  hooks?.end('calculateLight');
  hooks?.begin('tierAssignment'); phaseTierAssignment(world);  hooks?.end('tierAssignment');
  hooks?.begin('tierLight');    phaseTierLight(world);         hooks?.end('tierLight');
  hooks?.begin('updatePlants'); phaseUpdatePlants(world);      hooks?.end('updatePlants');
  hooks?.begin('herbivores');   phaseHerbivores(world);        hooks?.end('herbivores');
  hooks?.begin('death');        phaseDeath(world);             hooks?.end('death');
  hooks?.begin('decomposition'); phaseDecomposition(world);    hooks?.end('decomposition');
  hooks?.begin('germination');  phaseGermination(world);       hooks?.end('germination');
  world.tick++;
}
