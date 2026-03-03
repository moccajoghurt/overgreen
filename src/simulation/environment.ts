import {
  SIM, TerrainType, World, Plant,
  Season, SEASON_LENGTH, YEAR_LENGTH, SEASON_NAMES,
  Environment, DiseaseEvent, WeatherOverlay,
} from '../types';
import { NEIGHBORS, parseKey, inBounds, randomIntRange, decayMap } from './neighbors';
import { genomeDistance } from './plants';
import { advanceEra, getEffectiveEraMultipliers } from './eras';

// Season target values: [water, light, leafMaint, growth, seed, leafDecay]
const SEASON_TARGETS: Record<Season, [number, number, number, number, number, number]> = {
  [Season.Spring]: [1.2, 1.0, 1.0, 1.3, 1.0, 0.0],
  [Season.Summer]: [0.8, 1.15, 1.0, 1.0, 1.0, 0.0],
  [Season.Autumn]: [1.0, 0.85, 1.0, 0.5, 0.3, 0.01],
  [Season.Winter]: [0.6, 0.5, 3.0, 0.0, 0.0, 0.03],
};

function computeSeasonModifiers(env: Environment): void {
  const cur = SEASON_TARGETS[env.season];
  const next = SEASON_TARGETS[((env.season + 1) % 4) as Season];
  // Cosine interpolation for smooth transitions
  const t = (1 - Math.cos(env.seasonProgress * Math.PI)) / 2;

  const eraMults = getEffectiveEraMultipliers(env.era);

  env.waterMult = (cur[0] + (next[0] - cur[0]) * t) * eraMults.waterMult;
  env.lightMult = (cur[1] + (next[1] - cur[1]) * t) * eraMults.lightMult;
  env.leafMaintenanceMult = (cur[2] + (next[2] - cur[2]) * t) * eraMults.leafMaintMult;
  env.growthMult = (cur[3] + (next[3] - cur[3]) * t) * eraMults.growthMult;
  env.seedMult = cur[4] + (next[4] - cur[4]) * t;
  env.leafDecayRate = cur[5] + (next[5] - cur[5]) * t;
}

function spawnDrought(world: World): void {
  const centerX = Math.floor(Math.random() * world.width);
  const centerY = Math.floor(Math.random() * world.height);
  const radius = randomIntRange(8, 21); // 8-20
  const duration = randomIntRange(30, 71); // 30-70 ticks
  const intensity = 0.6 + Math.random() * 0.35; // 0.6-0.95
  world.environment.droughts.push({ centerX, centerY, radius, intensity, ticksRemaining: duration });
  world.environmentEvents.push({
    type: 'drought_start',
    message: `Drought struck near (${centerX}, ${centerY})`,
  });
}

function advanceDroughts(world: World): void {
  const droughts = world.environment.droughts;
  for (let i = droughts.length - 1; i >= 0; i--) {
    droughts[i].ticksRemaining--;
    if (droughts[i].ticksRemaining <= 0) {
      // Mark affected cells as parched
      const d = droughts[i];
      const r2 = d.radius * d.radius;
      const minY = Math.max(0, d.centerY - d.radius);
      const maxY = Math.min(world.height - 1, d.centerY + d.radius);
      const minX = Math.max(0, d.centerX - d.radius);
      const maxX = Math.min(world.width - 1, d.centerX + d.radius);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x - d.centerX;
          const dy = y - d.centerY;
          if (dx * dx + dy * dy < r2) {
            world.environment.parchedCells.set(`${x},${y}`, 60);
          }
        }
      }
      world.environmentEvents.push({
        type: 'drought_end',
        message: `Drought ended near (${d.centerX}, ${d.centerY})`,
      });
      droughts.splice(i, 1);
    }
  }
}

export function spawnFire(world: World): void {
  for (let attempt = 0; attempt < 20; attempt++) {
    const x = Math.floor(Math.random() * world.width);
    const y = Math.floor(Math.random() * world.height);
    const cell = world.grid[y][x];
    if (cell.plantId === null || cell.waterLevel > 2.0) continue;
    if (cell.terrainType === TerrainType.River) continue;

    const fire = { cells: new Map([[`${x},${y}`, 4]]), ticksRemaining: randomIntRange(8, 17) };
    world.environment.fires.push(fire);
    killPlantByFire(world, x, y);
    world.environmentEvents.push({ type: 'fire_start', message: `Fire ignited near (${x}, ${y})` });
    return;
  }
}

function killPlantByFire(world: World, x: number, y: number): void {
  const cell = world.grid[y][x];
  if (cell.plantId === null) return;
  const plant = world.plants.get(cell.plantId);
  if (plant && plant.alive) {
    world.fireDeathEvents.push({
      id: plant.id,
      x: plant.x, y: plant.y,
      height: plant.height, rootDepth: plant.rootDepth,
      leafArea: plant.leafArea, speciesId: plant.speciesId,
      genome: { ...plant.genome },
    });
    plant.alive = false;
    plant.causeOfDeath = 'fire';
    world.deathEvents.push({
      id: plant.id,
      speciesId: plant.speciesId,
      cause: 'fire',
      age: plant.age,
      offspringCount: plant.offspringCount,
      generation: plant.generation,
    });
    plant.energy = 0;
    cell.nutrients = Math.min(SIM.MAX_NUTRIENTS, cell.nutrients + 2.0);
    cell.waterLevel = Math.max(0, cell.waterLevel - 1.5);
  }
}

function advanceFires(world: World): void {
  const fires = world.environment.fires;
  for (let i = fires.length - 1; i >= 0; i--) {
    const fire = fires[i];
    fire.ticksRemaining--;

    // Decay existing burning cells and spread to neighbors
    const toScorch: string[] = [];
    for (const [key, remaining] of fire.cells) {
      if (remaining <= 1) {
        toScorch.push(key);
        fire.cells.delete(key);
        continue;
      }
      fire.cells.set(key, remaining - 1);

      // Spread from this cell
      if (fire.ticksRemaining > 0) {
        const [fx, fy] = parseKey(key);
        for (const [dx, dy] of NEIGHBORS) {
          const nx = fx + dx;
          const ny = fy + dy;
          if (!inBounds(nx, ny, world.width, world.height)) continue;
          const nKey = `${nx},${ny}`;
          if (fire.cells.has(nKey)) continue;

          const cell = world.grid[ny][nx];
          if (cell.terrainType === TerrainType.River) continue;
          if (cell.plantId === null) continue;
          const plant = world.plants.get(cell.plantId);
          if (!plant || !plant.alive) continue;

          const waterResist = cell.waterLevel / SIM.MAX_WATER;
          const leafFuel = plant.leafArea / SIM.MAX_LEAF_AREA;
          const spreadChance = 0.35 * (1 - waterResist * 0.7) * (0.4 + leafFuel * 0.6);
          if (Math.random() < spreadChance) {
            fire.cells.set(nKey, randomIntRange(3, 6)); // burn 3-5 ticks
            killPlantByFire(world, nx, ny);
          }
        }
      }
    }

    // Mark burned-out cells as scorched
    for (const key of toScorch) {
      world.environment.scorchedCells.set(key, 80);
    }

    if (fire.cells.size === 0) {
      world.environmentEvents.push({ type: 'fire_end', message: 'Fire extinguished' });
      fires.splice(i, 1);
    }
  }
}

function emitDisease(world: World, patient: Plant, originX: number, originY: number): void {
  const duration = randomIntRange(SIM.DISEASE_EVENT_DURATION_MIN, SIM.DISEASE_EVENT_DURATION_MAX);
  const cellDur = randomIntRange(SIM.DISEASE_CELL_DURATION_MIN, SIM.DISEASE_CELL_DURATION_MAX);
  const disease: DiseaseEvent = {
    targetGenome: { ...patient.genome },
    cells: new Map([[`${originX},${originY}`, cellDur]]),
    ticksRemaining: duration,
    originX,
    originY,
    patientZeroSpeciesId: patient.speciesId,
    killCount: 0,
  };
  world.environment.diseases.push(disease);
  world.environmentEvents.push({
    type: 'disease_start',
    message: `Blight outbreak near (${originX}, ${originY})`,
  });
}

export function spawnDisease(world: World, forceAt?: { x: number; y: number }): void {
  const R = SIM.DISEASE_SCAN_RADIUS;

  if (forceAt) {
    // Debug: force-spawn at specific location
    const cell = world.grid[forceAt.y][forceAt.x];
    let targetPlant = cell.plantId !== null ? world.plants.get(cell.plantId) : undefined;
    if (!targetPlant || !targetPlant.alive) {
      // Find any nearby alive plant
      for (const plant of world.plants.values()) {
        if (plant.alive) { targetPlant = plant; break; }
      }
    }
    if (!targetPlant) return;
    emitDisease(world, targetPlant, targetPlant.x, targetPlant.y);
    return;
  }

  // Sample up to 20 random occupied cells and find one with high uniformity
  let bestX = -1, bestY = -1, bestUniformity = 0;
  let bestPlantId = -1;

  for (let attempt = 0; attempt < 20; attempt++) {
    const x = Math.floor(Math.random() * world.width);
    const y = Math.floor(Math.random() * world.height);
    const cell = world.grid[y][x];
    if (cell.plantId === null) continue;
    const plant = world.plants.get(cell.plantId);
    if (!plant || !plant.alive) continue;

    // Scan radius for uniformity
    let similar = 0, total = 0;
    const minY = Math.max(0, y - R);
    const maxY = Math.min(world.height - 1, y + R);
    const minX = Math.max(0, x - R);
    const maxX = Math.min(world.width - 1, x + R);
    for (let sy = minY; sy <= maxY; sy++) {
      for (let sx = minX; sx <= maxX; sx++) {
        const sc = world.grid[sy][sx];
        if (sc.plantId === null) continue;
        const sp = world.plants.get(sc.plantId);
        if (!sp || !sp.alive) continue;
        total++;
        if (genomeDistance(plant.genome, sp.genome) < 0.20) {
          similar++;
        }
      }
    }

    if (total < 3) continue;
    const uniformity = similar / total;
    if (uniformity > bestUniformity) {
      bestUniformity = uniformity;
      bestX = x;
      bestY = y;
      bestPlantId = cell.plantId;
    }
  }

  if (bestUniformity < SIM.DISEASE_MIN_UNIFORMITY || bestPlantId < 0) return;

  const patient = world.plants.get(bestPlantId)!;
  emitDisease(world, patient, bestX, bestY);
}

function advanceDiseases(world: World): void {
  const diseases = world.environment.diseases;

  for (let i = diseases.length - 1; i >= 0; i--) {
    const disease = diseases[i];

    // Decay existing infected cells
    const toScar: string[] = [];
    for (const [key, remaining] of disease.cells) {
      if (remaining <= 1) {
        toScar.push(key);
        disease.cells.delete(key);
        continue;
      }
      disease.cells.set(key, remaining - 1);
    }

    // Mark expired cells as blight scars
    for (const key of toScar) {
      world.environment.diseasedCells.set(key, SIM.DISEASE_SCAR_DURATION);
    }

    // Spread to 8-neighbors while disease still active
    if (disease.ticksRemaining > 0) {
      const newCells: Array<[string, number]> = [];
      for (const [key] of disease.cells) {
        const [fx, fy] = parseKey(key);
        for (const [dx, dy] of NEIGHBORS) {
          const nx = fx + dx;
          const ny = fy + dy;
          if (!inBounds(nx, ny, world.width, world.height)) continue;
          const nKey = `${nx},${ny}`;
          if (disease.cells.has(nKey)) continue;

          const cell = world.grid[ny][nx];
          if (cell.plantId === null) continue;
          const plant = world.plants.get(cell.plantId);
          if (!plant || !plant.alive) continue;

          const dist = genomeDistance(disease.targetGenome, plant.genome);
          if (dist >= SIM.DISEASE_DISTANCE_THRESHOLD) continue;

          const susceptibility = Math.max(0, 1 - dist / SIM.DISEASE_DISTANCE_THRESHOLD);
          const spreadChance = SIM.DISEASE_SPREAD_BASE * susceptibility * susceptibility;
          if (Math.random() < spreadChance) {
            const cellDur = SIM.DISEASE_CELL_DURATION_MIN +
              Math.floor(Math.random() * (SIM.DISEASE_CELL_DURATION_MAX - SIM.DISEASE_CELL_DURATION_MIN));
            newCells.push([nKey, cellDur]);
          }
        }
      }
      for (const [key, dur] of newCells) {
        if (!disease.cells.has(key)) {
          disease.cells.set(key, dur);
        }
      }
    }

    disease.ticksRemaining--;

    // Remove disease when expired and no cells remain
    if (disease.ticksRemaining <= 0 && disease.cells.size === 0) {
      const spName = world.speciesNames.get(disease.patientZeroSpeciesId) ?? `Sp ${disease.patientZeroSpeciesId}`;
      world.environmentEvents.push({
        type: 'disease_end',
        message: `Blight ended near (${disease.originX}, ${disease.originY}) — ${disease.killCount} ${spName} killed`,
      });
      diseases.splice(i, 1);
    }
  }
}

function rebuildWeatherOverlay(world: World): void {
  const overlay = world.environment.weatherOverlay;
  overlay.fill(WeatherOverlay.None);
  for (const d of world.environment.droughts) {
    const r2 = d.radius * d.radius;
    const minY = Math.max(0, d.centerY - d.radius);
    const maxY = Math.min(world.height - 1, d.centerY + d.radius);
    const minX = Math.max(0, d.centerX - d.radius);
    const maxX = Math.min(world.width - 1, d.centerX + d.radius);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - d.centerX;
        const dy = y - d.centerY;
        if (dx * dx + dy * dy < r2) {
          overlay[y * world.width + x] = WeatherOverlay.Drought;
        }
      }
    }
  }
  for (const fire of world.environment.fires) {
    for (const [key] of fire.cells) {
      const [fx, fy] = parseKey(key);
      overlay[fy * world.width + fx] = WeatherOverlay.Burning;
    }
  }
  // Scorched ground (only if not already burning or drought)
  for (const [key] of world.environment.scorchedCells) {
    const [sx, sy] = parseKey(key);
    const idx = sy * world.width + sx;
    if (overlay[idx] === WeatherOverlay.None) overlay[idx] = WeatherOverlay.Scorched;
  }
  // Parched ground (only if not already occupied)
  for (const [key] of world.environment.parchedCells) {
    const [px, py] = parseKey(key);
    const idx = py * world.width + px;
    if (overlay[idx] === WeatherOverlay.None) overlay[idx] = WeatherOverlay.Parched;
  }
  // Actively diseased cells
  for (const disease of world.environment.diseases) {
    for (const [key] of disease.cells) {
      const [dx, dy] = parseKey(key);
      const idx = dy * world.width + dx;
      if (overlay[idx] === WeatherOverlay.None) overlay[idx] = WeatherOverlay.Diseased;
    }
  }
  // Blight scar (only if not already occupied)
  for (const [key] of world.environment.diseasedCells) {
    const [bx, by] = parseKey(key);
    const idx = by * world.width + bx;
    if (overlay[idx] === WeatherOverlay.None) overlay[idx] = WeatherOverlay.Blighted;
  }
}

export function phaseEnvironment(world: World): void {
  const env = world.environment;

  // Advance climate era (before seasonal modifiers so era mults apply this tick)
  advanceEra(world);

  const tickInYear = world.tick % YEAR_LENGTH;
  const newSeason = Math.floor(tickInYear / SEASON_LENGTH) as Season;

  if (newSeason !== env.season) {
    env.season = newSeason;
    if (tickInYear === 0 && world.tick > 0) env.yearCount++;
    world.environmentEvents.push({
      type: 'season_change',
      message: `${SEASON_NAMES[newSeason]} has arrived (Year ${env.yearCount + 1})`,
    });
  }
  env.seasonProgress = (tickInYear % SEASON_LENGTH) / SEASON_LENGTH;
  computeSeasonModifiers(env);

  const eraMults = getEffectiveEraMultipliers(env.era);

  // Drought spawning (summer only, scaled by era)
  if (env.season === Season.Summer && Math.random() < 0.008 * eraMults.droughtMult) {
    spawnDrought(world);
  }

  // Fire spawning (summer, after 30% progress, scaled by era)
  if (env.season === Season.Summer && env.seasonProgress > 0.3 && Math.random() < 0.005 * eraMults.fireMult) {
    spawnFire(world);
  }

  // Disease spawning (not in winter, after min tick, max from era, scaled by era)
  if (env.season !== Season.Winter && world.tick >= SIM.DISEASE_SPAWN_MIN_TICK
      && env.diseases.length < eraMults.maxDiseases && Math.random() < SIM.DISEASE_SPAWN_CHANCE * eraMults.diseaseMult) {
    spawnDisease(world);
  }

  advanceDroughts(world);
  advanceFires(world);
  advanceDiseases(world);

  // Decay scorched, parched, and blight scar cells
  decayMap(world.environment.scorchedCells);
  decayMap(world.environment.parchedCells);
  decayMap(world.environment.diseasedCells);

  rebuildWeatherOverlay(world);
}
