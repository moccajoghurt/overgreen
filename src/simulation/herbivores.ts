import {
  Herbivore, HerbivoreGenome, HERB, SIM, TerrainType, World, Season, WeatherOverlay,
} from '../types';
import { NEIGHBORS, inBounds } from './neighbors';

function clampGenome(val: number): number {
  return Math.max(0.01, Math.min(0.99, val));
}

export function randomHerbivoreGenome(): HerbivoreGenome {
  return {
    speed: 0.1 + Math.random() * 0.8,
    appetite: 0.1 + Math.random() * 0.8,
    herdInstinct: 0.1 + Math.random() * 0.8,
    reproduction: 0.1 + Math.random() * 0.8,
  };
}

function mutateHerbivoreGenome(parent: HerbivoreGenome): HerbivoreGenome {
  const m = (v: number) => clampGenome(v + (Math.random() * 2 - 1) * HERB.MUTATION_RATE);
  return {
    speed: m(parent.speed),
    appetite: m(parent.appetite),
    herdInstinct: m(parent.herdInstinct),
    reproduction: m(parent.reproduction),
  };
}

function createHerbivore(id: number, x: number, y: number, genome: HerbivoreGenome): Herbivore {
  return {
    id, x, y, prevX: x, prevY: y,
    energy: HERB.INITIAL_ENERGY,
    age: 0, alive: true, genome,
    facing: Math.random() * Math.PI * 2,
    lastEnergyGained: 0, lastMaintenanceCost: 0,
  };
}

export function seedInitialHerbivores(world: World, count: number): void {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 20) {
    attempts++;
    const x = Math.floor(Math.random() * world.width);
    const y = Math.floor(Math.random() * world.height);
    const cell = world.grid[y][x];
    if (cell.terrainType === TerrainType.River || cell.terrainType === TerrainType.Rock) continue;
    if (cell.plantId === null) continue; // prefer cells with plants

    const id = world.nextHerbivoreId++;
    const h = createHerbivore(id, x, y, randomHerbivoreGenome());
    world.herbivores.set(id, h);
    placed++;
  }

  // If we couldn't place enough on plant cells, fill remaining on any walkable cell
  if (placed < count) {
    attempts = 0;
    while (placed < count && attempts < count * 20) {
      attempts++;
      const x = Math.floor(Math.random() * world.width);
      const y = Math.floor(Math.random() * world.height);
      const cell = world.grid[y][x];
      if (cell.terrainType === TerrainType.River || cell.terrainType === TerrainType.Rock) continue;

      const id = world.nextHerbivoreId++;
      const h = createHerbivore(id, x, y, randomHerbivoreGenome());
      world.herbivores.set(id, h);
      placed++;
    }
  }
}

function isWalkable(world: World, x: number, y: number): boolean {
  if (!inBounds(x, y, world.width, world.height)) return false;
  const t = world.grid[y][x].terrainType;
  return t !== TerrainType.River && t !== TerrainType.Rock;
}

function moveHerbivore(h: Herbivore, world: World): void {
  // Move with probability = genome.speed
  if (Math.random() > h.genome.speed) return;

  let bestScore = -Infinity;
  let bestX = h.x;
  let bestY = h.y;
  let tiedCount = 0;

  for (const [dx, dy] of NEIGHBORS) {
    const nx = h.x + dx;
    const ny = h.y + dy;
    if (!isWalkable(world, nx, ny)) continue;

    let score = 0;

    // Food score: scan for plants in radius around this neighbor
    // Defense penalizes attractiveness (herbivores learn to avoid defended plants)
    for (let ry = -HERB.FOOD_SEARCH_RADIUS; ry <= HERB.FOOD_SEARCH_RADIUS; ry++) {
      for (let rx = -HERB.FOOD_SEARCH_RADIUS; rx <= HERB.FOOD_SEARCH_RADIUS; rx++) {
        const sx = nx + rx;
        const sy = ny + ry;
        if (!inBounds(sx, sy, world.width, world.height)) continue;
        const cell = world.grid[sy][sx];
        if (cell.plantId !== null) {
          const plant = world.plants.get(cell.plantId);
          if (plant && plant.alive) {
            const dist = Math.abs(rx) + Math.abs(ry);
            const defPenalty = 1 - plant.genome.defense * 0.5;
            score += (plant.leafArea * defPenalty) / (1 + dist);
          }
        }
      }
    }

    // Herd score: prefer cells near other herbivores
    for (const other of world.herbivores.values()) {
      if (other.id === h.id || !other.alive) continue;
      const dist = Math.abs(other.x - nx) + Math.abs(other.y - ny);
      if (dist <= 4) {
        score += h.genome.herdInstinct * (1 / (1 + dist));
      }
    }

    // Random jitter to prevent deterministic paths
    score += Math.random() * 0.3;

    if (score > bestScore) {
      bestScore = score;
      bestX = nx;
      bestY = ny;
      tiedCount = 1;
    } else if (Math.abs(score - bestScore) < 0.001) {
      tiedCount++;
      if (Math.random() < 1 / tiedCount) {
        bestX = nx;
        bestY = ny;
      }
    }
  }

  if (bestX !== h.x || bestY !== h.y) {
    h.prevX = h.x;
    h.prevY = h.y;
    h.x = bestX;
    h.y = bestY;
    h.facing = Math.atan2(bestY - h.prevY, bestX - h.prevX);
    h.energy -= HERB.MOVE_ENERGY_COST;
  }
}

function grazeHerbivore(h: Herbivore, world: World): void {
  const cell = world.grid[h.y][h.x];
  if (cell.plantId === null) {
    h.lastEnergyGained = 0;
    return;
  }
  const plant = world.plants.get(cell.plantId);
  if (!plant || !plant.alive) {
    h.lastEnergyGained = 0;
    return;
  }

  const rawGraze = HERB.BASE_GRAZE_AMOUNT * (0.5 + h.genome.appetite * 0.5);
  // Defense reduces effective grazing
  const grazeAmount = rawGraze * (1 - plant.genome.defense * SIM.DEFENSE_GRAZE_REDUCTION);
  const minLeaf = HERB.MIN_LEAF_AFTER_GRAZE * plant.genome.defense;
  const available = plant.leafArea - minLeaf;
  if (available <= 0) {
    h.lastEnergyGained = 0;
    return;
  }

  const consumed = Math.min(grazeAmount, available);
  plant.leafArea -= consumed;
  plant.energy -= HERB.TRAMPLE_DAMAGE * (1 - plant.genome.defense);
  const energyGained = consumed * HERB.ENERGY_PER_LEAF;
  h.energy = Math.min(HERB.MAX_ENERGY, h.energy + energyGained);
  h.lastEnergyGained = energyGained;

  // Thorns/toxins damage the herbivore
  h.energy -= plant.genome.defense * SIM.DEFENSE_HERBIVORE_DAMAGE;
}

function metabolizeHerbivore(h: Herbivore, world: World): void {
  let cost = HERB.MAINTENANCE_BASE + h.genome.speed * HERB.MAINTENANCE_PER_SPEED;
  if (world.environment.season === Season.Winter) {
    cost *= HERB.WINTER_MAINTENANCE_MULT;
  }
  h.energy -= cost;
  h.lastMaintenanceCost = cost;
}

function reproduceHerbivore(h: Herbivore, world: World): void {
  if (h.energy < HERB.REPRODUCE_THRESHOLD) return;
  if (h.age < HERB.MIN_REPRODUCE_AGE) return;
  if (world.herbivores.size >= HERB.MAX_POPULATION) return;

  // Find an adjacent walkable cell
  const shuffled = [...NEIGHBORS].sort(() => Math.random() - 0.5);
  for (const [dx, dy] of shuffled) {
    const nx = h.x + dx;
    const ny = h.y + dy;
    if (!isWalkable(world, nx, ny)) continue;

    const childId = world.nextHerbivoreId++;
    const childGenome = mutateHerbivoreGenome(h.genome);
    const child: Herbivore = {
      id: childId,
      x: nx, y: ny,
      prevX: h.x, prevY: h.y,
      energy: HERB.CHILD_ENERGY,
      age: 0, alive: true,
      genome: childGenome,
      facing: Math.random() * Math.PI * 2,
      lastEnergyGained: 0, lastMaintenanceCost: 0,
    };

    h.energy -= HERB.REPRODUCE_COST;
    world.herbivores.set(childId, child);
    world.herbivoreBirthEvents.push({
      parentId: h.id, childId, x: nx, y: ny,
    });
    return; // one child per tick
  }
}

function checkDeath(h: Herbivore, world: World): void {
  let cause: 'starvation' | 'age' | 'fire' | null = null;

  if (h.energy <= HERB.STARVATION_THRESHOLD) {
    cause = 'starvation';
  } else if (h.age >= HERB.MAX_AGE) {
    cause = 'age';
  } else {
    // Check if standing on burning cell
    const overlay = world.environment.weatherOverlay[h.y * world.width + h.x];
    if (overlay === WeatherOverlay.Burning) {
      cause = 'fire';
    }
  }

  if (cause) {
    h.alive = false;
    world.herbivoreDeathEvents.push({
      id: h.id, x: h.x, y: h.y, cause, age: h.age,
    });
  }
}

export function phaseHerbivores(world: World): void {
  // Clear event arrays
  world.herbivoreDeathEvents.length = 0;
  world.herbivoreBirthEvents.length = 0;

  // Spawn initial herd or respawn after extinction
  if (world.tick >= HERB.SPAWN_MIN_TICK && world.herbivores.size === 0) {
    if (world.tick === HERB.SPAWN_MIN_TICK) {
      seedInitialHerbivores(world, HERB.INITIAL_COUNT);
    } else if (world.tick % HERB.RESPAWN_INTERVAL === 0) {
      seedInitialHerbivores(world, HERB.RESPAWN_COUNT);
    }
  }

  // Process each alive herbivore
  for (const h of world.herbivores.values()) {
    if (!h.alive) continue;
    moveHerbivore(h, world);
    grazeHerbivore(h, world);
    metabolizeHerbivore(h, world);
    reproduceHerbivore(h, world);
    h.age++;
    checkDeath(h, world);
  }

  // Remove dead herbivores
  for (const [id, h] of world.herbivores) {
    if (!h.alive) {
      world.herbivores.delete(id);
    }
  }
}
