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
