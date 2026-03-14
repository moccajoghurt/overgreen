Capture screenshots of the first-time visitor experience and view the contact sheet.

There are two modes. If $ARGUMENTS is empty or ambiguous, ask the user which mode they want.

## Modes

### 1. Card mode (`card`) — default
Captures the **intro card overlay** — what a first-time visitor sees (context card over Genesis terrain, paused at tick 0).

```bash
node scripts/capture-hook.mjs --mode card [--port 5173]
```

Output: `screenshots/hook-card-contact-sheet.jpg` and `screenshots/hook-card-NNNs.jpg` individual frames.

**Use this when:** evaluating the first-time visitor experience, card layout, terrain behind the card.

### 2. Cinematic mode (`cinematic`)
Captures the **cinematic hook** — camera choreography, overlay text, speciation reveal. This is the experience triggered by `?hook` or `?demo` URL parameter (for demos, social media, conference presentations).

```bash
node scripts/capture-hook.mjs --mode cinematic [--port 5173]
```

Output: `screenshots/hook-cinematic-contact-sheet.jpg` and `screenshots/hook-cinematic-NNNs.jpg` individual frames.

**Use this when:** evaluating camera movement, overlay text timing, reveal sequence for demo/marketing purposes.

### 3. Simulation mode (`sim`)
Captures the **full UI** at specific tick milestones (skips the hook). Shows sidebar, genome panel, events, species labels.

```bash
node scripts/capture-genesis.mjs [--port 5173] [--width 1024] [--height 768]
```

Output: `screenshots/genesis-contact-sheet.jpg` and `screenshots/genesis-tick-NNNNN.jpg` individual frames.

Default keyframes: ticks 0, 50, 150, 300, 600, 1000. When $ARGUMENTS specifies tick numbers (e.g., "sim 0 100 500 2000"), edit the `KEYFRAMES` array in `scripts/capture-genesis.mjs` to match before running.

**Use this when:** evaluating terrain, species colors, speciation drama, UI panels, growth arc.

## Steps

1. Ensure the dev server is running. If not, start it in the background:
```bash
npx vite --port 5173
```

2. Run the appropriate capture script (see Modes above).

3. Read the contact sheet jpg to view all keyframes in a single image.

4. For detail, read individual frame jpgs.

## Output

Read the contact sheet jpg first. For detail, read individual frames.

## Note

Both capture scripts use shared utilities from `scripts/capture-utils.mjs`. For performance-focused benchmarking with camera presets, use `/capture` instead.
