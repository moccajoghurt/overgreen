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

// Showcase camera presets — targeting plant group regions on the Genesis grid.
// Grid center (40,40) = world (0,0). Cell (x,y) → world (x-40, 0, y-40).
export const SHOWCASE_PRESETS_MAP = {
  showcaseOverview: {
    name: 'Showcase Overview',
    position: { x: 0, y: 65, z: 35 },
    target: { x: 0, y: 0, z: 5 },
  },
  showcaseGrassesForbs: {
    name: 'Showcase Grasses + Forbs',
    // Grasses y≈58-64, Forbs y≈66-76, x≈55-77 → world center ≈ (26, 0, 25)
    position: { x: 26, y: 25, z: 40 },
    target: { x: 26, y: 0, z: 25 },
  },
  showcaseTrees: {
    name: 'Showcase Trees',
    // 3×2 blocks at grid (22-39, 14-20) → world center ≈ (-10, 0, -23)
    position: { x: -10, y: 35, z: -10 },
    target: { x: -10, y: 0, z: -23 },
  },
  showcaseShrubs: {
    name: 'Showcase Shrubs',
    // 3×2 blocks at grid (16-24, 34-44) → world center ≈ (-20, 0, -1)
    position: { x: -20, y: 30, z: 12 },
    target: { x: -20, y: 0, z: -1 },
  },
  showcaseSucculents: {
    name: 'Showcase Succulents',
    // 3×2 blocks at grid (68-77, 40-53) → world center ≈ (32, 0, 6)
    position: { x: 32, y: 30, z: 20 },
    target: { x: 32, y: 0, z: 6 },
  },
  showcaseForbsHill: {
    name: 'Showcase Forbs on Hill',
    // Mixed forbs at grid (35-42, 7-11) → world center ≈ (-2, 0, -31)
    position: { x: -2, y: 20, z: -22 },
    target: { x: -2, y: 0, z: -31 },
  },
  showcaseForbsWetland: {
    name: 'Showcase Forbs on Wetland',
    // Mixed forbs at grid (19-24, 52-56) → world center ≈ (-19, 0, 14)
    position: { x: -19, y: 20, z: 24 },
    target: { x: -19, y: 0, z: 14 },
  },
};

export const SHOWCASE_PRESETS = Object.keys(SHOWCASE_PRESETS_MAP);

// Merge showcase presets into main PRESETS for unified lookup
Object.assign(PRESETS, SHOWCASE_PRESETS_MAP);
