Design a plant mesh by iterating: edit builder → capture screenshot → evaluate → repeat.

## Prerequisites

Dev server must be running. If not:
```bash
npx vite --port 5173
```

## Capture command

```bash
node scripts/capture-workshop.mjs --subtype N [--port 5173] [--angles 4]
```

- `--subtype N` — builder index (0–23). See subtype list below.
- `--angles N` — number of orbit camera views (default 4).
- Output: `screenshots/workshop.png`

## Subtype index

| 0–5 Grasses | 6–11 Trees | 12–17 Shrubs | 18–23 Succulents |
|---|---|---|---|
| 0 Turfgrass | 6 Oak | 12 Evergreen Shrub | 18 Stem Succulent |
| 1 Tallgrass | 7 Magnolia | 13 Deciduous Shrub | 19 Leaf Succulent |
| 2 Bunchgrass | 8 Conifer | 14 Mediterranean | 20 Caudiciform |
| 3 Bamboo | 9 Tropical | 15 Thorny | 21 Euphorbia |
| 4 Spreading | 10 Palm | 16 Desert Shrub | 22 Ice Plant |
| 5 Sedge | 11 Birch | 17 Mangrove | 23 Epiphytic |

## Iteration loop

1. Edit the builder function in `src/renderer3d/plant-models.ts`.
2. Run the capture command.
3. Read `screenshots/workshop.png` to see the result.
4. Evaluate what needs fixing — gaps, proportions, silhouette, color.
5. Go to 1. Repeat until the mesh looks right.

## What to target

If $ARGUMENTS names a subtype (e.g., "oak", "6", "conifer"), iterate on that one.
If $ARGUMENTS is empty, ask the user which subtype to work on.

## Key files

- Builders: `src/renderer3d/plant-models.ts` (helpers: `addTrunk`, `addCanopy`, `jitter`, `mat`, `grassBlade`)
- Workshop page: `src/workshop.ts`
- Capture script: `scripts/capture-workshop.mjs`
