Capture screenshots of all 40 plant subtypes on flat soil for visual review.

## Steps

1. Ensure the dev server is running. If not, start it in the background:
```bash
npx vite --port 5173
```

2. Run the capture script. If `$ARGUMENTS` specifies camera presets, pass them with `--cameras`. Otherwise capture all presets:
```bash
node scripts/capture-map-review.mjs --port 5173 --cameras <preset1,preset2,...>
```

Examples:
- No cameras specified: `node scripts/capture-map-review.mjs --port 5173` (captures all showcase presets)
- Specific cameras: `node scripts/capture-map-review.mjs --port 5173 --cameras showcaseGrasses`
- Single plant close-up: `node scripts/capture-map-review.mjs --port 5173 --cameras plantOak`
- Multiple cameras: `node scripts/capture-map-review.mjs --port 5173 --cameras showcaseOverview,plantPalm,plantSaguaro`

3. Read the contact sheet to view all camera angles in a single image:
```
screenshots/map-review-contact-sheet.jpg
```

4. For detail, read individual frame jpgs (`screenshots/map-review-*.jpg`).

5. Evaluate:
   - Are all 40 subtypes visible and distinguishable?
   - Do all three health states (thriving, stressed, dying) look distinct?
   - Are hi-LOD and lo-LOD rows both visible and distinguishable?
   - Are there any rendering artifacts, z-fighting, or missing models?
   - Do colors provide enough contrast between adjacent species?

## Available camera presets

### Showcase (archetype overview)
- `showcaseOverview` — high-angle full map showing all 5 rows
- `showcaseGrasses` — grasses row (subtypes 0-5, 30, 31)
- `showcaseTrees` — trees row (subtypes 6-11, 32, 33)
- `showcaseShrubs` — shrubs row (subtypes 12-17, 34, 35)
- `showcaseSucculents` — succulents row (subtypes 18-23, 36, 37)
- `showcaseForbs` — forbs row (subtypes 24-29, 38, 39)

### Per-plant close-ups (all 6 meshes: 3 health × 2 LOD)
- Grasses: `plantTurfgrass`, `plantTallgrass`, `plantBunchgrass`, `plantBamboo`, `plantRyegrass`, `plantSedge`, `plantPampas`, `plantDesertGrass`
- Trees: `plantOak`, `plantMagnolia`, `plantConifer`, `plantTropical`, `plantPalm`, `plantBirch`, `plantCypress`, `plantAcacia`
- Shrubs: `plantHolly`, `plantHazel`, `plantMediterranean`, `plantBramble`, `plantSaltbush`, `plantMangrove`, `plantFloweringShrub`, `plantAromatic`
- Succulents: `plantSaguaro`, `plantAloe`, `plantCaudiciform`, `plantEuphorbia`, `plantIceplant`, `plantEpiphytic`, `plantBarrelCactus`, `plantJade`
- Forbs: `plantWildflower`, `plantTallHerb`, `plantFern`, `plantVine`, `plantClover`, `plantMoss`, `plantTropicalHerb`, `plantDesertAnnual`
