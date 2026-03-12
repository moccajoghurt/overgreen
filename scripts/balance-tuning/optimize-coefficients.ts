/**
 * Coefficient Optimizer — finds trait-effect coefficients matching the target matrix.
 * Target matrix defined in: target-matrix.md (16 niches × 40 subtypes, 4 tiers each)
 *
 * Since computeTraitModifier is LINEAR in the coefficients (for fixed genomes/envs),
 * this is a convex optimization: gradient descent on hinge-loss ranking constraints.
 *
 * Usage: npx tsx scripts/balance-tuning/optimize-coefficients.ts
 */

import { Genome, TerrainType, archetype } from '../../src/types/core';
import { ClimateZone, CLIMATE_ZONE_COUNT } from '../../src/types/environment';
import { classifySubtype, SUBTYPE_NAMES } from '../../src/types/subtypes';
import {
  EFFECTIVE_ENV, computeTraitModifier, getEnvIdx,
  diagnoseTraitEffects, CellEnvironment,
} from '../../src/simulation/trait-effects';

// ── Constants ──

const TERRAIN_COUNT = 6;
const SUBTYPE_COUNT = 40;
const TRAIT_KEYS: (keyof Genome)[] = [
  'rootPriority', 'heightPriority', 'leafSize', 'seedInvestment',
  'seedSize', 'defense', 'woodiness', 'waterStorage', 'longevity',
];

const log = (s: string) => process.stderr.write(s + '\n');
const out = (s: string) => process.stdout.write(s + '\n');

// ── Name → ID mapping ──

const nameToId = new Map<string, number>();
SUBTYPE_NAMES.forEach((name, i) => nameToId.set(name, i));

function ids(...names: string[]): number[] {
  return names.map(n => {
    const id = nameToId.get(n);
    if (id === undefined) throw new Error(`Unknown subtype: "${n}"`);
    return id;
  });
}

// ── Target Matrix (RALPH.md) ──
// tier 3=dominant, 2=common, 1=minor, 0=absent (complement)

interface NicheTarget {
  cz: number; tt: number; label: string;
  dominant: number[]; common: number[]; minor: number[];
}

const TARGETS: NicheTarget[] = [
  // ── Soil ──
  { cz: 0, tt: 0, label: 'Temp/Soil',
    dominant: ids('Oak', 'Birch', 'Hazel'),
    common: ids('Holly', 'Bramble', 'Wildflower', 'Fern', 'Clover', 'Moss', 'Tallgrass'),
    minor: ids('Magnolia', 'Turfgrass', 'Ryegrass', 'Tall Herb', 'Vine') },
  { cz: 1, tt: 0, label: 'Trop/Soil',
    dominant: ids('Tropical', 'Palm', 'Magnolia', 'Tropical Herb', 'Fern'),
    common: ids('Vine', 'Bamboo', 'Flowering Shrub', 'Tall Herb', 'Moss', 'Epiphytic'),
    minor: ids('Tallgrass', 'Bramble', 'Clover') },
  { cz: 2, tt: 0, label: 'Med/Soil',
    dominant: ids('Mediterranean', 'Aromatic', 'Cypress', 'Oak'),
    common: ids('Holly', 'Wildflower', 'Clover', 'Turfgrass', 'Ryegrass'),
    minor: ids('Aloe', 'Euphorbia', 'Bramble', 'Tall Herb', 'Bunchgrass', 'Acacia') },
  { cz: 3, tt: 0, label: 'Des/Soil',
    dominant: ids('Saltbush', 'Acacia', 'Desert Grass', 'Desert Annual'),
    common: ids('Saguaro', 'Barrel Cactus', 'Aloe', 'Euphorbia', 'Jade', 'Aromatic'),
    minor: ids('Bunchgrass', 'Caudiciform', 'Pampas') },

  // ── Hill ──
  { cz: 0, tt: 3, label: 'Temp/Hill',
    dominant: ids('Bunchgrass', 'Turfgrass', 'Wildflower', 'Clover'),
    common: ids('Ryegrass', 'Moss', 'Tallgrass', 'Holly'),
    minor: ids('Conifer', 'Aromatic', 'Fern', 'Tall Herb') },
  { cz: 1, tt: 3, label: 'Trop/Hill',
    dominant: ids('Bunchgrass', 'Tropical Herb', 'Fern', 'Conifer'),
    common: ids('Wildflower', 'Moss', 'Flowering Shrub', 'Epiphytic', 'Bamboo'),
    minor: ids('Tall Herb', 'Vine', 'Clover') },
  { cz: 2, tt: 3, label: 'Med/Hill',
    dominant: ids('Bunchgrass', 'Mediterranean', 'Aromatic'),
    common: ids('Wildflower', 'Turfgrass', 'Clover', 'Cypress'),
    minor: ids('Euphorbia', 'Barrel Cactus', 'Holly', 'Ryegrass') },
  { cz: 3, tt: 3, label: 'Des/Hill',
    dominant: ids('Saguaro', 'Barrel Cactus', 'Desert Grass', 'Bunchgrass'),
    common: ids('Desert Annual', 'Euphorbia', 'Saltbush', 'Aloe'),
    minor: ids('Caudiciform', 'Aromatic', 'Jade') },

  // ── Wetland ──
  { cz: 0, tt: 4, label: 'Temp/Wetl',
    dominant: ids('Birch', 'Cypress', 'Sedge', 'Fern'),
    common: ids('Oak', 'Mangrove', 'Hazel', 'Moss', 'Tall Herb', 'Wildflower', 'Tallgrass'),
    minor: ids('Bramble', 'Clover', 'Ryegrass', 'Holly') },
  { cz: 1, tt: 4, label: 'Trop/Wetl',
    dominant: ids('Tropical', 'Palm', 'Mangrove', 'Fern', 'Bamboo'),
    common: ids('Magnolia', 'Vine', 'Tropical Herb', 'Sedge', 'Moss', 'Tall Herb'),
    minor: ids('Flowering Shrub', 'Epiphytic', 'Tallgrass') },
  { cz: 2, tt: 4, label: 'Med/Wetl',
    dominant: ids('Cypress', 'Mangrove', 'Sedge', 'Fern'),
    common: ids('Birch', 'Wildflower', 'Ryegrass', 'Tallgrass', 'Moss'),
    minor: ids('Mediterranean', 'Holly', 'Tall Herb', 'Clover') },
  { cz: 3, tt: 4, label: 'Des/Wetl',
    dominant: ids('Palm', 'Acacia', 'Sedge', 'Tallgrass'),
    common: ids('Fern', 'Ryegrass', 'Mangrove', 'Moss'),
    minor: ids('Saltbush', 'Wildflower', 'Clover') },

  // ── Arid ──
  { cz: 0, tt: 5, label: 'Temp/Arid',
    dominant: ids('Saltbush', 'Aromatic', 'Desert Grass', 'Bunchgrass'),
    common: ids('Aloe', 'Jade', 'Euphorbia', 'Ryegrass', 'Desert Annual', 'Holly'),
    minor: ids('Acacia', 'Caudiciform', 'Saguaro', 'Wildflower', 'Clover') },
  { cz: 1, tt: 5, label: 'Trop/Arid',
    dominant: ids('Acacia', 'Aloe', 'Euphorbia', 'Pampas'),
    common: ids('Saltbush', 'Desert Grass', 'Saguaro', 'Jade', 'Desert Annual', 'Tropical Herb'),
    minor: ids('Barrel Cactus', 'Caudiciform', 'Bunchgrass', 'Aromatic') },
  { cz: 2, tt: 5, label: 'Med/Arid',
    dominant: ids('Barrel Cactus', 'Saguaro', 'Aromatic', 'Mediterranean'),
    common: ids('Aloe', 'Euphorbia', 'Desert Grass', 'Desert Annual', 'Saltbush'),
    minor: ids('Jade', 'Caudiciform', 'Bunchgrass', 'Acacia', 'Wildflower') },
  { cz: 3, tt: 5, label: 'Des/Arid',
    dominant: ids('Saguaro', 'Barrel Cactus'),
    common: ids('Desert Grass', 'Desert Annual'),
    minor: ids('Saltbush', 'Euphorbia', 'Jade', 'Caudiciform') },
];

// ── Genome Helpers ──

function makeGenome(vals: number[]): Genome {
  return {
    rootPriority: vals[0], heightPriority: vals[1], leafSize: vals[2],
    seedInvestment: vals[3], seedSize: vals[4], defense: vals[5],
    woodiness: vals[6], waterStorage: vals[7], longevity: vals[8],
  };
}

// ── Step 1: Prototype genomes per subtype ──
// Derived analytically from classifier weights in subtypes.ts.
// Each genome maximizes its subtype's classifier score while respecting archetype gates.
// Key: traits with positive weight → HIGH (0.95), inverse weight → LOW (0.05), unused → neutral (0.50).

log('Building prototype representative genomes...');

//                             root  height leaf  seed  seedSz def   wood  wst   lon
const PROTOTYPES: Record<number, number[]> = {
  // ── Grasses (wood<0.4, leaf<0.5, wst<0.55) ──
  // Turfgrass: (1-h)×.45 + (1-r)×.15 + (1-w)×.20 + (1-l)×.1 + (1-lon)×.1
  0:  [0.05, 0.05, 0.05, 0.50, 0.50, 0.50, 0.05, 0.05, 0.05],
  // Tallgrass: h×.6 + l×.2 + si×.1 + lon×.1
  1:  [0.50, 0.95, 0.49, 0.50, 0.50, 0.05, 0.05, 0.05, 0.95],
  // Bunchgrass: r×.25 + sz×.20 + (1-h)×.20 + lon×.15 + si×.20
  2:  [0.95, 0.05, 0.05, 0.95, 0.95, 0.05, 0.05, 0.05, 0.95],
  // Bamboo: w×.20 + r×.25 + h×.25 + lon×.20 + (1-si)×.10
  3:  [0.95, 0.95, 0.05, 0.05, 0.50, 0.05, 0.39, 0.05, 0.95],
  // Ryegrass/Spreading: si×.45 + l×.15 + (1-h)×.3 + (1-lon)×.1
  4:  [0.95, 0.05, 0.49, 0.95, 0.05, 0.05, 0.05, 0.05, 0.05],
  // Sedge: (1-r)×.35 + l×.3 + h×.2 + (1-wst)×.15
  5:  [0.05, 0.95, 0.49, 0.05, 0.05, 0.05, 0.05, 0.05, 0.50],
  // Pampas (30): def×.35 + h×.25 + r×.25 + lon×.10 + (1-l)×.05
  30: [0.95, 0.95, 0.05, 0.05, 0.50, 0.95, 0.05, 0.05, 0.95],
  // Desert Grass (31): wst×.35 + r×.20 + (1-l)×.20 + (1-si)×.15 + lon×.10
  31: [0.95, 0.05, 0.05, 0.05, 0.50, 0.05, 0.05, 0.54, 0.95],

  // ── Trees (wood>0.7, wst<0.55) ──
  // Oak: l×.45 + r×.15 + (1-si)×.15 + def×.15 + lon×.1
  6:  [0.95, 0.50, 0.95, 0.05, 0.50, 0.95, 0.80, 0.05, 0.95],
  // Magnolia: lon×.25 + l×.25 + (1-si)×.2 + (1-h)×.2 + (1-def)×.1
  7:  [0.50, 0.05, 0.95, 0.05, 0.50, 0.05, 0.80, 0.05, 0.95],
  // Conifer: h×.45 + (1-l)×.25 + (1-r)×.2 + lon×.1
  8:  [0.05, 0.95, 0.05, 0.05, 0.50, 0.50, 0.80, 0.05, 0.95],
  // Tropical: def×.35 + h×.25 + l×.30 + (1-r)×.10
  9:  [0.05, 0.95, 0.95, 0.05, 0.50, 0.95, 0.80, 0.05, 0.50],
  // Palm: h×.35 + (1-r)×.25 + (1-def)×.2 + (1-l)×.2
  10: [0.05, 0.95, 0.05, 0.50, 0.50, 0.05, 0.80, 0.05, 0.50],
  // Birch: si×.45 + (1-r)×.15 + h×.15 + (1-def)×.15 + (1-lon)×.1
  11: [0.05, 0.95, 0.50, 0.95, 0.50, 0.05, 0.80, 0.05, 0.05],
  // Cypress (32): h×.35 + (1-l)×.30 + lon×.20 + w×.15
  32: [0.95, 0.95, 0.05, 0.05, 0.50, 0.50, 0.95, 0.05, 0.95],
  // Acacia (33): def×.3 + r×.25 + (1-l)×.25 + si×.2
  33: [0.95, 0.05, 0.05, 0.95, 0.50, 0.95, 0.80, 0.05, 0.05],

  // ── Shrubs (wood 0.4-0.7, wst<0.55) ──
  // Holly/Evergreen: def×.3 + l×.25 + (1-si)×.2 + (1-h)×.15 + lon×.1
  12: [0.50, 0.05, 0.95, 0.05, 0.50, 0.95, 0.55, 0.05, 0.95],
  // Hazel/Deciduous: peaked(l=.5)×.25 + peaked(h=.5)×.25 + si×.2 + (1-def)×.2 + (1-lon)×.1
  13: [0.50, 0.50, 0.50, 0.95, 0.50, 0.05, 0.55, 0.05, 0.05],
  // Mediterranean: w×.3 + (1-l)×.25 + wst×.25 + lon×.2
  14: [0.05, 0.50, 0.05, 0.05, 0.50, 0.05, 0.70, 0.54, 0.95],
  // Bramble/Thorny: def×.50 + l×.25 + (1-h)×.15 + r×.10
  15: [0.95, 0.05, 0.95, 0.05, 0.50, 0.95, 0.55, 0.05, 0.50],
  // Saltbush: r×.30 + (1-l)×.25 + lon×.20 + (1-def)×.15 + (1-h)×.10
  16: [0.95, 0.05, 0.05, 0.50, 0.50, 0.05, 0.55, 0.05, 0.95],
  // Mangrove: (1-r)×.3 + h×.3 + l×.2 + (1-wst)×.2
  17: [0.05, 0.95, 0.95, 0.50, 0.50, 0.05, 0.55, 0.05, 0.05],
  // Flowering Shrub (34): si×.4 + l×.25 + (1-def)×.2 + lon×.15
  34: [0.05, 0.50, 0.95, 0.95, 0.50, 0.05, 0.55, 0.05, 0.95],
  // Aromatic (35): (1-h)×.3 + def×.25 + lon×.25 + (1-l)×.2
  35: [0.50, 0.05, 0.05, 0.05, 0.50, 0.95, 0.55, 0.05, 0.95],

  // ── Succulents (wst>=0.55) ──
  // Saguaro: h×.5 + (1-l)×.2 + wst×.2 + lon×.1
  18: [0.50, 0.95, 0.05, 0.05, 0.50, 0.50, 0.50, 0.95, 0.95],
  // Aloe: l×.5 + (1-h)×.3 + wst×.2
  19: [0.50, 0.05, 0.95, 0.05, 0.50, 0.05, 0.50, 0.95, 0.50],
  // Caudiciform: wst×.35 + (1-def)×.25 + (1-h)×.15 + r×.15 + (1-l)×.10
  20: [0.95, 0.05, 0.05, 0.50, 0.50, 0.05, 0.50, 0.95, 0.50],
  // Euphorbia: h×.3 + si×.25 + def×.25 + (1-r)×.2
  21: [0.05, 0.95, 0.50, 0.95, 0.50, 0.95, 0.50, 0.60, 0.50],
  // Ice Plant: (1-h)×.35 + si×.25 + (1-r)×.3 + (1-lon)×.1
  22: [0.05, 0.05, 0.50, 0.95, 0.50, 0.05, 0.50, 0.60, 0.05],
  // Epiphytic: (1-r)×.4 + (1-h)×.3 + l×.3
  23: [0.05, 0.05, 0.95, 0.05, 0.50, 0.05, 0.50, 0.60, 0.50],
  // Barrel Cactus (36): def×.35 + (1-h)×.25 + wst×.25 + r×.15
  36: [0.95, 0.05, 0.05, 0.05, 0.50, 0.95, 0.50, 0.95, 0.50],
  // Jade (37): lon×.3 + l×.25 + (1-h)×.25 + r×.2
  37: [0.95, 0.05, 0.95, 0.05, 0.50, 0.05, 0.50, 0.60, 0.95],

  // ── Forbs (wood<0.4, leaf>=0.5, wst<0.55) ──
  // Wildflower: si×.35 + (1-h)×.25 + l×.2 + (1-def)×.2
  24: [0.05, 0.05, 0.95, 0.95, 0.50, 0.05, 0.10, 0.05, 0.50],
  // Tall Herb: h×.5 + l×.2 + lon×.15 + r×.15
  25: [0.95, 0.95, 0.95, 0.05, 0.50, 0.05, 0.10, 0.05, 0.95],
  // Fern: l×.4 + r×.2 + lon×.2 + (1-si)×.2
  26: [0.95, 0.05, 0.95, 0.05, 0.50, 0.05, 0.10, 0.05, 0.95],
  // Vine: si×.3 + (1-r)×.3 + h×.2 + (1-def)×.2
  27: [0.05, 0.95, 0.50, 0.95, 0.50, 0.05, 0.10, 0.05, 0.50],
  // Clover: (1-h)×.35 + si×.25 + r×.2 + (1-lon)×.2
  28: [0.95, 0.05, 0.50, 0.95, 0.50, 0.05, 0.10, 0.05, 0.05],
  // Moss: (1-h)×.3 + r×.25 + (1-si)×.25 + wst×.2
  29: [0.95, 0.05, 0.50, 0.05, 0.50, 0.05, 0.10, 0.54, 0.50],
  // Tropical Herb (38): l×.30 + def×.25 + h×.20 + (1-si)×.15 + lon×.10
  38: [0.50, 0.95, 0.95, 0.05, 0.50, 0.95, 0.10, 0.05, 0.95],
  // Desert Annual (39): (1-lon)×.3 + si×.25 + (1-wst)×.25 + (1-r)×.2
  39: [0.05, 0.50, 0.50, 0.95, 0.50, 0.05, 0.10, 0.05, 0.05],
};

const repGenomes: (Genome | null)[] = new Array(SUBTYPE_COUNT).fill(null);
let misclassified = 0;

for (const [idStr, vals] of Object.entries(PROTOTYPES)) {
  const id = Number(idStr);
  const g = makeGenome(vals);
  const classified = classifySubtype(g) as number;
  if (classified !== id) {
    log(`  WARNING: Prototype for ${SUBTYPE_NAMES[id]} (#${id}) classifies as ${SUBTYPE_NAMES[classified]} (#${classified})`);
    misclassified++;
  }
  repGenomes[id] = g;
}

const activeSubtypes = repGenomes.map((g, i) => g ? i : -1).filter(i => i >= 0);
log(`Prototype genomes: ${activeSubtypes.length}/${SUBTYPE_COUNT} (${misclassified} misclassified)`);

// ── Step 2: Extract features (coefficient-independent) ──

log('Extracting feature matrix...');

// Get niche environments
interface Niche { cz: number; tt: number; label: string; envIdx: number; }
const nicheMap = new Map<string, number>(); // "cz,tt" → index in TARGETS
TARGETS.forEach((t, i) => nicheMap.set(`${t.cz},${t.tt}`, i));

// Use diagnoseTraitEffects on a sample to get row count and current coefficients
const sampleEnv = EFFECTIVE_ENV[getEnvIdx(0, 0)];
const sampleDiag = diagnoseTraitEffects(repGenomes[0] || makeGenome(new Array(9).fill(0.5)), sampleEnv);
const ROW_COUNT = sampleDiag.length;
const currentCoeffs = sampleDiag.map(e => e.coefficient);
const rowDescriptions = sampleDiag.map(e => ({
  trait: e.trait,
  envVar: e.envVar,
  description: e.description,
}));

log(`Trait effect rows: ${ROW_COUNT}`);

// features[subtypeId][targetNicheIdx][rowIdx] = traitVal * envVal
const features: Float64Array[][] = Array.from({ length: SUBTYPE_COUNT }, () =>
  Array.from({ length: TARGETS.length }, () => new Float64Array(ROW_COUNT))
);

for (let s = 0; s < SUBTYPE_COUNT; s++) {
  if (!repGenomes[s]) continue;
  for (let ni = 0; ni < TARGETS.length; ni++) {
    const t = TARGETS[ni];
    const env = EFFECTIVE_ENV[getEnvIdx(t.cz, t.tt)];
    const diag = diagnoseTraitEffects(repGenomes[s]!, env);
    for (let r = 0; r < ROW_COUNT; r++) {
      features[s][ni][r] = diag[r].traitVal * diag[r].envVal;
    }
  }
}

// ── Step 3: Build constraints ──

log('Building ranking constraints...');

interface Constraint {
  nicheIdx: number;
  highId: number;  // should score higher
  lowId: number;   // should score lower
  margin: number;
}

const constraints: Constraint[] = [];
const MARGIN_PER_TIER = 0.12;

for (let ni = 0; ni < TARGETS.length; ni++) {
  const t = TARGETS[ni];

  // Assign tiers: 3=dominant, 2=common, 1=minor, 0=absent
  const tier = new Int8Array(SUBTYPE_COUNT); // default 0 = absent
  for (const s of t.dominant) tier[s] = 3;
  for (const s of t.common)   tier[s] = 2;
  for (const s of t.minor)    tier[s] = 1;

  // Generate all cross-tier pairs
  for (let a = 0; a < SUBTYPE_COUNT; a++) {
    if (!repGenomes[a]) continue;
    for (let b = 0; b < SUBTYPE_COUNT; b++) {
      if (!repGenomes[b]) continue;
      if (tier[a] > tier[b]) {
        constraints.push({
          nicheIdx: ni,
          highId: a,
          lowId: b,
          margin: (tier[a] - tier[b]) * MARGIN_PER_TIER,
        });
      }
    }
  }
}

log(`Constraints: ${constraints.length}`);

// Pre-compute constraint gradient features: gradFeature[c][r] = features[low][niche][r] - features[high][niche][r]
const gradFeatures: Float64Array[] = constraints.map(c => {
  const gf = new Float64Array(ROW_COUNT);
  for (let r = 0; r < ROW_COUNT; r++) {
    gf[r] = features[c.lowId][c.nicheIdx][r] - features[c.highId][c.nicheIdx][r];
  }
  return gf;
});

// ── Step 4: Adam optimizer ──

log('Running optimizer...');

function score(subtypeId: number, nicheIdx: number, coeffs: Float64Array): number {
  let sum = 0;
  const f = features[subtypeId][nicheIdx];
  for (let r = 0; r < ROW_COUNT; r++) sum += f[r] * coeffs[r];
  return sum;
}

function computeLoss(coeffs: Float64Array): { loss: number; grad: Float64Array; violations: number } {
  let loss = 0;
  let violations = 0;
  const grad = new Float64Array(ROW_COUNT);

  for (let ci = 0; ci < constraints.length; ci++) {
    const c = constraints[ci];
    const sHigh = score(c.highId, c.nicheIdx, coeffs);
    const sLow = score(c.lowId, c.nicheIdx, coeffs);
    const violation = sLow - sHigh + c.margin;
    if (violation > 0) {
      loss += violation * violation; // squared hinge for smoother gradients
      violations++;
      const gf = gradFeatures[ci];
      const scale = 2 * violation;
      for (let r = 0; r < ROW_COUNT; r++) grad[r] += scale * gf[r];
    }
  }

  // L2 regularization (keep coefficients reasonable)
  const lambda = 0.0005;
  for (let r = 0; r < ROW_COUNT; r++) {
    loss += lambda * coeffs[r] * coeffs[r];
    grad[r] += 2 * lambda * coeffs[r];
  }

  return { loss, grad, violations };
}

// Adam parameters
const LR = 0.005;
const BETA1 = 0.9;
const BETA2 = 0.999;
const EPSILON = 1e-8;
const MAX_ITER = 30000;

const coeffs = new Float64Array(currentCoeffs);
const m = new Float64Array(ROW_COUNT); // first moment
const v = new Float64Array(ROW_COUNT); // second moment

let bestLoss = Infinity;
let bestCoeffs = new Float64Array(coeffs);
let bestViolations = constraints.length;

for (let iter = 1; iter <= MAX_ITER; iter++) {
  const { loss, grad, violations } = computeLoss(coeffs);

  // Adam update
  for (let r = 0; r < ROW_COUNT; r++) {
    m[r] = BETA1 * m[r] + (1 - BETA1) * grad[r];
    v[r] = BETA2 * v[r] + (1 - BETA2) * grad[r] * grad[r];
    const mHat = m[r] / (1 - BETA1 ** iter);
    const vHat = v[r] / (1 - BETA2 ** iter);
    coeffs[r] -= LR * mHat / (Math.sqrt(vHat) + EPSILON);
  }

  if (loss < bestLoss) {
    bestLoss = loss;
    bestCoeffs.set(coeffs);
    bestViolations = violations;
  }

  if (iter % 5000 === 0 || iter === 1) {
    log(`  iter ${String(iter).padStart(5)}: loss=${loss.toFixed(4)} violations=${violations}/${constraints.length}`);
  }

  // Early stopping
  if (violations === 0) {
    log(`  Converged at iter ${iter}! All constraints satisfied.`);
    break;
  }
}

log(`Best: loss=${bestLoss.toFixed(4)} violations=${bestViolations}/${constraints.length}`);

// ── Step 5: Output ──

const pad = (s: string, w: number) => s.padEnd(w);
const fmt = (n: number, w = 7) => (n >= 0 ? '+' : '') + n.toFixed(3).padStart(w);

// Section A: Coefficient changes
out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  OPTIMIZED COEFFICIENTS');
out('═══════════════════════════════════════════════════════════════════════════');
out('');
out(`  ${'#'.padStart(3)}  ${pad('Trait', 30)} ${pad('EnvVar', 18)} ${'Old'.padStart(7)} ${'New'.padStart(7)} ${'Delta'.padStart(7)}  Description`);
out(`  ${'─'.repeat(3)}  ${'─'.repeat(30)} ${'─'.repeat(18)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(7)}  ${'─'.repeat(30)}`);

for (let r = 0; r < ROW_COUNT; r++) {
  const old = currentCoeffs[r];
  const opt = bestCoeffs[r];
  const delta = opt - old;
  const marker = Math.abs(delta) > 0.1 ? ' ◄' : '';
  out(
    `  ${String(r).padStart(3)}  ${pad(rowDescriptions[r].trait, 30)} ${pad(rowDescriptions[r].envVar || '(base)', 18)} ${fmt(old)} ${fmt(opt)} ${fmt(delta)}  ${rowDescriptions[r].description}${marker}`
  );
}

// Section B: Balance matrix with optimized coefficients
out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  RESULTING BALANCE MATRIX (top 5 per niche)');
out('═══════════════════════════════════════════════════════════════════════════');

for (let ni = 0; ni < TARGETS.length; ni++) {
  const t = TARGETS[ni];
  const entries: { id: number; mod: number }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    entries.push({ id: s, mod: score(s, ni, bestCoeffs) });
  }
  entries.sort((a, b) => b.mod - a.mod);

  out('');
  out(`  ${pad(t.label, 16)}  (target dominant: ${t.dominant.map(s => SUBTYPE_NAMES[s]).join(', ')})`);
  for (let r = 0; r < Math.min(8, entries.length); r++) {
    const e = entries[r];
    const tier = t.dominant.includes(e.id) ? 'DOM' :
                 t.common.includes(e.id) ? 'COM' :
                 t.minor.includes(e.id) ? 'MIN' : 'ABS';
    const marker = tier === 'ABS' ? ' ✗' : tier === 'DOM' ? ' ✓' : '';
    out(`    #${String(r + 1).padStart(2)}  ${pad(SUBTYPE_NAMES[e.id], 16)} ${fmt(e.mod, 7)}  [${tier}]${marker}`);
  }
}

// Section C: Target satisfaction summary
out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  TARGET SATISFACTION');
out('═══════════════════════════════════════════════════════════════════════════');
out('');

let nichesFullyCorrect = 0;
let nichesDomCorrect = 0;

for (let ni = 0; ni < TARGETS.length; ni++) {
  const t = TARGETS[ni];
  const entries: { id: number; mod: number }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    entries.push({ id: s, mod: score(s, ni, bestCoeffs) });
  }
  entries.sort((a, b) => b.mod - a.mod);

  const topN = entries.slice(0, t.dominant.length).map(e => e.id);
  const domInTop = t.dominant.filter(s => topN.includes(s)).length;
  const domTotal = t.dominant.length;
  const domOk = domInTop === domTotal;

  // Check no absent in top (dominant + common count)
  const topCount = t.dominant.length + t.common.length;
  const topIds = entries.slice(0, topCount).map(e => e.id);
  const absentInTop = topIds.filter(id =>
    !t.dominant.includes(id) && !t.common.includes(id) && !t.minor.includes(id)
  ).length;

  const status = domOk && absentInTop === 0 ? '✓' : domOk ? '~' : '✗';
  if (domOk && absentInTop === 0) nichesFullyCorrect++;
  if (domOk) nichesDomCorrect++;

  out(`  ${status} ${pad(t.label, 16)} dominant: ${domInTop}/${domTotal}  absent-in-top-${topCount}: ${absentInTop}`);
}

out('');
out(`  Niches with correct dominant: ${nichesDomCorrect}/${TARGETS.length}`);
out(`  Niches fully correct:         ${nichesFullyCorrect}/${TARGETS.length}`);
out(`  Constraint violations:        ${bestViolations}/${constraints.length}`);

// Section D: Copy-pasteable coefficient array
out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  COPY-PASTE COEFFICIENTS (for trait-effects.ts)');
out('═══════════════════════════════════════════════════════════════════════════');
out('');
out('Replace the coefficient values in TRAIT_EFFECTS (same row order):');
out('');
for (let r = 0; r < ROW_COUNT; r++) {
  const coeff = bestCoeffs[r] >= 0 ? `+${bestCoeffs[r].toFixed(2)}` : bestCoeffs[r].toFixed(2);
  out(`  [${String(r).padStart(2)}] coefficient: ${coeff.padStart(6)},  // ${rowDescriptions[r].description}`);
}

// Section E: Inseparable subtype pairs diagnostic
out('');
out('═══════════════════════════════════════════════════════════════════════════');
out('  INSEPARABLE SUBTYPE PAIRS');
out('  Pairs the optimizer cannot rank correctly — need new trait×env rows');
out('  or environment variables to separate them.');
out('═══════════════════════════════════════════════════════════════════════════');
out('');

// Collect all violated constraints with their violation magnitude
interface ViolatedPair {
  niche: string;
  highName: string;
  lowName: string;
  highTier: string;
  lowTier: string;
  highScore: number;
  lowScore: number;
  gap: number; // actual score(high) - score(low), negative = wrong order
  highArch: number;
  lowArch: number;
}

const ARCH_NAMES = ['Grass', 'Shrub', 'Succulent', 'Tree', 'Forb'];
const violated: ViolatedPair[] = [];

for (let ci = 0; ci < constraints.length; ci++) {
  const c = constraints[ci];
  const sHigh = score(c.highId, c.nicheIdx, bestCoeffs);
  const sLow = score(c.lowId, c.nicheIdx, bestCoeffs);
  if (sHigh - sLow < c.margin) {
    const t = TARGETS[c.nicheIdx];
    const highTier = t.dominant.includes(c.highId) ? 'DOM' :
                     t.common.includes(c.highId) ? 'COM' : 'MIN';
    const lowTier = t.dominant.includes(c.lowId) ? 'DOM' :
                    t.common.includes(c.lowId) ? 'COM' :
                    t.minor.includes(c.lowId) ? 'MIN' : 'ABS';
    violated.push({
      niche: t.label,
      highName: SUBTYPE_NAMES[c.highId],
      lowName: SUBTYPE_NAMES[c.lowId],
      highTier, lowTier,
      highScore: sHigh,
      lowScore: sLow,
      gap: sHigh - sLow,
      highArch: repGenomes[c.highId] ? archetype(repGenomes[c.highId]!) : -1,
      lowArch: repGenomes[c.lowId] ? archetype(repGenomes[c.lowId]!) : -1,
    });
  }
}

// Sort by gap (worst violations first = most negative gap relative to margin)
violated.sort((a, b) => a.gap - b.gap);

// E1: Worst individual violations (top 30)
out(`  Total violated constraints: ${violated.length}/${constraints.length}`);
out('');
out('  ── Worst 30 violations (should-be-higher > should-be-lower) ──');
out('');
out(`  ${pad('Niche', 12)} ${pad('Should rank higher', 22)} ${pad('Should rank lower', 22)} ${'Gap'.padStart(7)}  Note`);
out(`  ${'─'.repeat(12)} ${'─'.repeat(22)} ${'─'.repeat(22)} ${'─'.repeat(7)}  ${'─'.repeat(30)}`);

for (let i = 0; i < Math.min(30, violated.length); i++) {
  const v = violated[i];
  const sameArch = v.highArch === v.lowArch && v.highArch >= 0;
  const note = sameArch ? `same archetype (${ARCH_NAMES[v.highArch]})` :
               v.gap < 0 ? 'WRONG ORDER' : 'too close';
  out(
    `  ${pad(v.niche, 12)} ${pad(`${v.highName} [${v.highTier}]`, 22)} ${pad(`${v.lowName} [${v.lowTier}]`, 22)} ${fmt(v.gap, 7)}  ${note}`
  );
}

// E2: Aggregate by subtype pair — which pairs fail across multiple niches?
out('');
out('  ── Subtype pairs that fail in multiple niches ──');
out('  (same pair violated in 2+ niches = structurally inseparable)');
out('');

const pairKey = (a: string, b: string) => `${a}|||${b}`;
const pairNiches = new Map<string, { niches: string[]; high: string; low: string; sameArch: boolean; archName: string }>();

for (const v of violated) {
  const key = pairKey(v.highName, v.lowName);
  if (!pairNiches.has(key)) {
    const sameArch = v.highArch === v.lowArch && v.highArch >= 0;
    pairNiches.set(key, {
      niches: [], high: v.highName, low: v.lowName,
      sameArch, archName: sameArch ? ARCH_NAMES[v.highArch] : '',
    });
  }
  pairNiches.get(key)!.niches.push(v.niche);
}

const multiNichePairs = [...pairNiches.values()]
  .filter(p => p.niches.length >= 2)
  .sort((a, b) => b.niches.length - a.niches.length);

if (multiNichePairs.length === 0) {
  out('  (none — all violations are niche-specific)');
} else {
  out(`  ${pad('Higher-tier', 18)} ${pad('Lower-tier', 18)} ${'#'.padStart(3)}  Niches`);
  out(`  ${'─'.repeat(18)} ${'─'.repeat(18)} ${'─'.repeat(3)}  ${'─'.repeat(40)}`);
  for (const p of multiNichePairs.slice(0, 30)) {
    const archNote = p.sameArch ? ` [${p.archName}]` : '';
    out(`  ${pad(p.high, 18)} ${pad(p.low, 18)} ${String(p.niches.length).padStart(3)}  ${p.niches.join(', ')}${archNote}`);
  }
}

// E3: Aggregate by archetype pair — are same-archetype pairs the bottleneck?
out('');
out('  ── Violations by archetype pair ──');
out('  (same-archetype pairs share genome space → hard to separate with coefficients)');
out('');

const archPairCounts = new Map<string, number>();
let sameArchTotal = 0;
let crossArchTotal = 0;

for (const v of violated) {
  if (v.highArch < 0 || v.lowArch < 0) continue;
  const key = `${ARCH_NAMES[v.highArch]} vs ${ARCH_NAMES[v.lowArch]}`;
  archPairCounts.set(key, (archPairCounts.get(key) || 0) + 1);
  if (v.highArch === v.lowArch) sameArchTotal++;
  else crossArchTotal++;
}

const sortedArchPairs = [...archPairCounts.entries()].sort((a, b) => b[1] - a[1]);
for (const [pair, count] of sortedArchPairs) {
  const pct = ((count / violated.length) * 100).toFixed(1);
  out(`  ${pad(pair, 28)} ${String(count).padStart(5)} violations  (${pct}%)`);
}

out('');
out(`  Same-archetype violations:  ${sameArchTotal} (${((sameArchTotal / violated.length) * 100).toFixed(1)}%)`);
out(`  Cross-archetype violations: ${crossArchTotal} (${((crossArchTotal / violated.length) * 100).toFixed(1)}%)`);

// E4: Per-niche violation count — which niches are hardest?
out('');
out('  ── Violations per niche ──');
out('');

const nicheViolCounts = new Map<string, { total: number; sameArch: number }>();
for (const v of violated) {
  if (!nicheViolCounts.has(v.niche)) nicheViolCounts.set(v.niche, { total: 0, sameArch: 0 });
  const entry = nicheViolCounts.get(v.niche)!;
  entry.total++;
  if (v.highArch === v.lowArch && v.highArch >= 0) entry.sameArch++;
}

const sortedNiches = [...nicheViolCounts.entries()].sort((a, b) => b[1].total - a[1].total);
out(`  ${pad('Niche', 16)} ${'Total'.padStart(6)} ${'Same-arch'.padStart(10)}`);
out(`  ${'─'.repeat(16)} ${'─'.repeat(6)} ${'─'.repeat(10)}`);
for (const [niche, counts] of sortedNiches) {
  out(`  ${pad(niche, 16)} ${String(counts.total).padStart(6)} ${String(counts.sameArch).padStart(10)}`);
}

// E5: Actionable suggestions
out('');
out('  ── Suggested new trait×env rows ──');
out('  Each suggestion targets a group of inseparable pairs.');
out('');

// Find which traits differ most between frequently-violated same-archetype pairs
const traitDiffAccum = new Map<string, { diffs: Float64Array; count: number; pairs: string[] }>();

for (const v of violated) {
  if (v.highArch !== v.lowArch || v.highArch < 0) continue;
  const archKey = ARCH_NAMES[v.highArch];
  if (!traitDiffAccum.has(archKey)) {
    traitDiffAccum.set(archKey, { diffs: new Float64Array(9), count: 0, pairs: [] });
  }
  const entry = traitDiffAccum.get(archKey)!;
  const hId = nameToId.get(v.highName)!;
  const lId = nameToId.get(v.lowName)!;
  const hG = repGenomes[hId]!;
  const lG = repGenomes[lId]!;
  for (let t = 0; t < 9; t++) {
    entry.diffs[t] += Math.abs(hG[TRAIT_KEYS[t]] - lG[TRAIT_KEYS[t]]);
  }
  entry.count++;
  const pairStr = `${v.highName}/${v.lowName}`;
  if (!entry.pairs.includes(pairStr)) entry.pairs.push(pairStr);
}

for (const [archName, entry] of traitDiffAccum) {
  // Normalize diffs
  const avgDiffs = TRAIT_KEYS.map((k, t) => ({
    trait: k,
    avgDiff: entry.diffs[t] / entry.count,
  }));
  avgDiffs.sort((a, b) => b.avgDiff - a.avgDiff);

  const topTraits = avgDiffs.filter(d => d.avgDiff > 0.05).slice(0, 3);
  if (topTraits.length === 0) continue;

  out(`  ${archName} (${entry.count} violations, ${entry.pairs.length} unique pairs):`);
  out(`    Most-different traits: ${topTraits.map(t => `${t.trait} (Δ${t.avgDiff.toFixed(2)})`).join(', ')}`);
  out(`    → Add interaction rows: ${topTraits.map(t => `${t.trait} × envVar`).join(', ')}`);
  out(`    Sample pairs: ${entry.pairs.slice(0, 5).join(', ')}`);
  out('');
}

out('');
log('Done.');
