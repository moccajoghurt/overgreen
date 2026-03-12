/**
 * Quick feasibility check: can independent weight vectors (one per niche)
 * rank the 40 prototype genomes correctly?
 *
 * If YES per-niche: the problem is feasible, the optimizer is broken.
 * If NO per-niche: the genomes themselves can't be separated in 9D.
 *
 * Uses simple gradient descent per niche (independent, no coupling).
 *
 * Usage: npx tsx scripts/balance-tuning/check-feasibility.ts
 */

import { Genome, archetype } from '../../src/types/core';
import { classifySubtype, SUBTYPE_NAMES } from '../../src/types/subtypes';

const SUBTYPE_COUNT = 40;
const TRAIT_KEYS: (keyof Genome)[] = [
  'rootPriority', 'heightPriority', 'leafSize', 'seedInvestment',
  'seedSize', 'defense', 'woodiness', 'waterStorage', 'longevity',
];
const D = TRAIT_KEYS.length; // 9

function makeGenome(vals: number[]): Genome {
  return {
    rootPriority: vals[0], heightPriority: vals[1], leafSize: vals[2],
    seedInvestment: vals[3], seedSize: vals[4], defense: vals[5],
    woodiness: vals[6], waterStorage: vals[7], longevity: vals[8],
  };
}

function ids(...names: string[]): number[] {
  return names.map(n => {
    const id = SUBTYPE_NAMES.indexOf(n);
    if (id < 0) throw new Error(`Unknown subtype: "${n}"`);
    return id;
  });
}

// ── Prototype genomes (same as optimizer) ──
const PROTOTYPES: Record<number, number[]> = {
  0:  [0.05, 0.05, 0.05, 0.50, 0.50, 0.50, 0.05, 0.05, 0.05],
  1:  [0.50, 0.95, 0.49, 0.50, 0.50, 0.05, 0.05, 0.05, 0.95],
  2:  [0.95, 0.05, 0.05, 0.95, 0.95, 0.05, 0.05, 0.05, 0.95],
  3:  [0.95, 0.95, 0.05, 0.05, 0.50, 0.05, 0.39, 0.05, 0.95],
  4:  [0.95, 0.05, 0.49, 0.95, 0.05, 0.05, 0.05, 0.05, 0.05],
  5:  [0.05, 0.95, 0.49, 0.05, 0.05, 0.05, 0.05, 0.05, 0.50],
  30: [0.95, 0.95, 0.05, 0.05, 0.50, 0.95, 0.05, 0.05, 0.95],
  31: [0.95, 0.05, 0.05, 0.05, 0.50, 0.05, 0.05, 0.54, 0.95],
  6:  [0.95, 0.50, 0.95, 0.05, 0.50, 0.95, 0.80, 0.05, 0.95],
  7:  [0.50, 0.05, 0.95, 0.05, 0.50, 0.05, 0.80, 0.05, 0.95],
  8:  [0.05, 0.95, 0.05, 0.05, 0.50, 0.50, 0.80, 0.05, 0.95],
  9:  [0.05, 0.95, 0.95, 0.05, 0.50, 0.95, 0.80, 0.05, 0.50],
  10: [0.05, 0.95, 0.05, 0.50, 0.50, 0.05, 0.80, 0.05, 0.50],
  11: [0.05, 0.95, 0.50, 0.95, 0.50, 0.05, 0.80, 0.05, 0.05],
  32: [0.95, 0.95, 0.05, 0.05, 0.50, 0.50, 0.95, 0.05, 0.95],
  33: [0.95, 0.05, 0.05, 0.95, 0.50, 0.95, 0.80, 0.05, 0.05],
  12: [0.50, 0.05, 0.95, 0.05, 0.50, 0.95, 0.55, 0.05, 0.95],
  13: [0.50, 0.50, 0.50, 0.95, 0.50, 0.05, 0.55, 0.05, 0.05],
  14: [0.05, 0.50, 0.05, 0.05, 0.50, 0.05, 0.70, 0.54, 0.95],
  15: [0.95, 0.05, 0.95, 0.05, 0.50, 0.95, 0.55, 0.05, 0.50],
  16: [0.95, 0.05, 0.05, 0.50, 0.50, 0.05, 0.55, 0.05, 0.95],
  17: [0.05, 0.95, 0.95, 0.50, 0.50, 0.05, 0.55, 0.05, 0.05],
  34: [0.05, 0.50, 0.95, 0.95, 0.50, 0.05, 0.55, 0.05, 0.95],
  35: [0.50, 0.05, 0.05, 0.05, 0.50, 0.95, 0.55, 0.05, 0.95],
  18: [0.50, 0.95, 0.05, 0.05, 0.50, 0.50, 0.50, 0.95, 0.95],
  19: [0.50, 0.05, 0.95, 0.05, 0.50, 0.05, 0.50, 0.95, 0.50],
  20: [0.95, 0.05, 0.05, 0.50, 0.50, 0.05, 0.50, 0.95, 0.50],
  21: [0.05, 0.95, 0.50, 0.95, 0.50, 0.95, 0.50, 0.60, 0.50],
  22: [0.05, 0.05, 0.50, 0.95, 0.50, 0.05, 0.50, 0.60, 0.05],
  23: [0.05, 0.05, 0.95, 0.05, 0.50, 0.05, 0.50, 0.60, 0.50],
  36: [0.95, 0.05, 0.05, 0.05, 0.50, 0.95, 0.50, 0.95, 0.50],
  37: [0.95, 0.05, 0.95, 0.05, 0.50, 0.05, 0.50, 0.60, 0.95],
  24: [0.05, 0.05, 0.95, 0.95, 0.50, 0.05, 0.10, 0.05, 0.50],
  25: [0.95, 0.95, 0.95, 0.05, 0.50, 0.05, 0.10, 0.05, 0.95],
  26: [0.95, 0.05, 0.95, 0.05, 0.50, 0.05, 0.10, 0.05, 0.95],
  27: [0.05, 0.95, 0.50, 0.95, 0.50, 0.05, 0.10, 0.05, 0.50],
  28: [0.95, 0.05, 0.50, 0.95, 0.50, 0.05, 0.10, 0.05, 0.05],
  29: [0.95, 0.05, 0.50, 0.05, 0.50, 0.05, 0.10, 0.54, 0.50],
  38: [0.50, 0.95, 0.95, 0.05, 0.50, 0.95, 0.10, 0.05, 0.95],
  39: [0.05, 0.50, 0.50, 0.95, 0.50, 0.05, 0.10, 0.05, 0.05],
};

// Genome vectors as flat arrays
const genomeVecs: Float64Array[] = new Array(SUBTYPE_COUNT);
for (const [idStr, vals] of Object.entries(PROTOTYPES)) {
  genomeVecs[Number(idStr)] = new Float64Array(vals);
}

// ── Target matrix ──
interface NicheTarget {
  label: string;
  dominant: number[]; common: number[]; minor: number[];
}

const TARGETS: NicheTarget[] = [
  { label: 'Temp/Soil', dominant: ids('Oak', 'Birch', 'Hazel'), common: ids('Holly', 'Bramble', 'Wildflower', 'Fern', 'Clover', 'Moss', 'Tallgrass'), minor: ids('Magnolia', 'Turfgrass', 'Ryegrass', 'Tall Herb', 'Vine') },
  { label: 'Trop/Soil', dominant: ids('Tropical', 'Palm', 'Magnolia', 'Tropical Herb', 'Fern'), common: ids('Vine', 'Bamboo', 'Flowering Shrub', 'Tall Herb', 'Moss', 'Epiphytic'), minor: ids('Tallgrass', 'Bramble', 'Clover') },
  { label: 'Med/Soil', dominant: ids('Mediterranean', 'Aromatic', 'Cypress', 'Oak'), common: ids('Holly', 'Wildflower', 'Clover', 'Turfgrass', 'Ryegrass'), minor: ids('Aloe', 'Euphorbia', 'Bramble', 'Tall Herb', 'Bunchgrass', 'Acacia') },
  { label: 'Des/Soil', dominant: ids('Saltbush', 'Acacia', 'Desert Grass', 'Desert Annual'), common: ids('Saguaro', 'Barrel Cactus', 'Aloe', 'Euphorbia', 'Jade', 'Aromatic'), minor: ids('Bunchgrass', 'Caudiciform', 'Pampas') },
  { label: 'Temp/Hill', dominant: ids('Bunchgrass', 'Turfgrass', 'Wildflower', 'Clover'), common: ids('Ryegrass', 'Moss', 'Tallgrass', 'Holly'), minor: ids('Conifer', 'Aromatic', 'Fern', 'Tall Herb') },
  { label: 'Trop/Hill', dominant: ids('Bunchgrass', 'Tropical Herb', 'Fern', 'Conifer'), common: ids('Wildflower', 'Moss', 'Flowering Shrub', 'Epiphytic', 'Bamboo'), minor: ids('Tall Herb', 'Vine', 'Clover') },
  { label: 'Med/Hill', dominant: ids('Bunchgrass', 'Mediterranean', 'Aromatic'), common: ids('Wildflower', 'Turfgrass', 'Clover', 'Cypress'), minor: ids('Euphorbia', 'Barrel Cactus', 'Holly', 'Ryegrass') },
  { label: 'Des/Hill', dominant: ids('Saguaro', 'Barrel Cactus', 'Desert Grass', 'Bunchgrass'), common: ids('Desert Annual', 'Euphorbia', 'Saltbush', 'Aloe'), minor: ids('Caudiciform', 'Aromatic', 'Jade') },
  { label: 'Temp/Wetl', dominant: ids('Birch', 'Cypress', 'Sedge', 'Fern'), common: ids('Oak', 'Mangrove', 'Hazel', 'Moss', 'Tall Herb', 'Wildflower', 'Tallgrass'), minor: ids('Bramble', 'Clover', 'Ryegrass', 'Holly') },
  { label: 'Trop/Wetl', dominant: ids('Tropical', 'Palm', 'Mangrove', 'Fern', 'Bamboo'), common: ids('Magnolia', 'Vine', 'Tropical Herb', 'Sedge', 'Moss', 'Tall Herb'), minor: ids('Flowering Shrub', 'Epiphytic', 'Tallgrass') },
  { label: 'Med/Wetl', dominant: ids('Cypress', 'Mangrove', 'Sedge', 'Fern'), common: ids('Birch', 'Wildflower', 'Ryegrass', 'Tallgrass', 'Moss'), minor: ids('Mediterranean', 'Holly', 'Tall Herb', 'Clover') },
  { label: 'Des/Wetl', dominant: ids('Palm', 'Acacia', 'Sedge', 'Tallgrass'), common: ids('Fern', 'Ryegrass', 'Mangrove', 'Moss'), minor: ids('Saltbush', 'Wildflower', 'Clover') },
  { label: 'Temp/Arid', dominant: ids('Saltbush', 'Aromatic', 'Desert Grass', 'Bunchgrass'), common: ids('Aloe', 'Jade', 'Euphorbia', 'Ryegrass', 'Desert Annual', 'Holly'), minor: ids('Acacia', 'Caudiciform', 'Saguaro', 'Wildflower', 'Clover') },
  { label: 'Trop/Arid', dominant: ids('Acacia', 'Aloe', 'Euphorbia', 'Pampas'), common: ids('Saltbush', 'Desert Grass', 'Saguaro', 'Jade', 'Desert Annual', 'Tropical Herb'), minor: ids('Barrel Cactus', 'Caudiciform', 'Bunchgrass', 'Aromatic') },
  { label: 'Med/Arid', dominant: ids('Barrel Cactus', 'Saguaro', 'Aromatic', 'Mediterranean'), common: ids('Aloe', 'Euphorbia', 'Desert Grass', 'Desert Annual', 'Saltbush'), minor: ids('Jade', 'Caudiciform', 'Bunchgrass', 'Acacia', 'Wildflower') },
  { label: 'Des/Arid', dominant: ids('Saguaro', 'Barrel Cactus'), common: ids('Desert Grass', 'Desert Annual'), minor: ids('Saltbush', 'Euphorbia', 'Jade', 'Caudiciform') },
];

// ── Per-niche feasibility check ──
// For each niche independently: find w ∈ R^9 such that
//   w · g_dominant > w · g_common > w · g_minor > w · g_absent
// Using gradient descent on hinge loss (no coupling between niches).

const MARGIN = 0.05;
const LR = 0.01;
const ITERS = 50000;

console.log('Per-niche feasibility check (independent w per niche, 9D):');
console.log('');

let totalViolations = 0;
let totalConstraints = 0;
let nichesFullySolved = 0;

for (let ni = 0; ni < TARGETS.length; ni++) {
  const t = TARGETS[ni];

  // Assign tiers
  const tier = new Int8Array(SUBTYPE_COUNT); // 0 = absent
  for (const s of t.dominant) tier[s] = 3;
  for (const s of t.common)   tier[s] = 2;
  for (const s of t.minor)    tier[s] = 1;

  // Build pairwise constraints for this niche
  interface C { high: number; low: number; margin: number; }
  const cs: C[] = [];
  for (let a = 0; a < SUBTYPE_COUNT; a++) {
    if (!genomeVecs[a]) continue;
    for (let b = 0; b < SUBTYPE_COUNT; b++) {
      if (!genomeVecs[b]) continue;
      if (tier[a] > tier[b]) {
        cs.push({ high: a, low: b, margin: (tier[a] - tier[b]) * MARGIN });
      }
    }
  }
  totalConstraints += cs.length;

  // Gradient descent for this niche: find w ∈ R^9
  const w = new Float64Array(D); // start at 0

  for (let iter = 0; iter < ITERS; iter++) {
    const grad = new Float64Array(D);
    for (const c of cs) {
      const gh = genomeVecs[c.high];
      const gl = genomeVecs[c.low];
      // score_high = w · gh, score_low = w · gl
      // violation = score_low - score_high + margin
      let diff = 0;
      for (let d = 0; d < D; d++) diff += w[d] * (gh[d] - gl[d]);
      const violation = -diff + c.margin;
      if (violation > 0) {
        for (let d = 0; d < D; d++) {
          grad[d] += 2 * violation * (gl[d] - gh[d]);
        }
      }
    }
    // L2 reg (tiny)
    for (let d = 0; d < D; d++) {
      grad[d] += 0.0001 * w[d];
    }
    for (let d = 0; d < D; d++) {
      w[d] -= LR * grad[d];
    }
  }

  // Count violations
  let viol = 0;
  for (const c of cs) {
    let diff = 0;
    for (let d = 0; d < D; d++) diff += w[d] * (genomeVecs[c.high][d] - genomeVecs[c.low][d]);
    if (diff < c.margin) viol++;
  }
  totalViolations += viol;
  if (viol === 0) nichesFullySolved++;

  const status = viol === 0 ? '✓' : '✗';
  console.log(`  ${status} ${t.label.padEnd(12)} ${viol}/${cs.length} violations`);

  if (viol > 0) {
    // Show which pairs fail
    const failed: string[] = [];
    for (const c of cs) {
      let diff = 0;
      for (let d = 0; d < D; d++) diff += w[d] * (genomeVecs[c.high][d] - genomeVecs[c.low][d]);
      if (diff < c.margin) {
        const tH = tier[c.high] === 3 ? 'DOM' : tier[c.high] === 2 ? 'COM' : 'MIN';
        const tL = tier[c.low] === 3 ? 'DOM' : tier[c.low] === 2 ? 'COM' : tier[c.low] === 1 ? 'MIN' : 'ABS';
        failed.push(`${SUBTYPE_NAMES[c.high]}[${tH}]>${SUBTYPE_NAMES[c.low]}[${tL}]`);
      }
    }
    if (failed.length <= 10) {
      console.log(`    ${failed.join(', ')}`);
    } else {
      console.log(`    ${failed.slice(0, 10).join(', ')} ... +${failed.length - 10} more`);
    }
  }
}

console.log('');
console.log(`Niches fully solved: ${nichesFullySolved}/${TARGETS.length}`);
console.log(`Total violations: ${totalViolations}/${totalConstraints}`);
console.log('');
console.log('If all niches solve independently: the trait-effects coupling is the bottleneck.');
console.log('If niches fail independently: the 9D genomes themselves can\'t be separated.');
