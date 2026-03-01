import { World, History, SimEvent } from './types';

const MAX_SNAPSHOTS = 2000;
const MAX_EVENTS = 100;
const MIN_TICKS_FOR_EXTINCTION = 5;
const MASS_EXTINCTION_THRESHOLD = 0.3; // 30% drop

const POP_MILESTONES = [50, 100, 150, 200, 300, 500];
const AGE_MILESTONES = [200, 300, 400, 450, 490];

export function createHistory(): History {
  return {
    snapshots: [],
    species: new Map(),
    events: [],
    prevPopulations: new Map(),
    prevDominant: null,
    firedAgeMilestones: new Set(),
    firedPopMilestones: new Set(),
  };
}

function spName(world: World, speciesId: number): string {
  return world.speciesNames.get(speciesId) ?? `Sp ${speciesId}`;
}

export function recordTick(history: History, world: World): void {
  // 1. Count populations + aggregate genome traits
  const populations = new Map<number, number>();
  let totalAlive = 0;
  let sumRoot = 0, sumHeight = 0, sumLeaf = 0, sumSeed = 0;
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    populations.set(plant.speciesId, (populations.get(plant.speciesId) ?? 0) + 1);
    totalAlive++;
    sumRoot += plant.genome.rootPriority;
    sumHeight += plant.genome.heightPriority;
    sumLeaf += plant.genome.leafSize;
    sumSeed += plant.genome.seedInvestment;
  }

  const traitAverages = totalAlive > 0
    ? { root: sumRoot / totalAlive, height: sumHeight / totalAlive, leaf: sumLeaf / totalAlive, seed: sumSeed / totalAlive }
    : { root: 0, height: 0, leaf: 0, seed: 0 };

  // 2. Store snapshot (ring buffer)
  history.snapshots.push({ tick: world.tick, populations: new Map(populations), traitAverages });
  if (history.snapshots.length > MAX_SNAPSHOTS) {
    history.snapshots.shift();
  }

  // 3. Update species records + detect population milestones
  for (const [speciesId, count] of populations) {
    let rec = history.species.get(speciesId);
    if (!rec) {
      rec = {
        speciesId,
        firstSeenTick: world.tick,
        lastSeenTick: world.tick,
        maxPopulation: count,
        maxPopulationTick: world.tick,
        extinct: false,
      };
      history.species.set(speciesId, rec);
    } else {
      rec.lastSeenTick = world.tick;
      rec.extinct = false;
    }

    if (count > rec.maxPopulation) {
      rec.maxPopulation = count;
      rec.maxPopulationTick = world.tick;
    }

    // Population milestones
    for (const milestone of POP_MILESTONES) {
      const key = `${speciesId}-${milestone}`;
      if (count >= milestone && !history.firedPopMilestones.has(key)) {
        history.firedPopMilestones.add(key);
        pushEvent(history, {
          tick: world.tick,
          type: 'population_record',
          message: `${spName(world, speciesId)} reached ${milestone} plants`,
          speciesId,
        });
      }
    }
  }

  // 4. Extinction detection
  for (const [speciesId, prevCount] of history.prevPopulations) {
    if (prevCount > 0 && !populations.has(speciesId)) {
      const rec = history.species.get(speciesId);
      if (rec && (world.tick - rec.firstSeenTick) >= MIN_TICKS_FOR_EXTINCTION) {
        rec.extinct = true;
        pushEvent(history, {
          tick: world.tick,
          type: 'extinction',
          message: `${spName(world, speciesId)} went extinct (lived ${world.tick - rec.firstSeenTick} ticks)`,
          speciesId,
        });
      }
    }
  }

  // 5. Mass extinction detection
  const prevTotal = sumValues(history.prevPopulations);
  const currTotal = sumValues(populations);
  if (prevTotal > 10 && currTotal < prevTotal * (1 - MASS_EXTINCTION_THRESHOLD)) {
    const drop = Math.round((1 - currTotal / prevTotal) * 100);
    pushEvent(history, {
      tick: world.tick,
      type: 'mass_extinction',
      message: `Mass die-off! Population dropped ${drop}%`,
    });
  }

  // 6. Dominance shift
  let dominant: number | null = null;
  let maxCount = 0;
  for (const [speciesId, count] of populations) {
    if (count > maxCount) {
      maxCount = count;
      dominant = speciesId;
    }
  }
  if (dominant !== null && dominant !== history.prevDominant && history.prevDominant !== null) {
    pushEvent(history, {
      tick: world.tick,
      type: 'dominance_shift',
      message: `${spName(world, dominant)} is now dominant (${maxCount} plants)`,
      speciesId: dominant,
    });
  }
  history.prevDominant = dominant;

  // 7. Notable age milestones (oldest plant globally only)
  let oldest: { age: number; plantId: number; speciesId: number } | null = null;
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    if (!oldest || plant.age > oldest.age) {
      oldest = { age: plant.age, plantId: plant.id, speciesId: plant.speciesId };
    }
  }
  if (oldest) {
    for (const milestone of AGE_MILESTONES) {
      const key = String(milestone);
      if (oldest.age >= milestone && !history.firedAgeMilestones.has(key)) {
        history.firedAgeMilestones.add(key);
        pushEvent(history, {
          tick: world.tick,
          type: 'notable_age',
          message: `Plant #${oldest.plantId} (${spName(world, oldest.speciesId)}) reached age ${milestone}`,
          speciesId: oldest.speciesId,
        });
      }
    }
  }

  // 8. Save for next tick
  history.prevPopulations = populations;
}

function pushEvent(history: History, event: SimEvent): void {
  history.events.push(event);
  if (history.events.length > MAX_EVENTS) {
    history.events.shift();
  }
}

function sumValues(map: Map<number, number>): number {
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}
