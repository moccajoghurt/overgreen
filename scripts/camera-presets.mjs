/**
 * Named camera positions for reproducible capture views.
 *
 * Each preset has a position (camera location) and target (look-at point).
 * Coordinates are in world space (grid center = 0,0,0).
 */

export const PRESETS = {
  overview: {
    name: 'Overview',
    position: { x: 0, y: 60, z: 30 },
    target: { x: 0, y: 0, z: 0 },
  },
  closeGrass: {
    name: 'Grass close-up',
    position: { x: 5, y: 8, z: 8 },
    target: { x: 5, y: 0, z: 3 },
  },
  hillside: {
    name: 'Hillside',
    position: { x: -15, y: 20, z: 15 },
    target: { x: -10, y: 0, z: 5 },
  },
  river: {
    name: 'River edge',
    position: { x: 10, y: 12, z: -5 },
    target: { x: 8, y: 0, z: -8 },
  },
  wideField: {
    name: 'Wide field',
    position: { x: 0, y: 40, z: 20 },
    target: { x: 0, y: 0, z: 0 },
  },
};

export const DEFAULT_PRESETS = ['overview', 'closeGrass', 'hillside', 'wideField'];

// Showcase camera presets — flat soil grid with health-state triplets × LOD.
// Grid center (40,40) = world (0,0). Cell (x,y) → world (x-40, 0, y-40).
// Layout: 5 bands, each with hi-LOD row + lo-LOD row 4 cells below.
//   Band y centers: 7/11, 21/25, 35/39, 49/53, 63/67
//   Band world z centers: -31/-27, -17/-13, -3/1, 11/15, 25/29
// x spans 3..71 → world x center ≈ -3
export const SHOWCASE_PRESETS_MAP = {
  showcaseOverview: {
    name: 'Showcase Overview',
    position: { x: -3, y: 70, z: 20 },
    target: { x: -3, y: 0, z: -2 },
  },
  showcaseGrasses: {
    name: 'Showcase Grasses',
    // Band y=7/11 → world z center ≈ -29
    position: { x: -3, y: 20, z: -17 },
    target: { x: -3, y: 0, z: -29 },
  },
  showcaseTrees: {
    name: 'Showcase Trees',
    // Band y=21/25 → world z center ≈ -15
    position: { x: -3, y: 25, z: -3 },
    target: { x: -3, y: 0, z: -15 },
  },
  showcaseShrubs: {
    name: 'Showcase Shrubs',
    // Band y=35/39 → world z center ≈ -1
    position: { x: -3, y: 20, z: 11 },
    target: { x: -3, y: 0, z: -1 },
  },
  showcaseSucculents: {
    name: 'Showcase Succulents',
    // Band y=49/53 → world z center ≈ 13
    position: { x: -3, y: 20, z: 25 },
    target: { x: -3, y: 0, z: 13 },
  },
  showcaseForbs: {
    name: 'Showcase Forbs',
    // Band y=63/67 → world z center ≈ 27
    position: { x: -3, y: 20, z: 39 },
    target: { x: -3, y: 0, z: 27 },
  },
};

export const SHOWCASE_PRESETS = Object.keys(SHOWCASE_PRESETS_MAP);

// ── Per-plant close-up presets ──
// Each frames one subtype's 6 meshes (3 health × 2 LOD).
// Layout mirrors src/scenarios/showcase.ts:
//   START_X=3, TRIPLET_SPACING=9, ROW_Y_HI=[7,21,35,49,63], ROW_Y_LO=[11,25,39,53,67]
//   Cell (x,y) → world (x-40+0.5, 0, y-40+0.5)

const PLANT_GROUPS = [
  { subs: [0,1,2,3,4,5,30,31], yHi: 7, yLo: 11, camY: 5, camZoff: 5 },   // Grasses
  { subs: [6,7,8,9,10,11,32,33], yHi: 21, yLo: 25, camY: 30, camZoff: 25 }, // Trees
  { subs: [12,13,14,15,16,17,34,35], yHi: 35, yLo: 39, camY: 8, camZoff: 7 }, // Shrubs
  { subs: [18,19,20,21,22,23,36,37], yHi: 49, yLo: 53, camY: 18, camZoff: 15 }, // Succulents
  { subs: [24,25,26,27,28,29,38,39], yHi: 63, yLo: 67, camY: 5, camZoff: 5 }, // Forbs
];

const SUBTYPE_NAMES = [
  'Turfgrass','Tallgrass','Bunchgrass','Bamboo','Ryegrass','Sedge',
  'Oak','Magnolia','Conifer','Tropical','Palm','Birch',
  'Holly','Hazel','Mediterranean','Bramble','Saltbush','Mangrove',
  'Saguaro','Aloe','Caudiciform','Euphorbia','Iceplant','Epiphytic',
  'Wildflower','Tall Herb','Fern','Vine','Clover','Moss',
  'Pampas','Desert Grass','Cypress','Acacia',
  'Flowering Shrub','Aromatic','Barrel Cactus','Jade',
  'Tropical Herb','Desert Annual',
];

const START_X = 3;
const TRIPLET_SPACING = 9;

export const PLANT_PRESETS_MAP = {};
const plantPresetKeys = [];

for (const group of PLANT_GROUPS) {
  const wzCenter = (group.yHi + group.yLo) / 2 - 39.5;
  for (let si = 0; si < group.subs.length; si++) {
    const sub = group.subs[si];
    const wx = START_X + si * TRIPLET_SPACING + 2 - 39.5;
    const name = SUBTYPE_NAMES[sub];
    const key = 'plant' + name.replace(/\s+/g, '');
    PLANT_PRESETS_MAP[key] = {
      name: name,
      position: { x: wx, y: group.camY, z: wzCenter + group.camZoff },
      target: { x: wx, y: 0, z: wzCenter },
    };
    plantPresetKeys.push(key);
  }
}

export const PLANT_PRESETS = plantPresetKeys;

// Merge all presets into main PRESETS for unified lookup
Object.assign(PRESETS, SHOWCASE_PRESETS_MAP, PLANT_PRESETS_MAP);
