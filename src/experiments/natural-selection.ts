import type { Experiment } from '../types/experiment';
import { TerrainType, ClimateZone } from '../types';
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
      body: `This experiment explores <strong>natural selection</strong>. You'll watch identical plants adapt to two different environments: a <em>wet marshland</em> on the left and a <em>dry desert</em> on the right.<br><br>The same species starts on both sides. Will they stay the same?`,
      autoPause: true,
      colorMode: 'natural',
    },
    {
      id: 'starting-point',
      title: 'The Starting Point',
      body: `Both populations are genetically identical right now &mdash; same roots, same leaves, same water storage. They all look the same because they <em>are</em> the same.<br><br>Click <strong>Continue</strong> when you're ready to let evolution begin.`,
      autoPause: true,
      colorMode: 'natural',
    },
    {
      id: 'growth',
      title: 'Populations Growing',
      body: `The plants are reproducing. Each generation introduces <em>small random mutations</em> &mdash; tiny changes to root depth, leaf size, water storage, and other traits. Most mutations are neutral, but some will matter. Watch how the plants start looking different on each side.`,
      colorMode: 'natural',
      waitForContinue: false,
      trigger: (world) => world.plants.size >= 100,
    },
    {
      id: 'divergence',
      title: 'Traits Diverging',
      body: `Enough generations have passed for mutations to accumulate. The heatmap now shows <em>water storage</em> &mdash; a trait that helps plants survive drought. Look at the difference between the left (wet) and right (dry) halves.<br><br>In nature, succulents store water in specialized tissue. Here, it's modeled as an internal water tank that fills slowly but buffers against drought.`,
      autoPause: true,
      colorMode: 'trait',
      traitColorTrait: 'waterStorage',
      trigger: (world) => world.tick >= 200,
    },
    {
      id: 'speciation',
      title: 'New Species Emerging',
      body: `As traits diverge, the simulator recognizes <strong>new species</strong>. The desert side may be evolving higher water storage, deeper roots, or smaller leaves &mdash; whatever helps survive drought. The wetland side faces different pressures.<br><br>This is <em>adaptive radiation</em>: one ancestor diversifying into forms suited to different environments.`,
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
      trigger: (world) => world.tick >= 500 && world.environment.season === Season.Summer,
    },
    {
      id: 'conclusion',
      title: 'What Happened',
      body: `The two populations started <em>identical</em> but evolved different traits. That's natural selection: <strong>random mutations</strong> plus <strong>environmental pressure</strong> equals <strong>adaptation</strong>.<br><br>The environment didn't change the plants directly &mdash; it selected which random variations survived to reproduce.`,
      autoPause: true,
      colorMode: 'natural',
    },
  ],

  wrapUp: {
    title: 'Experiment Complete',
    body: `You've observed natural selection in action. The key insight: populations adapt through <em>differential survival of random variations</em>, not through directed change.<br><br>You can keep watching this world evolve, load a different map, or close this panel to explore freely.`,
  },
};
