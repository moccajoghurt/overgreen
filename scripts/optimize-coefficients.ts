/**
 * Coefficient Optimizer — finds trait-effect coefficients matching the target matrix.
 * Target matrix defined in: target-matrix.md (16 niches × 40 subtypes, 4 tiers each)
 *
 * Since computeTraitModifier is LINEAR in the coefficients (for fixed genomes/envs),
 * this is a convex optimization: gradient descent on hinge-loss ranking constraints.
 *
 * Usage: npx tsx scripts/optimize-coefficients.ts
 */

import { Genome, TerrainType, archetype } from '../src/types/core';
import { ClimateZone, CLIMATE_ZONE_COUNT } from '../src/types/environment';
import { classifySubtype, SUBTYPE_NAMES } from '../src/types/subtypes';
import {
  EFFECTIVE_ENV, computeTraitModifier, getEnvIdx,
  diagnoseTraitEffects, CellEnvironment,
} from '../src/simulation/trait-effects';

// ── Constants ──

const TERRAIN_COUNT = 6;
const SUBTYPE_COUNT = 40;
const TRAIT_KEYS: (keyof Genome)[] = [
  'rootPriority', 'heightPriority', 'leafSize', 'seedInvestment',
  'seedSize', 'defense', 'woodiness', 'waterStorage', 'longevity',
];
const GRID_VALUES = [0.01, 0.5, 0.99];
const GRID_SIZE = 3 ** 9;

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

function clampToArchetype(g: Genome, arch: number): Genome | null {
  const c = { ...g };
  switch (arch) {
    case 0: // Grass
      c.woodiness = Math.min(c.woodiness, 0.39);
      c.leafSize = Math.min(c.leafSize, 0.49);
      c.waterStorage = Math.min(c.waterStorage, 0.54);
      break;
    case 1: // Shrub
      c.woodiness = Math.max(0.4, Math.min(0.7, c.woodiness));
      c.waterStorage = Math.min(c.waterStorage, 0.54);
      break;
    case 2: // Succulent
      c.waterStorage = Math.max(0.55, c.waterStorage);
      break;
    case 3: // Tree
      c.woodiness = Math.max(0.71, c.woodiness);
      c.waterStorage = Math.min(c.waterStorage, 0.54);
      break;
    case 4: // Forb
      c.woodiness = Math.min(c.woodiness, 0.39);
      c.leafSize = Math.max(0.5, c.leafSize);
      c.waterStorage = Math.min(c.waterStorage, 0.54);
      break;
  }
  if (archetype(c) !== arch) return null;
  return c;
}

// ── Step 1: Generate centroid genomes per subtype ──

log('Generating centroid representative genomes...');

const traitSums: number[][] = Array.from({ length: SUBTYPE_COUNT }, () => new Array(9).fill(0));
const subtypeCounts: number[] = new Array(SUBTYPE_COUNT).fill(0);

for (let arch = 0; arch < 5; arch++) {
  for (let gi = 0; gi < GRID_SIZE; gi++) {
    const vals: number[] = [];
    let idx = gi;
    for (let t = 0; t < 9; t++) {
      vals.push(GRID_VALUES[idx % 3]);
      idx = Math.floor(idx / 3);
    }
    const raw = makeGenome(vals);
    const clamped = clampToArchetype(raw, arch);
    if (!clamped) continue;

    const subId = classifySubtype(clamped) as number;
    const gVals = TRAIT_KEYS.map(k => clamped[k]);
    for (let t = 0; t < 9; t++) traitSums[subId][t] += gVals[t];
    subtypeCounts[subId]++;
  }
}

// Build centroid genomes, verify classification
const repGenomes: (Genome | null)[] = new Array(SUBTYPE_COUNT).fill(null);

for (let s = 0; s < SUBTYPE_COUNT; s++) {
  if (subtypeCounts[s] === 0) {
    log(`WARNING: No grid genomes classify as ${SUBTYPE_NAMES[s]} (#${s})`);
    continue;
  }
  const centroid = makeGenome(traitSums[s].map((v, t) => v / subtypeCounts[s]));
  const classifiedAs = classifySubtype(centroid) as number;
  if (classifiedAs === s) {
    repGenomes[s] = centroid;
  } else {
    // Centroid doesn't classify correctly — find nearest grid genome that does
    log(`  Centroid of ${SUBTYPE_NAMES[s]} classifies as ${SUBTYPE_NAMES[classifiedAs]}, using grid fallback`);
    // Pick the grid genome closest to centroid that classifies correctly
    let bestDist = Infinity;
    for (let arch = 0; arch < 5; arch++) {
      for (let gi = 0; gi < GRID_SIZE; gi++) {
        const vals: number[] = [];
        let idx2 = gi;
        for (let t = 0; t < 9; t++) {
          vals.push(GRID_VALUES[idx2 % 3]);
          idx2 = Math.floor(idx2 / 3);
        }
        const raw = makeGenome(vals);
        const clamped = clampToArchetype(raw, arch);
        if (!clamped) continue;
        if ((classifySubtype(clamped) as number) !== s) continue;
        // Distance to centroid
        let dist = 0;
        const cVals = TRAIT_KEYS.map(k => clamped[k]);
        for (let t = 0; t < 9; t++) dist += (cVals[t] - centroid[TRAIT_KEYS[t]]) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          repGenomes[s] = clamped;
        }
      }
    }
    if (!repGenomes[s]) log(`  FAILED: No fallback for ${SUBTYPE_NAMES[s]}`);
  }
}

const activeSubtypes = repGenomes.map((g, i) => g ? i : -1).filter(i => i >= 0);
log(`Representative genomes: ${activeSubtypes.length}/${SUBTYPE_COUNT}`);

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

out('');
log('Done.');
