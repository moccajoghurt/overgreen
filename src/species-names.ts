import { Genome } from './types';

const ADJECTIVES: string[][] = [
  // rootPriority
  ['Deep', 'Anchored', 'Burrowing', 'Grounded', 'Rooted', 'Sunken'],
  // heightPriority
  ['Tall', 'Towering', 'Soaring', 'Lofty', 'Skyward', 'Risen'],
  // leafSize
  ['Broad', 'Lush', 'Verdant', 'Wide', 'Leafy', 'Shaded'],
  // seedInvestment
  ['Prolific', 'Spreading', 'Fertile', 'Drifting', 'Scattering', 'Restless'],
  // seedSize
  ['Heavy', 'Plump', 'Laden', 'Swollen', 'Fat', 'Stout'],
  // defense
  ['Thorny', 'Armored', 'Barbed', 'Spiny', 'Guarded', 'Bristled'],
];

const NOUNS: string[][] = [
  // rootPriority
  ['Roots', 'Miners', 'Diggers', 'Tappers', 'Borers', 'Delvers'],
  // heightPriority
  ['Spires', 'Towers', 'Pillars', 'Stalks', 'Columns', 'Risers'],
  // leafSize
  ['Canopy', 'Crowns', 'Fronds', 'Leaves', 'Boughs', 'Fans'],
  // seedInvestment
  ['Seeders', 'Drifters', 'Sowers', 'Casters', 'Wanderers', 'Floaters'],
  // seedSize
  ['Acorns', 'Pods', 'Nuts', 'Drupes', 'Pomes', 'Hulks'],
  // defense
  ['Thorns', 'Shields', 'Bristles', 'Spines', 'Armors', 'Barbs'],
];

const GRASS_ADJECTIVES: string[][] = [
  // rootPriority
  ['Creeping', 'Mat-forming', 'Dense', 'Spreading', 'Fibrous', 'Clumping'],
  // heightPriority
  ['Tall', 'Upright', 'Waving', 'Erect', 'Standing', 'Swaying'],
  // leafSize
  ['Broad', 'Lush', 'Thick', 'Verdant', 'Plush', 'Feathered'],
  // seedInvestment
  ['Feathery', 'Wispy', 'Plumed', 'Seeding', 'Windblown', 'Drifting'],
  // seedSize
  ['Heavy', 'Plump', 'Bulging', 'Laden', 'Round', 'Stout'],
  // defense
  ['Sharp', 'Cutting', 'Wiry', 'Stiff', 'Rigid', 'Bristling'],
];

const GRASS_NOUNS: string[][] = [
  // rootPriority
  ['Sod', 'Turf', 'Tussocks', 'Mats', 'Runners', 'Rhizomes'],
  // heightPriority
  ['Reeds', 'Blades', 'Stalks', 'Stems', 'Spears', 'Rushes'],
  // leafSize
  ['Meadows', 'Pastures', 'Fields', 'Lawns', 'Prairies', 'Sweeps'],
  // seedInvestment
  ['Grains', 'Seedheads', 'Plumes', 'Tassels', 'Chaff', 'Florets'],
  // seedSize
  ['Kernels', 'Berries', 'Pods', 'Capsules', 'Hulls', 'Bulbs'],
  // defense
  ['Razors', 'Sedges', 'Sawgrass', 'Needles', 'Barbs', 'Thistles'],
];

export function generateSpeciesName(genome: Genome, speciesId: number, woodiness?: number): string {
  const traits = [
    genome.rootPriority,
    genome.heightPriority,
    genome.leafSize,
    genome.seedInvestment,
    genome.seedSize,
    genome.defense,
  ];

  // Find dominant and second trait
  let first = 0, second = 1;
  if (traits[second] > traits[first]) { const t = first; first = second; second = t; }
  for (let i = 2; i < traits.length; i++) {
    if (traits[i] > traits[first]) {
      second = first;
      first = i;
    } else if (traits[i] > traits[second]) {
      second = i;
    }
  }

  const adjs = woodiness !== undefined && woodiness < 0.4 ? GRASS_ADJECTIVES : ADJECTIVES;
  const nouns = woodiness !== undefined && woodiness < 0.4 ? GRASS_NOUNS : NOUNS;
  const adjPool = adjs[first];
  const nounPool = nouns[second];
  const adj = adjPool[speciesId % adjPool.length];
  const noun = nounPool[Math.floor(speciesId / adjPool.length) % nounPool.length];

  return `${adj} ${noun}`;
}
