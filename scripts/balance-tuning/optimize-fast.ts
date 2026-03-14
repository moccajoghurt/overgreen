/**
 * Fast coefficient optimizer — pre-computes baseline representative genomes,
 * then searches for new zero-mean pair coefficients using fast re-ranking.
 *
 * Phase 1: Pre-compute baseline genomes (slow, once)
 * Phase 2: Nelder-Mead search using fast re-ranking (instant per eval)
 * Phase 3: Validate best result with full grid search
 *
 * Usage: npx tsx scripts/balance-tuning/optimize-fast.ts
 */

import { Genome, archetype, Archetype } from '../../src/types/core';
import { CLIMATE_ZONE_COUNT } from '../../src/types/environment';
import { classifySubtype, SUBTYPE_NAMES, subtypeArchetype, SubtypeId } from '../../src/types/subtypes';
import { CellEnvironment, EFFECTIVE_ENV, getEnvIdx, computeTraitModifier } from '../../src/simulation/trait-effects';
import { EXCLUDED, STRONG_ARCHETYPES, isExcluded } from './lib/target-matrix';

// ── Constants ──
const TERRAIN_COUNT = 6;
const SUBTYPE_COUNT = 40;
const GRID_VALUES = [0.01, 0.5, 0.99];
const GRID_SIZE = Math.pow(3, 9);

interface Niche { cz: number; tt: number; label: string; }
const CLIMATE_NAMES = ['Temperate', 'Tropical', 'Mediterr', 'Desert'];
const TERRAIN_NAMES = ['Soil', 'River', 'Rock', 'Hill', 'Wetland', 'Arid'];

const TARGET_NICHES: Niche[] = [];
for (let cz = 0; cz < CLIMATE_ZONE_COUNT; cz++) {
  for (let tt = 0; tt < TERRAIN_COUNT; tt++) {
    if (tt === 1 || tt === 2) continue;
    TARGET_NICHES.push({ cz, tt, label: `${CLIMATE_NAMES[cz]}/${TERRAIN_NAMES[tt]}` });
  }
}

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
    case 0: c.woodiness = Math.min(c.woodiness, 0.39); c.leafSize = Math.min(c.leafSize, 0.49); c.waterStorage = Math.min(c.waterStorage, 0.54); break;
    case 1: c.woodiness = Math.max(0.4, Math.min(0.7, c.woodiness)); c.waterStorage = Math.min(c.waterStorage, 0.54); break;
    case 2: c.waterStorage = Math.max(0.55, c.waterStorage); break;
    case 3: c.woodiness = Math.max(0.71, c.woodiness); c.waterStorage = Math.min(c.waterStorage, 0.54); break;
    case 4: c.woodiness = Math.min(c.woodiness, 0.39); c.leafSize = Math.max(0.5, c.leafSize); c.waterStorage = Math.min(c.waterStorage, 0.54); break;
  }
  if (archetype(c) !== arch) return null;
  return c;
}

// ── Trait effect types ──
type GenomeTrait = keyof Genome;
type EnvVar = keyof CellEnvironment;

interface TraitEffect {
  trait: GenomeTrait;
  trait2?: GenomeTrait;
  trait3?: GenomeTrait;
  envVar: EnvVar | null;
  coefficient: number;
  inverse?: boolean;
  inverse2?: boolean;
  inverse3?: boolean;
  peaked?: number;
}

function evalTrait(genome: Genome, trait: GenomeTrait, inverse?: boolean, peaked?: number): number {
  const raw = inverse ? 1 - genome[trait] : genome[trait];
  if (peaked !== undefined) return Math.max(0, 1 - 2 * Math.abs(raw - peaked));
  return raw;
}

function computeNewMod(genome: Genome, env: CellEnvironment, effects: TraitEffect[]): number {
  let modifier = 0;
  for (const e of effects) {
    const t1 = evalTrait(genome, e.trait, e.inverse, e.peaked);
    const t2 = e.trait2 !== undefined ? evalTrait(genome, e.trait2, e.inverse2) : 1;
    const t3 = e.trait3 !== undefined ? evalTrait(genome, e.trait3, e.inverse3) : 1;
    const envVal = e.envVar !== null ? env[e.envVar] : 1;
    modifier += t1 * t2 * t3 * envVal * e.coefficient;
  }
  return modifier;
}

// ── Phase 1: Pre-compute baseline representative genomes ──
console.log('Phase 1: Computing baseline representative genomes...');
const t0 = Date.now();

const repGenomes: (Genome | null)[] = new Array(SUBTYPE_COUNT).fill(null);
const repScores: number[] = new Array(SUBTYPE_COUNT).fill(-Infinity);

for (let arch = 0; arch < 5; arch++) {
  for (let gi = 0; gi < GRID_SIZE; gi++) {
    const vals: number[] = [];
    let idx = gi;
    for (let t = 0; t < 9; t++) { vals.push(GRID_VALUES[idx % 3]); idx = Math.floor(idx / 3); }
    const raw = makeGenome(vals);
    const clamped = clampToArchetype(raw, arch);
    if (!clamped) continue;
    const subId = classifySubtype(clamped) as number;
    let sum = 0;
    for (const n of TARGET_NICHES) {
      sum += computeTraitModifier(clamped, EFFECTIVE_ENV[getEnvIdx(n.cz, n.tt)]);
    }
    const score = sum / TARGET_NICHES.length;
    if (score > repScores[subId]) { repScores[subId] = score; repGenomes[subId] = clamped; }
  }
}

// Pre-compute baseline modifiers per subtype per niche
const baselineMods: number[][] = []; // [subtype][nicheIdx]
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  baselineMods[s] = [];
  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    if (!repGenomes[s]) { baselineMods[s][ni] = -999; continue; }
    const n = TARGET_NICHES[ni];
    baselineMods[s][ni] = computeTraitModifier(repGenomes[s]!, EFFECTIVE_ENV[getEnvIdx(n.cz, n.tt)]);
  }
}

console.log(`  Done in ${Date.now() - t0}ms`);

// Verify baseline score
function scoreFromMods(mods: number[][]): { overall: number; exclusion: number; archetype: number; violations: number; misses: number } {
  let exclusionViolations = 0;
  let exclusionTotal = 0;
  let archetypeHits = 0;
  let archetypeTotal = 0;

  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    const niche = TARGET_NICHES[ni];
    const entries: { name: string; mod: number; arch: Archetype }[] = [];
    for (let s = 0; s < SUBTYPE_COUNT; s++) {
      if (!repGenomes[s]) continue;
      entries.push({ name: SUBTYPE_NAMES[s], mod: mods[s][ni], arch: subtypeArchetype(s as SubtypeId) });
    }
    entries.sort((a, b) => b.mod - a.mod);
    const top5 = entries.slice(0, 5);

    for (const r of top5) {
      if (isExcluded(niche.label, r.name)) exclusionViolations++;
    }
    const excludedSet = EXCLUDED[niche.label];
    if (excludedSet) {
      for (let s = 0; s < SUBTYPE_COUNT; s++) {
        if (repGenomes[s] && excludedSet.has(SUBTYPE_NAMES[s])) exclusionTotal++;
      }
    }

    const strongArchs = STRONG_ARCHETYPES[niche.label] ?? [];
    for (const arch of strongArchs) {
      archetypeTotal++;
      if (top5.some(r => r.arch === arch && r.mod > 0)) archetypeHits++;
    }
  }

  const exclusionScore = exclusionTotal > 0 ? ((exclusionTotal - exclusionViolations) / exclusionTotal) * 100 : 100;
  const archetypeScore = archetypeTotal > 0 ? (archetypeHits / archetypeTotal) * 100 : 100;
  return {
    overall: exclusionScore * 0.60 + archetypeScore * 0.40,
    exclusion: exclusionScore,
    archetype: archetypeScore,
    violations: exclusionViolations,
    misses: archetypeTotal - archetypeHits,
  };
}

const baseline = scoreFromMods(baselineMods);
console.log(`  Baseline: ${baseline.overall.toFixed(1)}% (excl=${baseline.exclusion.toFixed(1)}%, arch=${baseline.archetype.toFixed(1)}%, violations=${baseline.violations}, misses=${baseline.misses})`);

// ── Phase 2: Define optimization slots ──

// Pre-compute env var means
const envMeans: Record<string, number> = {};
const envVarNames: EnvVar[] = ['droughtStress','frostRisk','diseasePressure','windExposure','waterlogging','heatStress','soilFertility','extremeAridity','tropicality','winterHarshness','seasonality','shallowSoil','mediterraneity','coolWetland','continentalDrought','desertSoilHeat'];
for (const v of envVarNames) {
  let sum = 0;
  for (const n of TARGET_NICHES) sum += EFFECTIVE_ENV[getEnvIdx(n.cz, n.tt)][v];
  envMeans[v] = sum / TARGET_NICHES.length;
}

interface EffectSlot {
  label: string;
  effect: Omit<TraitEffect, 'coefficient'>;
  compensatorEnvVar: EnvVar;
}

const SLOTS: EffectSlot[] = [
  // Slot 0: DA wetland penalty — highly selective (DA product=0.49, Clover=0.01, most others≈0)
  { label: 'DA-wetland',
    effect: { trait: 'seedInvestment', trait2: 'longevity', inverse2: true, trait3: 'rootPriority', inverse3: true, envVar: 'waterlogging' },
    compensatorEnvVar: 'extremeAridity' },
  // Slot 1: Annual herb wetland — DA product=0.97 via (1-long)×leaf, Fern=0.01
  { label: 'annual-herb-wetl',
    effect: { trait: 'longevity', inverse: true, trait2: 'leafSize', trait3: 'woodiness', inverse3: true, envVar: 'waterlogging' },
    compensatorEnvVar: 'extremeAridity' },
  // Slot 2: Pampas penalty — Pampas (1-seedSize)×(1-wood)=0.495, others≈0.01
  { label: 'pampas-penalty',
    effect: { trait: 'seedSize', inverse: true, trait2: 'woodiness', inverse2: true, envVar: 'winterHarshness' },
    compensatorEnvVar: 'continentalDrought' },
  // Slot 3: Forb med suppression — leaf×(1-wood)×mediterraneity, boosts in seasonality
  { label: 'forb-med-suppress',
    effect: { trait: 'leafSize', trait2: 'woodiness', inverse2: true, envVar: 'mediterraneity' },
    compensatorEnvVar: 'continentalDrought' },
  // Slot 4: Peaked shrub desert — peaked(wood,0.40) × desertSoilHeat
  { label: 'peaked-shrub-des',
    effect: { trait: 'woodiness', peaked: 0.40, envVar: 'desertSoilHeat' },
    compensatorEnvVar: 'extremeAridity' },
  // Slot 5: Shallow-root peaked-shrub tropical — Holly (peaked=1.0, 1-root=0.99) product=0.99
  { label: 'shallowShrub-trop',
    effect: { trait: 'woodiness', peaked: 0.40, trait2: 'rootPriority', inverse2: true, envVar: 'tropicality' },
    compensatorEnvVar: 'winterHarshness' },
  // Slot 6: Deep-root herb mediterraneity — Fern/Bunchgrass (root=0.99) boost
  { label: 'deepHerb-med',
    effect: { trait: 'rootPriority', trait2: 'woodiness', inverse2: true, envVar: 'mediterraneity' },
    compensatorEnvVar: 'continentalDrought' },
  // Slot 7: Succulent continental drought — Barrel Cactus (wStor=0.55)
  { label: 'succ-contDrought',
    effect: { trait: 'waterStorage', envVar: 'continentalDrought' },
    compensatorEnvVar: 'waterlogging' },
  // Slot 8: Low-root tall tree tropical — h×l×w×tropicality. Tropical Tree=0.351, Magnolia=0.007
  { label: 'tallLeafTree-trop',
    effect: { trait: 'heightPriority', trait2: 'leafSize', trait3: 'woodiness', envVar: 'tropicality' },
    compensatorEnvVar: 'winterHarshness' },
  // Slot 9: Leafy herb waterlogging — forbs in wetlands via leaf×(1-wood)×waterlogging
  { label: 'leafHerb-waterlog',
    effect: { trait: 'leafSize', trait2: 'woodiness', inverse2: true, envVar: 'waterlogging' },
    compensatorEnvVar: 'extremeAridity' },
  // Slot 10: Deep peaked-shrub desert heat — Aromatic (peaked=1.0, root=0.99)=0.99
  { label: 'deepShrub-desHeat',
    effect: { trait: 'woodiness', peaked: 0.40, trait2: 'rootPriority', envVar: 'desertSoilHeat' },
    compensatorEnvVar: 'extremeAridity' },
  // Slot 11: Root×wood×(1-leaf)×tropicality — Acacia (0.99×0.71×0.99=0.696), minimal for others
  { label: 'acaciaType-trop',
    effect: { trait: 'rootPriority', trait2: 'woodiness', trait3: 'leafSize', inverse3: true, envVar: 'tropicality' },
    compensatorEnvVar: 'winterHarshness' },
];

// Pre-compute trait products for each slot × subtype (constant for fixed genomes)
// and env values per niche for fast evaluation
interface SlotCache {
  traitProducts: number[];  // [SUBTYPE_COUNT]
  primaryEnvValues: number[];  // [TARGET_NICHES.length]
  compensatorEnvValues: number[];  // [TARGET_NICHES.length]
  envMeanRatio: number;  // primary_mean / compensator_mean
}

const slotCaches: SlotCache[] = SLOTS.map(slot => {
  const traitProducts: number[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) { traitProducts.push(0); continue; }
    const g = repGenomes[s]!;
    const e = slot.effect;
    const t1 = evalTrait(g, e.trait, e.inverse, e.peaked);
    const t2 = e.trait2 !== undefined ? evalTrait(g, e.trait2, e.inverse2) : 1;
    const t3 = e.trait3 !== undefined ? evalTrait(g, e.trait3, e.inverse3) : 1;
    traitProducts.push(t1 * t2 * t3);
  }

  const primaryEnvValues: number[] = [];
  const compensatorEnvValues: number[] = [];
  for (const n of TARGET_NICHES) {
    const env = EFFECTIVE_ENV[getEnvIdx(n.cz, n.tt)];
    primaryEnvValues.push(slot.effect.envVar ? env[slot.effect.envVar] : 1);
    compensatorEnvValues.push(env[slot.compensatorEnvVar]);
  }

  return {
    traitProducts,
    primaryEnvValues,
    compensatorEnvValues,
    envMeanRatio: envMeans[slot.effect.envVar || 'droughtStress'] / envMeans[slot.compensatorEnvVar],
  };
});

// ── Fast evaluation function ──
function fastEvaluate(coeffs: number[]): number {
  // Build modified modifiers: baseline + sum of slot effects
  const mods: number[][] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    mods[s] = [];
    for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
      let mod = baselineMods[s][ni];
      for (let si = 0; si < SLOTS.length; si++) {
        const c = coeffs[si];
        if (Math.abs(c) < 0.0001) continue;
        const cache = slotCaches[si];
        const tp = cache.traitProducts[s];
        if (tp === 0) continue;
        // Primary effect
        mod += tp * cache.primaryEnvValues[ni] * c;
        // Compensator (zero-mean)
        mod += tp * cache.compensatorEnvValues[ni] * (-c * cache.envMeanRatio);
      }
      mods[s][ni] = mod;
    }
  }
  return scoreFromMods(mods).overall;
}

// ── Nelder-Mead ──
function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  opts: { maxIter?: number; initialStep?: number } = {}
): { x: number[]; score: number } {
  const { maxIter = 600, initialStep = 0.5 } = opts;
  const n = x0.length;

  const simplex: { x: number[]; score: number }[] = [];
  simplex.push({ x: [...x0], score: f(x0) });
  for (let i = 0; i < n; i++) {
    const xi = [...x0];
    xi[i] += initialStep;
    simplex.push({ x: xi, score: f(xi) });
  }

  for (let iter = 0; iter < maxIter; iter++) {
    simplex.sort((a, b) => b.score - a.score);
    const best = simplex[0];
    const worst = simplex[n];
    const secondWorst = simplex[n - 1];

    if (best.score - worst.score < 0.001 && iter > 50) break;

    if (iter % 100 === 0) {
      process.stdout.write(`  iter ${iter}: best=${best.score.toFixed(2)}%\n`);
    }

    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) centroid[j] += simplex[i].x[j];
    }
    for (let j = 0; j < n; j++) centroid[j] /= n;

    const reflected = centroid.map((c, j) => c + 1.0 * (c - worst.x[j]));
    const reflectedScore = f(reflected);

    if (reflectedScore > best.score) {
      const expanded = centroid.map((c, j) => c + 2.0 * (reflected[j] - c));
      const expandedScore = f(expanded);
      simplex[n] = expandedScore > reflectedScore
        ? { x: expanded, score: expandedScore }
        : { x: reflected, score: reflectedScore };
    } else if (reflectedScore > secondWorst.score) {
      simplex[n] = { x: reflected, score: reflectedScore };
    } else {
      const contracted = centroid.map((c, j) => c + 0.5 * (worst.x[j] - c));
      const contractedScore = f(contracted);
      if (contractedScore > worst.score) {
        simplex[n] = { x: contracted, score: contractedScore };
      } else {
        for (let i = 1; i <= n; i++) {
          for (let j = 0; j < n; j++) {
            simplex[i].x[j] = best.x[j] + 0.5 * (simplex[i].x[j] - best.x[j]);
          }
          simplex[i].score = f(simplex[i].x);
        }
      }
    }
  }

  simplex.sort((a, b) => b.score - a.score);
  return simplex[0];
}

// ── Phase 2: Run optimization ──
console.log('\nPhase 2: Optimizing coefficients...');

const x0 = new Array(SLOTS.length).fill(0);
console.log(`  Baseline fast score: ${fastEvaluate(x0).toFixed(2)}%`);

let bestResult = { x: x0, score: fastEvaluate(x0) };

// Multiple restarts
for (let run = 0; run < 5; run++) {
  const start = run === 0 ? [...x0] : bestResult.x.map(c => c + (Math.random() - 0.5) * 2.0);
  const step = run === 0 ? 1.0 : 0.5;
  console.log(`\n  Run ${run + 1}:`);
  const result = nelderMead(fastEvaluate, start, { maxIter: 800, initialStep: step });
  console.log(`  Result: ${result.score.toFixed(2)}%`);
  if (result.score > bestResult.score) bestResult = result;
}

console.log('\n════════════════════════════════════════');
console.log(`Best fast score: ${bestResult.score.toFixed(2)}%`);
console.log('\nOptimal slot coefficients:');
for (let i = 0; i < SLOTS.length; i++) {
  const c = bestResult.x[i];
  if (Math.abs(c) < 0.01) continue;
  const slot = SLOTS[i];
  const compCoeff = -c * slotCaches[i].envMeanRatio;
  console.log(`  [${i}] ${slot.label}: ${c >= 0 ? '+' : ''}${c.toFixed(3)} (comp: ${compCoeff >= 0 ? '+' : ''}${compCoeff.toFixed(3)} on ${slot.compensatorEnvVar})`);
}

// ── Phase 3: Generate code to paste ──
console.log('\n// ── Paste into trait-effects.ts before "Tall succulent wetland suppression" ──\n');
for (let i = 0; i < SLOTS.length; i++) {
  const c = bestResult.x[i];
  if (Math.abs(c) < 0.05) continue;
  const slot = SLOTS[i];
  const cache = slotCaches[i];
  const compCoeff = -c * cache.envMeanRatio;

  const makeEntry = (envVar: string, coeff: number) => {
    const parts: string[] = [];
    parts.push(`trait: '${slot.effect.trait}'`);
    if (slot.effect.trait2) parts.push(`trait2: '${slot.effect.trait2}'`);
    if (slot.effect.trait3) parts.push(`trait3: '${slot.effect.trait3}'`);
    if (slot.effect.inverse) parts.push('inverse: true');
    if (slot.effect.inverse2) parts.push('inverse2: true');
    if (slot.effect.inverse3) parts.push('inverse3: true');
    if (slot.effect.peaked !== undefined) parts.push(`peaked: ${slot.effect.peaked}`);
    parts.push(`envVar: '${envVar}'`);
    parts.push(`coefficient: ${coeff >= 0 ? '+' : ''}${coeff.toFixed(3)}`);
    parts.push(`description: '${slot.label}'`);
    return `  { ${parts.join(', ')} },`;
  };

  console.log(`  // ${slot.label} — zero-mean pair`);
  console.log(makeEntry(slot.effect.envVar!, c));
  console.log(makeEntry(slot.compensatorEnvVar, compCoeff));
}

// Show score breakdown
console.log('\n  Score breakdown with optimal coefficients:');
const finalMods: number[][] = [];
for (let s = 0; s < SUBTYPE_COUNT; s++) {
  finalMods[s] = [];
  for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
    let mod = baselineMods[s][ni];
    for (let si = 0; si < SLOTS.length; si++) {
      const c = bestResult.x[si];
      if (Math.abs(c) < 0.0001) continue;
      const cache = slotCaches[si];
      const tp = cache.traitProducts[s];
      if (tp === 0) continue;
      mod += tp * cache.primaryEnvValues[ni] * c;
      mod += tp * cache.compensatorEnvValues[ni] * (-c * cache.envMeanRatio);
    }
    finalMods[s][ni] = mod;
  }
}

const finalScore = scoreFromMods(finalMods);
console.log(`  Overall: ${finalScore.overall.toFixed(1)}%`);
console.log(`  Exclusion: ${finalScore.exclusion.toFixed(1)}% (violations: ${finalScore.violations})`);
console.log(`  Archetype: ${finalScore.archetype.toFixed(1)}% (misses: ${finalScore.misses})`);

// Per-niche details
for (let ni = 0; ni < TARGET_NICHES.length; ni++) {
  const niche = TARGET_NICHES[ni];
  const entries: { name: string; mod: number; arch: Archetype }[] = [];
  for (let s = 0; s < SUBTYPE_COUNT; s++) {
    if (!repGenomes[s]) continue;
    entries.push({ name: SUBTYPE_NAMES[s], mod: finalMods[s][ni], arch: subtypeArchetype(s as SubtypeId) });
  }
  entries.sort((a, b) => b.mod - a.mod);
  const top5 = entries.slice(0, 5);

  const problems: string[] = [];
  for (const r of top5) {
    if (isExcluded(niche.label, r.name)) problems.push(`EXCL:${r.name}`);
  }
  const strongArchs = STRONG_ARCHETYPES[niche.label] ?? [];
  for (const arch of strongArchs) {
    if (!top5.some(r => r.arch === arch && r.mod > 0)) {
      const archNames = ['Grass', 'Shrub', 'Succulent', 'Tree', 'Forb'];
      problems.push(`MISS:${archNames[arch]}`);
    }
  }
  if (problems.length > 0) {
    console.log(`  ${niche.label}: ${problems.join(', ')}`);
  }
}
