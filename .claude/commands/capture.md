Run the performance benchmark pipeline and review results.

Captures screenshots from multiple camera angles at a given tick, with per-subsystem performance timings.

## Steps

1. Ensure the dev server is running. If not, start it in the background:
```bash
npx vite --port 5173
```

2. Run the capture script:
```bash
node scripts/capture-perf.mjs [--scenario genesis] [--tick 300] [--cameras all]
```
For ad-hoc camera positions (not in presets):
```bash
node scripts/capture-perf.mjs --tick 300 --pos x,y,z --target x,y,z
```
When $ARGUMENTS specifies options, map them to CLI flags:
- A number → `--tick <number>`
- Comma-separated preset names → `--cameras <names>`
- A scenario name → `--scenario <name>`
- Camera coordinates like "pos 5,8,8 target 5,0,3" → `--pos 5,8,8 --target 5,0,3`

3. Read the contact sheet jpg (`screenshots/perf-contact-sheet.jpg`) to view all camera angles.

4. Read individual frame jpgs for detail.

5. Report the perf numbers from the script's stdout.

## Output

The contact sheet shows each camera preset labeled with FPS and frame time.
The console table breaks down per-subsystem timings (plants, grass, glDraw, etc.).

## Camera presets

Defined in `scripts/camera-presets.mjs`. Available presets: overview, closeGrass, hillside, river, wideField.

## Ad-hoc cameras

Users can get their current camera position from the browser console with `__getCamera()` and paste it. Use `--pos` and `--target` flags to pass these coordinates directly.
