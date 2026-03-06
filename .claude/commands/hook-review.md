Capture screenshots of the Genesis intro scenario at key tick milestones and view the contact sheet.

Requires: Vite dev server running on port 5173 (`npm run dev`).

## Steps

1. Ensure the dev server is running. If not, start it in the background:
```bash
npx vite --port 5173
```

2. Run the capture script:
```bash
node scripts/capture-genesis.mjs [--port 5173] [--width 1024] [--height 768]
```

3. Read `screenshots/genesis-contact-sheet.jpg` to view all keyframes in a single image.

4. For individual frames, read `screenshots/genesis-tick-NNNNN.jpg`.

## Customizing keyframes

The default keyframes are ticks 0, 50, 150, 300, 600, 1000. To change them, edit the `KEYFRAMES` array in `scripts/capture-genesis.mjs`.

When $ARGUMENTS specifies tick numbers (e.g., "0 100 500 2000"), edit the KEYFRAMES array to match before running. Use descriptive labels.

## What to evaluate

- **Hook quality**: Does tick 0 look inviting? Is the terrain readable?
- **Growth arc**: Is the population expansion visible and satisfying?
- **Speciation visibility**: Are species labels and color differences apparent?
- **Terrain colonization**: Are plants spreading into different biomes?
- **UI clarity**: Are overlays, labels, and panels readable at this viewport size?
