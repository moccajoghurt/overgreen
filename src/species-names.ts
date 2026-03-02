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
  // allelopathy
  ['Toxic', 'Bitter', 'Acrid', 'Caustic', 'Noxious', 'Pungent'],
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
  // allelopathy
  ['Wards', 'Banes', 'Blighters', 'Hazards', 'Taints', 'Plagues'],
  // defense
  ['Thorns', 'Shields', 'Bristles', 'Spines', 'Armors', 'Barbs'],
];

export function generateSpeciesName(genome: Genome, speciesId: number): string {
  const traits = [
    genome.rootPriority,
    genome.heightPriority,
    genome.leafSize,
    genome.seedInvestment,
    genome.allelopathy,
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

  const adjPool = ADJECTIVES[first];
  const nounPool = NOUNS[second];
  const adj = adjPool[speciesId % adjPool.length];
  const noun = nounPool[Math.floor(speciesId / adjPool.length) % nounPool.length];

  return `${adj} ${noun}`;
}
