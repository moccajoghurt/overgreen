import { SIM, World } from './types';
import {
  createAccumulator, accumulateTick, computeSnapshot,
  computeTerrainSummary, computeNearRiverSet,
  Snapshot, TerrainSummary,
} from './stats';

// ── Types ──

interface DiagnosticConfig {
  enabled: boolean;
  snapshotInterval: number;
  maxSnapshots: number;
}

interface SeasonTransition {
  tick: number;
  fromSeason: number;
  toSeason: number;
  populationBefore: number;
  populationAfter: number;
  speciesCountBefore: number;
}

interface DiagnosticReport {
  version: 1;
  generatedAt: string;
  config: DiagnosticConfig;
  simConstants: Record<string, number>;
  gridSize: { width: number; height: number };
  terrainSummary: TerrainSummary;
  snapshots: Snapshot[];
  seasonTransitions: SeasonTransition[];
}

// ── Public API ──

export function createDiagnosticLogger(config: DiagnosticConfig = {
  enabled: true,
  snapshotInterval: 25,
  maxSnapshots: 400,
}) {
  const snapshots: Snapshot[] = [];
  const seasonTransitions: SeasonTransition[] = [];
  let accumulator = createAccumulator();
  let terrainSummaryCache: TerrainSummary | null = null;
  let nearRiverCache: Set<number> | null = null;
  let prevSeason = -1;
  let prevPopulation = 0;
  let prevSpeciesCount = 0;
  let lastWorld: World | null = null;

  function recordTick(world: World): void {
    if (!config.enabled) return;
    lastWorld = world;

    // One-time terrain analysis
    if (!terrainSummaryCache) {
      terrainSummaryCache = computeTerrainSummary(world);
      nearRiverCache = computeNearRiverSet(world);
    }

    // Per-tick accumulation from event arrays
    accumulateTick(accumulator, world);

    // Season transition detection
    const currentSeason = world.environment.season;
    if (prevSeason >= 0 && currentSeason !== prevSeason) {
      seasonTransitions.push({
        tick: world.tick,
        fromSeason: prevSeason,
        toSeason: currentSeason,
        populationBefore: prevPopulation,
        populationAfter: 0,
        speciesCountBefore: prevSpeciesCount,
      });
    }
    prevSeason = currentSeason;

    // Periodic full snapshot
    if (world.tick % config.snapshotInterval === 0) {
      const snapshot = computeSnapshot(world, accumulator, terrainSummaryCache!, nearRiverCache!);
      snapshots.push(snapshot);
      if (snapshots.length > config.maxSnapshots) {
        snapshots.shift();
      }

      // Fill "after" population for recent season transition
      if (seasonTransitions.length > 0) {
        const last = seasonTransitions[seasonTransitions.length - 1];
        if (last.populationAfter === 0) {
          last.populationAfter = snapshot.population;
        }
      }

      prevPopulation = snapshot.population;
      prevSpeciesCount = snapshot.speciesCount;
      accumulator = createAccumulator();
    }
  }

  function buildReport(): DiagnosticReport {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      config,
      simConstants: { ...SIM } as unknown as Record<string, number>,
      gridSize: { width: lastWorld?.width ?? 80, height: lastWorld?.height ?? 80 },
      terrainSummary: terrainSummaryCache ?? { soilCells: 0, riverCells: 0, rockCells: 0, hillCells: 0, wetlandCells: 0, aridCells: 0, plantableCells: 0 },
      snapshots,
      seasonTransitions,
    };
  }

  function downloadReport(): void {
    const report = buildReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overgreen-diagnostic-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset(): void {
    snapshots.length = 0;
    seasonTransitions.length = 0;
    accumulator = createAccumulator();
    prevSeason = -1;
    prevPopulation = 0;
    prevSpeciesCount = 0;
    terrainSummaryCache = null;
    nearRiverCache = null;
  }

  return { recordTick, downloadReport, buildReport, reset };
}
