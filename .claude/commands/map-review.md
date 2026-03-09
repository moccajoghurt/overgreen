Capture screenshots of all 40 plant subtypes on the Genesis terrain for visual review.

## Steps

1. Ensure the dev server is running. If not, start it in the background:
```bash
npx vite --port 5173
```

2. Run the capture script:
```bash
node scripts/capture-map-review.mjs --port 5173 $ARGUMENTS
```

The `$ARGUMENTS` are passed as the `--cameras` flag. Examples:
- Empty: captures all showcase presets (overview + 5 archetype close-ups)
- `showcaseGrasses`: captures just the grasses close-up
- `showcaseOverview,showcaseTrees`: captures overview and trees

3. Read the contact sheet to view all camera angles in a single image:
```
screenshots/map-review-contact-sheet.jpg
```

4. For detail, read individual frame jpgs (`screenshots/map-review-*.jpg`).

5. Evaluate:
   - Are all 40 subtypes visible and distinguishable?
   - Do plants look correct at maturity scale on real terrain?
   - Are there any rendering artifacts, z-fighting, or missing models?
   - Do colors provide enough contrast between adjacent species?

## Available camera presets

- `showcaseOverview` — high-angle full map
- `showcaseGrassesForbs` — grasses and forbs on flat SE desert
- `showcaseTrees` — wadi corridor, 3×2 blocks
- `showcaseShrubs` — escarpment flanks, 3×2 blocks
- `showcaseSucculents` — east desert, 3×2 blocks
- `showcaseForbsHill` — forbs mixed with grass on NE hills
- `showcaseForbsWetland` — forbs mixed with grass on delta wetland
