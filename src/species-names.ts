import { Genome, Archetype, archetype } from './types';
import { SUBTYPE_NAMES } from './types/subtypes';

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


const SHRUB_ADJECTIVES: string[][] = [
  // rootPriority
  ['Scrubby', 'Rugged', 'Hardy', 'Tenacious', 'Gnarled', 'Stunted'],
  // heightPriority
  ['Arching', 'Vaulted', 'Domed', 'Mounded', 'Reaching', 'Bowed'],
  // leafSize
  ['Bushy', 'Thicket', 'Tangled', 'Dense', 'Matted', 'Woven'],
  // seedInvestment
  ['Berried', 'Fruiting', 'Laden', 'Bountiful', 'Clustered', 'Generous'],
  // seedSize
  ['Plump', 'Swollen', 'Bulging', 'Heavy', 'Pendulous', 'Drooping'],
  // defense
  ['Thorny', 'Prickly', 'Brambly', 'Spiny', 'Barbed', 'Jagged'],
];


const SUCCULENT_ADJECTIVES: string[][] = [
  // rootPriority
  ['Anchored', 'Tuberous', 'Taprooted', 'Gripping', 'Buried', 'Tenacious'],
  // heightPriority
  ['Columnar', 'Towering', 'Pillar', 'Upright', 'Candelabra', 'Erect'],
  // leafSize
  ['Fleshy', 'Padded', 'Rosette', 'Swollen', 'Waxy', 'Plump'],
  // seedInvestment
  ['Budding', 'Prolific', 'Clustering', 'Offsetting', 'Spreading', 'Pupping'],
  // seedSize
  ['Heavy', 'Bulbous', 'Laden', 'Gorged', 'Round', 'Stout'],
  // defense
  ['Spiny', 'Thorny', 'Armored', 'Barbed', 'Bristling', 'Hooked'],
];


export function generateSpeciesName(genome: Genome, speciesId: number, subtypeId: number): string {
  const traits = [
    genome.rootPriority,
    genome.heightPriority,
    genome.leafSize,
    genome.seedInvestment,
    genome.seedSize,
    genome.defense,
  ];

  // Find dominant trait for the adjective
  let first = 0;
  for (let i = 1; i < traits.length; i++) {
    if (traits[i] > traits[first]) first = i;
  }

  // Four-way vocabulary for adjectives
  let adjs: string[][];
  const arch = archetype(genome);
  if (arch === Archetype.Grass) {
    adjs = GRASS_ADJECTIVES;
  } else if (arch === Archetype.Succulent) {
    adjs = SUCCULENT_ADJECTIVES;
  } else if (arch === Archetype.Shrub) {
    adjs = SHRUB_ADJECTIVES;
  } else {
    adjs = ADJECTIVES;
  }
  const adjPool = adjs[first];
  const adj = adjPool[speciesId % adjPool.length];
  const subtypeName = SUBTYPE_NAMES[subtypeId] ?? 'Plant';

  return `${adj} ${subtypeName}`;
}
