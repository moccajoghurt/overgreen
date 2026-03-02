import {
  ClimateEra, EraDefinition, EraMultipliers, EraState, World,
} from '../types';

const TRANSITION_TICKS = 200;

export const ERA_NAMES: Record<ClimateEra, string> = {
  [ClimateEra.Temperate]: 'Temperate',
  [ClimateEra.Arid]: 'Arid',
  [ClimateEra.Lush]: 'Lush',
  [ClimateEra.IceAge]: 'Ice Age',
  [ClimateEra.Volatile]: 'Volatile',
  [ClimateEra.Fertile]: 'Fertile',
};

export const ERA_DEFINITIONS: Record<ClimateEra, EraDefinition> = {
  [ClimateEra.Temperate]: {
    multipliers: {
      waterMult: 1.0, lightMult: 1.0, leafMaintMult: 1.0, growthMult: 1.0,
      seedMult: 1.0, shadowMult: 1.0, nutrientDecayMult: 1.0, mutationMult: 1.3,
      seedEnergyMult: 1.0, droughtMult: 1.0, fireMult: 1.0, diseaseMult: 1.0, maxDiseases: 2,
    },
    durationMin: 2500, durationMax: 4000,
  },
  [ClimateEra.Arid]: {
    multipliers: {
      waterMult: 0.65, lightMult: 1.15, leafMaintMult: 1.0, growthMult: 1.0,
      seedMult: 1.0, shadowMult: 0.9, nutrientDecayMult: 1.5, mutationMult: 1.0,
      seedEnergyMult: 0.9, droughtMult: 2.5, fireMult: 2.0, diseaseMult: 0.5, maxDiseases: 2,
    },
    durationMin: 3000, durationMax: 5000,
  },
  [ClimateEra.Lush]: {
    multipliers: {
      waterMult: 1.4, lightMult: 0.9, leafMaintMult: 1.0, growthMult: 1.0,
      seedMult: 1.0, shadowMult: 1.5, nutrientDecayMult: 0.5, mutationMult: 1.0,
      seedEnergyMult: 1.0, droughtMult: 0.2, fireMult: 0.1, diseaseMult: 2.0, maxDiseases: 3,
    },
    durationMin: 3000, durationMax: 4500,
  },
  [ClimateEra.IceAge]: {
    multipliers: {
      waterMult: 0.85, lightMult: 0.7, leafMaintMult: 2.0, growthMult: 0.5,
      seedMult: 1.0, shadowMult: 0.7, nutrientDecayMult: 0.5, mutationMult: 0.7,
      seedEnergyMult: 0.7, droughtMult: 0.5, fireMult: 0.3, diseaseMult: 0.5, maxDiseases: 1,
    },
    durationMin: 3000, durationMax: 5000,
  },
  [ClimateEra.Volatile]: {
    multipliers: {
      waterMult: 1.0, lightMult: 1.0, leafMaintMult: 1.0, growthMult: 1.0,
      seedMult: 1.0, shadowMult: 1.0, nutrientDecayMult: 1.0, mutationMult: 1.5,
      seedEnergyMult: 1.0, droughtMult: 2.0, fireMult: 2.5, diseaseMult: 2.0, maxDiseases: 4,
    },
    durationMin: 2500, durationMax: 3500,
  },
  [ClimateEra.Fertile]: {
    multipliers: {
      waterMult: 1.3, lightMult: 1.1, leafMaintMult: 1.0, growthMult: 1.3,
      seedMult: 1.0, shadowMult: 1.2, nutrientDecayMult: 0.8, mutationMult: 1.0,
      seedEnergyMult: 1.3, droughtMult: 0.2, fireMult: 0.1, diseaseMult: 0.3, maxDiseases: 1,
    },
    durationMin: 2500, durationMax: 4000,
  },
};

const HARSH_ERAS = new Set([ClimateEra.Arid, ClimateEra.IceAge, ClimateEra.Volatile]);

export function initEraState(): EraState {
  const def = ERA_DEFINITIONS[ClimateEra.Temperate];
  return {
    current: ClimateEra.Temperate,
    previous: null,
    ticksInEra: 0,
    eraDuration: def.durationMin + Math.floor(Math.random() * (def.durationMax - def.durationMin)),
    transitioning: false,
    transitionTick: 0,
    prevMultipliers: null,
  };
}

export function selectNextEra(
  current: ClimateEra,
  population: number,
  dominantFraction: number,
): ClimateEra {
  // Base weights for each era
  const weights: Record<ClimateEra, number> = {
    [ClimateEra.Temperate]: 1.0,
    [ClimateEra.Arid]: 1.0,
    [ClimateEra.Lush]: 1.0,
    [ClimateEra.IceAge]: 1.0,
    [ClimateEra.Volatile]: 1.0,
    [ClimateEra.Fertile]: 1.0,
  };

  // No immediate repeats
  weights[current] = 0;

  // After harsh era, no other harsh era
  if (HARSH_ERAS.has(current)) {
    for (const h of HARSH_ERAS) {
      weights[h] = 0;
    }
  }

  // Population-responsive: low pop favors Fertile/Temperate
  if (population < 200) {
    weights[ClimateEra.Fertile] *= 2.0;
    weights[ClimateEra.Temperate] *= 1.5;
    weights[ClimateEra.Arid] *= 0.3;
    weights[ClimateEra.IceAge] *= 0.3;
    weights[ClimateEra.Volatile] *= 0.3;
  } else if (population > 800) {
    // High pop favors Volatile/Arid
    weights[ClimateEra.Volatile] *= 1.8;
    weights[ClimateEra.Arid] *= 1.5;
    weights[ClimateEra.Fertile] *= 0.5;
  }

  // Low diversity (monoculture) favors Lush (disease punishes it)
  if (dominantFraction > 0.5) {
    weights[ClimateEra.Lush] *= 2.0;
  }

  // Weighted random selection
  let totalWeight = 0;
  for (const w of Object.values(weights)) totalWeight += w;

  let roll = Math.random() * totalWeight;
  for (const [eraStr, w] of Object.entries(weights)) {
    roll -= w;
    if (roll <= 0) return Number(eraStr) as ClimateEra;
  }

  // Fallback
  return ClimateEra.Temperate;
}

function lerpMultipliers(a: EraMultipliers, b: EraMultipliers, t: number): EraMultipliers {
  return {
    waterMult: a.waterMult + (b.waterMult - a.waterMult) * t,
    lightMult: a.lightMult + (b.lightMult - a.lightMult) * t,
    leafMaintMult: a.leafMaintMult + (b.leafMaintMult - a.leafMaintMult) * t,
    growthMult: a.growthMult + (b.growthMult - a.growthMult) * t,
    seedMult: a.seedMult + (b.seedMult - a.seedMult) * t,
    shadowMult: a.shadowMult + (b.shadowMult - a.shadowMult) * t,
    nutrientDecayMult: a.nutrientDecayMult + (b.nutrientDecayMult - a.nutrientDecayMult) * t,
    mutationMult: a.mutationMult + (b.mutationMult - a.mutationMult) * t,
    seedEnergyMult: a.seedEnergyMult + (b.seedEnergyMult - a.seedEnergyMult) * t,
    droughtMult: a.droughtMult + (b.droughtMult - a.droughtMult) * t,
    fireMult: a.fireMult + (b.fireMult - a.fireMult) * t,
    diseaseMult: a.diseaseMult + (b.diseaseMult - a.diseaseMult) * t,
    maxDiseases: Math.round(a.maxDiseases + (b.maxDiseases - a.maxDiseases) * t),
  };
}

export function getEffectiveEraMultipliers(era: EraState): EraMultipliers {
  const currentMults = ERA_DEFINITIONS[era.current].multipliers;

  if (era.transitioning && era.prevMultipliers) {
    // Cosine interpolation: 0→1 over TRANSITION_TICKS
    const raw = era.transitionTick / TRANSITION_TICKS;
    const t = (1 - Math.cos(raw * Math.PI)) / 2;
    return lerpMultipliers(era.prevMultipliers, currentMults, t);
  }

  return currentMults;
}

export function advanceEra(world: World): void {
  const era = world.environment.era;
  era.ticksInEra++;

  // Handle transition blending
  if (era.transitioning) {
    era.transitionTick++;
    if (era.transitionTick >= TRANSITION_TICKS) {
      era.transitioning = false;
      era.transitionTick = 0;
      era.prevMultipliers = null;
    }
  }

  // Check if era should end
  if (era.ticksInEra >= era.eraDuration) {
    // Compute population stats for era selection
    let totalAlive = 0;
    let speciesCounts = new Map<number, number>();
    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;
      totalAlive++;
      speciesCounts.set(plant.speciesId, (speciesCounts.get(plant.speciesId) ?? 0) + 1);
    }

    let dominantFraction = 0;
    for (const count of speciesCounts.values()) {
      const frac = totalAlive > 0 ? count / totalAlive : 0;
      if (frac > dominantFraction) dominantFraction = frac;
    }

    const prevEra = era.current;
    const nextEra = selectNextEra(prevEra, totalAlive, dominantFraction);

    // Save current multipliers for blending
    era.prevMultipliers = getEffectiveEraMultipliers(era);
    era.previous = prevEra;
    era.current = nextEra;
    era.ticksInEra = 0;
    era.transitioning = true;
    era.transitionTick = 0;

    const def = ERA_DEFINITIONS[nextEra];
    era.eraDuration = def.durationMin + Math.floor(Math.random() * (def.durationMax - def.durationMin));

    world.environmentEvents.push({
      type: 'era_change',
      message: `The ${ERA_NAMES[nextEra]} era begins`,
    });
  }
}
