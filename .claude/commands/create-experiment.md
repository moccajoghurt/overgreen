Create a scenario file for a simulation experiment.

$ARGUMENTS should describe what to test (e.g., "monoculture carrying capacity", "tree vs grass competition on hills", "high allelopathy impact"). If empty, choose something interesting based on recent tuning changes or known issues.

## Steps
1. Create `src/scenarios/experiment-<name>.ts` following the template below.
2. Register it in `src/scenarios/index.ts` by importing and adding to the `SCENARIOS` array.

## Scenario Template

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
        genome: {
          rootPriority: 0.5,
          heightPriority: 0.5,
          leafSize: 0.5,
          seedInvestment: 0.5,
          allelopathy: 0.0,
          defense: 0.0,
          woodiness: 0.8, // 0.01-0.99: low = herbaceous/grass, high = woody/tree
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

