import { Genome } from './types';
import { Archetype, renderArchetype } from './simulation/plants';

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

const SHRUB_NOUNS: string[][] = [
  // rootPriority
  ['Scrub', 'Chaparral', 'Brush', 'Heaths', 'Maquis', 'Garrigue'],
  // heightPriority
  ['Hollies', 'Laurels', 'Myrtles', 'Privets', 'Hazels', 'Elders'],
  // leafSize
  ['Thickets', 'Hedges', 'Copses', 'Tangles', 'Brakes', 'Coverts'],
  // seedInvestment
  ['Berries', 'Haws', 'Drupes', 'Currants', 'Sloes', 'Rosehips'],
  // seedSize
  ['Sumacs', 'Viburnums', 'Buckthorns', 'Dogwoods', 'Junipers', 'Yews'],
  // defense
  ['Brambles', 'Briars', 'Gorses', 'Roses', 'Barberries', 'Hawthorns'],
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

const SUCCULENT_NOUNS: string[][] = [
  // rootPriority
  ['Tubers', 'Taproots', 'Caudex', 'Anchors', 'Bulbs', 'Rhizomes'],
  // heightPriority
  ['Columns', 'Pillars', 'Saguaros', 'Cereus', 'Torches', 'Sentinels'],
  // leafSize
  ['Paddles', 'Rosettes', 'Aloes', 'Agaves', 'Stones', 'Jades'],
  // seedInvestment
  ['Pups', 'Offsets', 'Clusters', 'Blooms', 'Buds', 'Sprouts'],
  // seedSize
  ['Barrels', 'Globes', 'Melons', 'Gourds', 'Orbs', 'Drums'],
  // defense
  ['Spines', 'Needles', 'Hooks', 'Glochids', 'Bristles', 'Thorns'],
];

export function generateSpeciesName(genome: Genome, speciesId: number, _woodiness?: number): string {
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

  // Four-way vocabulary: grass / shrub / succulent / tree
  let adjs: string[][];
  let nouns: string[][];
  const arch = renderArchetype(genome);
  if (arch === Archetype.Grass) {
    adjs = GRASS_ADJECTIVES;
    nouns = GRASS_NOUNS;
  } else if (arch === Archetype.Succulent) {
    adjs = SUCCULENT_ADJECTIVES;
    nouns = SUCCULENT_NOUNS;
  } else if (arch === Archetype.Shrub) {
    adjs = SHRUB_ADJECTIVES;
    nouns = SHRUB_NOUNS;
  } else {
    adjs = ADJECTIVES;
    nouns = NOUNS;
  }
  const adjPool = adjs[first];
  const nounPool = nouns[second];
  const adj = adjPool[speciesId % adjPool.length];
  const noun = nounPool[Math.floor(speciesId / adjPool.length) % nounPool.length];

  return `${adj} ${noun}`;
}
