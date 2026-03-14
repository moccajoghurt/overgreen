import type { Experiment } from '../types/experiment';
import { TerrainType, ClimateZone } from '../types';
import type { Genome, World } from '../types/core';
import { Season } from '../types/environment';
import type { ScenarioCell } from '../types/scenario';

/**
 * Natural Selection 101
 *
 * A split map: Wetland (left) vs Arid (right) with a thin Soil bridge.
 * One identical generalist species seeded on both sides.
 * Students observe trait divergence driven by environmental pressure.
 */

function buildCells(): ScenarioCell[] {
  const size = 80;
  const cells: ScenarioCell[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x < 33) {
        // Left: Wetland, temperate
        cells.push({ x, y, terrain: TerrainType.Wetland, elevation: 0.3, climateZone: ClimateZone.Temperate });
      } else if (x > 46) {
        // Right: Arid, desert
        cells.push({ x, y, terrain: TerrainType.Arid, elevation: 0.5, climateZone: ClimateZone.Desert });
      } else {
        // Middle bridge: Soil, temperate
        cells.push({ x, y, terrain: TerrainType.Soil, elevation: 0.4, climateZone: ClimateZone.Temperate });
      }
    }
  }

  return cells;
}

function buildPlacements(side: 'left' | 'right'): { x: number; y: number }[] {
  // Scatter 8 plants in a loose grid on the given side
  const cx = side === 'left' ? 16 : 63;
  const placements: { x: number; y: number }[] = [];
  for (let dy = -2; dy <= 2; dy += 2) {
    for (let dx = -2; dx <= 1; dx += 2) {
      placements.push({ x: cx + dx, y: 40 + dy });
    }
  }
  return placements;
}

// ── Dynamic trait divergence detection ──

const TRAIT_NAMES: Record<keyof Genome, string> = {
  rootPriority: 'root depth',
  heightPriority: 'height priority',
  leafSize: 'leaf size',
  seedInvestment: 'seed investment',
  seedSize: 'seed size',
  defense: 'defense',
  woodiness: 'woodiness',
  waterStorage: 'water storage',
  longevity: 'longevity',
};

function findMostDivergedTrait(world: World): { trait: keyof Genome; name: string } {
  const leftSums: Record<string, number> = {};
  const rightSums: Record<string, number> = {};
  let leftCount = 0;
  let rightCount = 0;

  const traits = Object.keys(TRAIT_NAMES) as (keyof Genome)[];
  for (const t of traits) { leftSums[t] = 0; rightSums[t] = 0; }

  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    if (plant.x < 33) {
      leftCount++;
      for (const t of traits) leftSums[t] += plant.genome[t];
    } else if (plant.x > 46) {
      rightCount++;
      for (const t of traits) rightSums[t] += plant.genome[t];
    }
  }

  if (leftCount === 0 || rightCount === 0) {
    return { trait: 'waterStorage', name: 'water storage' };
  }

  let bestTrait: keyof Genome = 'waterStorage';
  let bestDiff = 0;
  for (const t of traits) {
    const diff = Math.abs(leftSums[t] / leftCount - rightSums[t] / rightCount);
    if (diff > bestDiff) {
      bestDiff = diff;
      bestTrait = t;
    }
  }

  return { trait: bestTrait, name: TRAIT_NAMES[bestTrait] };
}

export const naturalSelection101: Experiment = {
  id: 'natural-selection-101',
  name: 'Natural Selection 101',
  description: 'Watch identical plants adapt to wet vs. dry environments',

  scenario: {
    id: 'exp-natural-selection',
    name: 'Natural Selection 101',
    description: 'Wetland vs Arid split map with one generalist species',
    size: 80,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.4,
    defaultZone: ClimateZone.Temperate,
    cells: buildCells(),
    species: [
      {
        id: 1,
        name: 'Pioneer',
        genome: {
          rootPriority: 0.40,
          heightPriority: 0.35,
          leafSize: 0.80,
          seedInvestment: 0.35,
          seedSize: 0.45,
          defense: 0.35,
          woodiness: 0.15,
          waterStorage: 0.20,
          longevity: 0.50,
        },
        color: { r: 0.4, g: 0.7, b: 0.3 },
        placements: [...buildPlacements('left'), ...buildPlacements('right')],
      },
    ],
  },

  steps: [
    {
      id: 'welcome',
      title: 'Natural Selection',
      body: `<strong>Learning objectives:</strong> variation, heritability, differential fitness, adaptive divergence<br><br>This experiment explores <strong>natural selection</strong>. You'll watch identical plants adapt to two different environments: a <em>wet marshland</em> on the left and a <em>dry desert</em> on the right.<br><br>The same species starts on both sides. Will they stay the same?`,
      autoPause: true,
      colorMode: 'natural',
    },
    {
      id: 'starting-point',
      title: 'The Starting Point',
      body: `Both populations are genetically identical right now &mdash; same roots, same leaves, same water storage. They all look the same because they <em>are</em> the same.<br><br><strong>Make a prediction:</strong> Will the desert plants evolve different traits than the wetland plants? If so, which traits do you think will change most &mdash; root depth, leaf size, water storage, or something else?<br><br>Click <strong>Continue</strong> when you're ready to let evolution begin.`,
      autoPause: true,
      colorMode: 'natural',
    },
    {
      id: 'growth',
      title: 'Populations Growing',
      body: `The plants are reproducing. Each generation introduces <em>small random mutations</em> &mdash; tiny changes to root depth, leaf size, water storage, and other traits. Most mutations are neutral, but some will matter. Watch how the plants start looking different on each side.`,
      colorMode: 'natural',
      waitForContinue: false,
      waitingHint: 'Waiting for 100 plants...',
      trigger: (world) => world.plants.size >= 100,
    },
    {
      id: 'divergence',
      title: 'Traits Diverging',
      body: '', // set dynamically in trigger
      autoPause: true,
      colorMode: 'trait',
      traitColorTrait: 'waterStorage', // updated in trigger
      waitingHint: 'Evolving to generation 200...',
      trigger: (world) => {
        if (world.tick < 200) return false;
        const result = findMostDivergedTrait(world);
        // Mutate step before activation reads it
        const step = naturalSelection101.steps.find(s => s.id === 'divergence')!;
        step.traitColorTrait = result.trait;
        step.body = `Enough generations have passed for mutations to accumulate. The heatmap now shows <em>${result.name}</em> &mdash; the trait that diverged most between the two halves. Look at the difference between the left (wet) and right (dry) sides.<br><br>The environment didn't direct these changes &mdash; it selected which random mutations survived. Different pressures, different winners.`;
        return true;
      },
    },
    {
      id: 'speciation',
      title: 'New Species Emerging',
      body: `As traits diverge, the simulator recognizes <strong>new species</strong>. The desert side may be evolving higher water storage, deeper roots, or smaller leaves &mdash; whatever helps survive drought. The wetland side faces different pressures.<br><br>This is <em>adaptive divergence</em>: one ancestor's descendants diverging into forms suited to different environments.`,
      autoPause: true,
      colorMode: 'natural',
      trigger: (world) => world.species.size >= 4,
    },
    {
      id: 'adaptation',
      title: 'Adaptation in Action',
      body: `Compare the two halves. The plants should look and behave differently now. Try <strong>hovering over a plant on each side</strong> to inspect their genomes &mdash; compare their root depth, leaf size, and water storage values.`,
      autoPause: true,
      colorMode: 'natural',
      waitingHint: 'Running to summer at generation 500...',
      trigger: (world) => world.tick >= 500 && world.environment.season === Season.Summer,
    },
    {
      id: 'conclusion',
      title: 'What Happened',
      body: `The two populations started <em>identical</em> but evolved different traits. That's natural selection: <strong>random mutations</strong> plus <strong>environmental pressure</strong> equals <strong>adaptation</strong>.<br><br>The environment didn't change the plants directly &mdash; it selected which random variations survived to reproduce.<br><br>These results are <em>genuine emergence</em> &mdash; no scripted outcomes. Run the experiment again and you'll see different species, different traits, different evolutionary paths.`,
      autoPause: true,
      colorMode: 'natural',
    },
  ],

  wrapUp: {
    title: 'Experiment Complete',
    body: `You've observed natural selection in action. The key insight: populations adapt through <em>differential survival of random variations</em>, not through directed change.<br><br><strong>Discussion questions:</strong><br>&bull; Why did the desert plants evolve differently from the wetland plants, even though they started identical?<br>&bull; If you ran this experiment again, would you expect the exact same traits to evolve? Why or why not?<br>&bull; The bridge zone between wet and dry has its own selection pressures &mdash; what traits might evolve there?<br>&bull; How does this simulation differ from real natural selection? What biological factors are missing or simplified?<br><br>You can keep watching this world evolve, load a different map, or close this panel to explore freely.`,
  },
};
