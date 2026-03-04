Run a simulation experiment to test a specific hypothesis about the ecosystem.

$ARGUMENTS should describe what to test (e.g., "monoculture carrying capacity", "tree vs grass competition on hills", "high allelopathy impact"). If empty, choose something interesting based on recent tuning changes or known issues.

## Full Experiment Flow

### 1. Design the Experiment

- Pick a clear, testable question (e.g., "Can a single balanced species sustain itself on uniform soil?")
- Design a scenario that isolates the variable being tested. Keep it simple — one variable at a time.
- Decide tick count: 500 ticks = 1 full year (4 seasons x 125 ticks). Use 500 for baseline tests, 1000+ for long-term stability tests.

### 2. Create the Scenario File

Create `src/scenarios/experiment-<name>.ts` following this template:

```typescript
import { Scenario, ScenarioCell, TerrainType } from '../types';

export const experimentName: Scenario = (() => {
  const size = 80;
  const cells: ScenarioCell[] = [];
  // Add cell overrides for non-default terrain if needed
  // e.g.: cells.push({ x, y, terrain: TerrainType.Hill, elevation: 0.7 });

  return {
    id: 'experiment-name',
    name: '[Exp] Description',
    description: 'What this tests.',
    size,
    defaultTerrain: TerrainType.Soil,
    defaultElevation: 0.5,
    cells,
    species: [
      {
        id: 1,
        name: 'Species Name',
        archetype: 'grass', // only 'grass' or 'tree' are valid
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.5,
          leafSize: 0.5,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
        },
        color: { r: 0.3, g: 0.7, b: 0.3 },
        placements: scatter(35, 45, 35, 45, 20),
      },
    ],
  };
})();

function scatter(x0: number, x1: number, y0: number, y1: number, count: number) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    pts.push({
      x: x0 + Math.floor(Math.random() * (x1 - x0)),
      y: y0 + Math.floor(Math.random() * (y1 - y0)),
    });
  }
  return pts;
}
```

Register it in `src/scenarios/index.ts` by importing and adding to the `SCENARIOS` array.

### 3. Run the Experiment

The app exposes programmatic hooks on `window` (added in main.ts):
- `window.__doTick()` — runs one simulation tick + records history + diagnostic snapshot
- `window.__world` — the live World object
- `window.__diagLogger` — the diagnostic logger instance
- `window.__updateUI()` — forces a full UI refresh

**Steps using Playwright browser tools:**

1. Navigate to the running dev server (usually `http://localhost:5173`, check with `lsof -i :5173` or try 5174/5175/5176 if occupied)
2. Take a snapshot to find the scenario selector
3. Select the experiment scenario from the dropdown and click Load
4. Run ticks programmatically:
   ```js
   // via browser_evaluate
   () => {
     for (let i = 0; i < 500; i++) { window.__doTick(); }
     window.__updateUI();
     return { tick: window.__world.tick, plants: window.__world.plants.size };
   }
   ```
5. Download the diagnostic file using Playwright's download interception:
   ```js
   // via browser_run_code
   async (page) => {
     const downloadPromise = page.waitForEvent('download');
     await page.keyboard.press('d');  // triggers diagLogger.downloadReport()
     const download = await downloadPromise;
     await download.saveAs('C:\\Users\\man\\git\\overgreen\\overgreen-diagnostic-experiment.json');
     return 'Downloaded';
   }
   ```

### 4. Analyze Results

Run the summarizer script (same as /diagnose):
```
node scripts/summarize-diagnostic.cjs overgreen-diagnostic-experiment.json
```

### 5. Draw Conclusions

Analyze the summarizer output covering:
- **Population dynamics**: peak, trough, growth/decline rate, carrying capacity
- **Resource pressure**: nutrient depletion, water stress, seed success rates
- **Evolution**: genome drift direction and why (selective pressure)
- **Season effects**: which seasons cause growth vs die-off
- **Death causes**: starvation vs age ratio indicates resource vs lifespan limits
- **Potential issues**: extinction spirals, implausible values, balance problems

### 6. Clean Up

- Remove the experiment scenario file and its import from `src/scenarios/index.ts` (unless it's worth keeping as a permanent scenario)
- Delete the diagnostic JSON file from the project root
- Report findings to the user with specific data points and actionable tuning suggestions

## Key Reference

- **Archetype types**: only `'grass'` or `'tree'` (defined in `src/types/core.ts`)
- **Season length**: 125 ticks per season, 500 ticks per year
- **Terrain types**: `Soil`, `River`, `Rock`, `Hill`, `Wetland`, `Arid` (from `TerrainType` enum)
- **Genome fields**: `rootPriority`, `heightPriority`, `leafSize`, `seedInvestment`, `allelopathy`, `defense` (all 0-1)
- **SIM constants**: defined in `src/types.ts` SIM object — check these when analyzing results
- **Diagnostic snapshots**: taken every 25 ticks by default

## Common Experiment Ideas

- **Monoculture baseline**: single species, uniform terrain — tests carrying capacity
- **Terrain specialist**: same species on different terrain types — tests terrain fitness
- **Head-to-head**: two species with different strategies on shared terrain — tests competitive dynamics
- **Allelopathy impact**: species with vs without allelopathy — tests chemical warfare viability
- **Defense value**: species with defense in herbivore-heavy environment — tests defense ROI
- **Seed investment sweep**: same species with different seed values — tests reproduction strategies
