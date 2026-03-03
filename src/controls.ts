import { World, Renderer } from './types';
import { updateInspector } from './inspector';

export interface Controls {
  paused: boolean;
  tickInterval: number; // ms between ticks
  stepRequested: boolean;
  selectedCell: { x: number; y: number } | null;
  hoveredSpecies: number | null;
}

export function initControls(
  canvas: HTMLCanvasElement,
  renderer: Renderer,
  world: World,
): Controls {
  const controls: Controls = {
    paused: false,
    tickInterval: 200,
    stepRequested: false,
    selectedCell: null,
    hoveredSpecies: null,
  };

  const btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;
  const btnStep = document.getElementById('btn-step') as HTMLButtonElement;
  const speedSlider = document.getElementById('speed-slider') as HTMLInputElement;
  const speedLabel = document.getElementById('speed-label')!;

  btnPlayPause.addEventListener('click', () => {
    controls.paused = !controls.paused;
    btnPlayPause.textContent = controls.paused ? 'Play' : 'Pause';
  });

  btnStep.addEventListener('click', () => {
    if (!controls.paused) {
      controls.paused = true;
      btnPlayPause.textContent = 'Play';
    }
    controls.stepRequested = true;
  });

  // Slider: 1 (slow, 500ms) to 10 (fast, 20ms). Default 3 = 200ms.
  speedSlider.value = '3';
  speedLabel.textContent = '5';
  const intervalFromSlider = (v: number) => Math.round(500 / v);
  controls.tickInterval = intervalFromSlider(3);

  speedSlider.addEventListener('input', () => {
    const v = parseInt(speedSlider.value, 10);
    controls.tickInterval = intervalFromSlider(v);
    const tps = Math.round(1000 / controls.tickInterval);
    speedLabel.textContent = String(tps);
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const pos = renderer.cellAt(e.clientX - rect.left, e.clientY - rect.top);
    controls.selectedCell = pos;
    updateInspector(world, controls);
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const pos = renderer.cellAt(e.clientX - rect.left, e.clientY - rect.top);
    if (pos) {
      // Scan a 5x5 neighborhood and pick the dominant species
      const counts = new Map<number, number>();
      const R = 2;
      for (let dy = -R; dy <= R; dy++) {
        const ny = pos.y + dy;
        if (ny < 0 || ny >= world.height) continue;
        for (let dx = -R; dx <= R; dx++) {
          const nx = pos.x + dx;
          if (nx < 0 || nx >= world.width) continue;
          const c = world.grid[ny][nx];
          let sid: number | null = null;
          if (c.plantId !== null) {
            const p = world.plants.get(c.plantId);
            if (p?.alive) sid = p.speciesId;
          }
          if (sid === null) sid = c.lastSpeciesId;
          if (sid !== null) counts.set(sid, (counts.get(sid) ?? 0) + 1);
        }
      }
      let best: number | null = null;
      let bestCount = 0;
      for (const [sid, n] of counts) {
        if (n > bestCount) { best = sid; bestCount = n; }
      }
      controls.hoveredSpecies = best;
    } else {
      controls.hoveredSpecies = null;
    }
  });

  canvas.addEventListener('mouseleave', () => {
    controls.hoveredSpecies = null;
  });

  return controls;
}

