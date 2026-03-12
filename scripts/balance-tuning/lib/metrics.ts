/**
 * Shared balance metrics types and computation.
 * Used by extract-metrics.ts, compare-runs.ts, trajectory-analysis.ts, parameter-sweep.ts.
 */

// ── Types ──

export interface NicheData {
  [subtypeName: string]: number; // subtype → count
}

export interface SnapshotWithNiche {
  tick: number;
  population: number;
  speciesCount: number;
  diversity: { shannonIndex: number };
  subtypesByNiche?: Record<string, NicheData>;
  subtypesByTerrain?: Record<string, NicheData>;
}

export interface Report {
  scenarioId: string;
  scenarioName: string;
  config: { totalTicks: number; snapshotInterval: number };
  simConstants?: Record<string, number>;
  snapshots: SnapshotWithNiche[];
}

export interface NicheBreakdownEntry {
  niche: string;
  total: number;
  dominant: string;
  dominantPct: number;
  richness: number;
  top3: string[];
}

export interface BalanceMetrics {
  // Population health
  finalPopulation: number;
  populationStability: number;       // 1 - (stddev / mean) over snapshots. 1.0 = rock stable

  // Diversity
  subtypeRichness: number;           // Unique subtypes alive at end (of 40)
  archetypeRichness: number;         // Unique archetypes represented (of 5)
  shannonIndex: number;              // Shannon diversity (from stats)
  giniCoefficient: number;           // 0 = perfect equality, 1 = one subtype has everything

  // Niche specialization (the key metrics)
  nicheDifferentiation: number;      // Unique dominant subtypes across niches / total niches
  avgMaxDominance: number;           // Average % of top subtype per niche (lower = more diverse)
  avgNicheRichness: number;          // Average subtypes per niche
  nicheSpecializationScore: number;  // % of subtypes that are dominant in at least 1 niche

  // Extinction & archetype balance
  extinctSubtypes: number;           // Subtypes with 0 population globally
  archetypeBalance: number;          // 1 - Gini of archetype total populations. 1.0 = all equal

  // Per-niche detail
  nicheBreakdown: NicheBreakdownEntry[];
}

export interface HealthCheck {
  label: string;
  pass: boolean;
  value: string;
}

// ── Archetype classification ──

export const ARCHETYPE_NAMES = ['Grass', 'Shrub', 'Succulent', 'Tree', 'Forb'];

// Must match src/types/subtypes.ts ordering
export const SUBTYPE_ARCHETYPES: Record<string, string> = {
  'Turfgrass': 'Grass', 'Tallgrass': 'Grass', 'Bunchgrass': 'Grass', 'Bamboo': 'Grass',
  'Ryegrass': 'Grass', 'Sedge': 'Grass', 'Pampas': 'Grass', 'Desert Grass': 'Grass',
  'Oak': 'Tree', 'Magnolia': 'Tree', 'Conifer': 'Tree', 'Tropical': 'Tree',
  'Palm': 'Tree', 'Birch': 'Tree', 'Cypress': 'Tree', 'Acacia': 'Tree',
  'Holly': 'Shrub', 'Hazel': 'Shrub', 'Mediterranean': 'Shrub', 'Bramble': 'Shrub',
  'Saltbush': 'Shrub', 'Mangrove': 'Shrub', 'Flowering Shrub': 'Shrub', 'Aromatic': 'Shrub',
  'Saguaro': 'Succulent', 'Aloe': 'Succulent', 'Caudiciform': 'Succulent', 'Euphorbia': 'Succulent',
  'Iceplant': 'Succulent', 'Epiphytic': 'Succulent', 'Barrel Cactus': 'Succulent', 'Jade': 'Succulent',
  'Wildflower': 'Forb', 'Tall Herb': 'Forb', 'Fern': 'Forb', 'Vine': 'Forb',
  'Clover': 'Forb', 'Moss': 'Forb', 'Tropical Herb': 'Forb', 'Desert Annual': 'Forb',
};

// ── Gini coefficient ──

export function gini(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return sum / (n * total);
}

// ── Extract metrics from experiment report ──

export function extractMetrics(report: Report): BalanceMetrics {
  const lastSnap = report.snapshots[report.snapshots.length - 1];
  const nicheData = lastSnap.subtypesByNiche ?? {};

  // ── Population stability ──
  const pops = report.snapshots.map(s => s.population);
  const meanPop = pops.reduce((a, b) => a + b, 0) / pops.length;
  const variance = pops.reduce((a, p) => a + (p - meanPop) ** 2, 0) / pops.length;
  const popStability = meanPop > 0 ? 1 - Math.sqrt(variance) / meanPop : 0;

  // ── Global subtype counts ──
  const globalSubtypes: Record<string, number> = {};
  for (const niche of Object.values(nicheData)) {
    for (const [st, count] of Object.entries(niche)) {
      globalSubtypes[st] = (globalSubtypes[st] ?? 0) + count;
    }
  }

  const subtypeNames = Object.keys(globalSubtypes);
  const subtypeCounts = Object.values(globalSubtypes);
  const totalPlants = subtypeCounts.reduce((a, b) => a + b, 0);

  // ── Archetype counts ──
  const archetypeCounts: Record<string, number> = {};
  for (const [st, count] of Object.entries(globalSubtypes)) {
    const arch = SUBTYPE_ARCHETYPES[st] ?? 'Unknown';
    archetypeCounts[arch] = (archetypeCounts[arch] ?? 0) + count;
  }

  // ── Per-niche analysis ──
  const nicheBreakdown: NicheBreakdownEntry[] = [];
  const dominantSet = new Set<string>();

  // Skip non-plantable niches
  const validNiches = Object.entries(nicheData).filter(([name]) =>
    !name.includes('rock') && !name.includes('river')
  );

  for (const [niche, data] of validNiches) {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const nicheTotal = entries.reduce((a, [, c]) => a + c, 0);
    if (nicheTotal === 0) continue;

    const dominant = entries[0][0];
    const dominantPct = (entries[0][1] / nicheTotal) * 100;
    dominantSet.add(dominant);

    nicheBreakdown.push({
      niche,
      total: nicheTotal,
      dominant,
      dominantPct,
      richness: entries.length,
      top3: entries.slice(0, 3).map(([name, count]) =>
        `${name} ${((count / nicheTotal) * 100).toFixed(0)}%`
      ),
    });
  }

  nicheBreakdown.sort((a, b) => a.niche.localeCompare(b.niche));

  // ── Niche specialization score ──
  const nicheSpecScore = subtypeNames.length > 0
    ? dominantSet.size / subtypeNames.length
    : 0;

  // ── Compute all metrics ──
  const allSubtypeNames = Object.keys(SUBTYPE_ARCHETYPES);
  const extinctCount = allSubtypeNames.filter(st => !globalSubtypes[st] || globalSubtypes[st] === 0).length;

  const archValues = Object.values(archetypeCounts);
  const presentArchetypes = archValues.filter(v => v > 0).length;

  return {
    finalPopulation: lastSnap.population,
    populationStability: Math.round(popStability * 1000) / 1000,

    subtypeRichness: subtypeNames.length,
    archetypeRichness: presentArchetypes,
    shannonIndex: Math.round(lastSnap.diversity.shannonIndex * 100) / 100,
    giniCoefficient: Math.round(gini(subtypeCounts) * 1000) / 1000,

    nicheDifferentiation: validNiches.length > 0
      ? Math.round((dominantSet.size / validNiches.length) * 1000) / 1000
      : 0,
    avgMaxDominance: nicheBreakdown.length > 0
      ? Math.round(nicheBreakdown.reduce((a, n) => a + n.dominantPct, 0) / nicheBreakdown.length * 10) / 10
      : 0,
    avgNicheRichness: nicheBreakdown.length > 0
      ? Math.round(nicheBreakdown.reduce((a, n) => a + n.richness, 0) / nicheBreakdown.length * 10) / 10
      : 0,
    nicheSpecializationScore: Math.round(nicheSpecScore * 1000) / 1000,

    extinctSubtypes: extinctCount,
    archetypeBalance: Math.round((1 - gini(archValues)) * 1000) / 1000,

    nicheBreakdown,
  };
}

// ── Health checks ──

export function evaluateHealthChecks(metrics: BalanceMetrics): HealthCheck[] {
  return [
    { label: 'Subtype richness ≥ 20', pass: metrics.subtypeRichness >= 20, value: `${metrics.subtypeRichness}` },
    { label: 'All 5 archetypes present', pass: metrics.archetypeRichness >= 5, value: `${metrics.archetypeRichness}` },
    { label: 'Niche differentiation ≥ 0.5', pass: metrics.nicheDifferentiation >= 0.5, value: `${metrics.nicheDifferentiation}` },
    { label: 'Avg max dominance ≤ 40%', pass: metrics.avgMaxDominance <= 40, value: `${metrics.avgMaxDominance}%` },
    { label: 'Gini ≤ 0.6', pass: metrics.giniCoefficient <= 0.6, value: `${metrics.giniCoefficient}` },
    { label: 'Archetype balance ≥ 0.5', pass: metrics.archetypeBalance >= 0.5, value: `${metrics.archetypeBalance}` },
    { label: 'Extinct ≤ 20', pass: metrics.extinctSubtypes <= 20, value: `${metrics.extinctSubtypes}` },
    { label: 'Avg niche richness ≥ 5', pass: metrics.avgNicheRichness >= 5, value: `${metrics.avgNicheRichness}` },
  ];
}
