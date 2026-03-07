import { World, Renderer } from './types';
import { updateInspector } from './inspector';

export interface Controls {
  paused: boolean;
  tickInterval: number;   // ms between ticks (timer mode, when tickBudgetMs === 0)
  tickBudgetMs: number;   // >0 = time-budgeted: run ticks until budget exhausted, then render
  renderSkip: number;     // >0 = render only every Nth frame (0 = every frame)
  stepRequested: boolean;
  selectedCell: { x: number; y: number } | null;
  hoveredSpecies: number | null;
  hoverEnabled: boolean;
  hoverLineageEnabled: boolean;
  mode: 'inspect' | 'place';
  onPlaceClick: ((x: number, y: number) => void) | null;
}

type SpeedPreset = 'play' | 'fast' | 'warp';

const PRESETS: Record<SpeedPreset, { tickInterval: number; tickBudgetMs: number; renderSkip: number }> = {
  'play': { tickInterval: 500, tickBudgetMs: 0, renderSkip: 0 },
  'fast': { tickInterval: 0,   tickBudgetMs: 1, renderSkip: 0 },  // adaptive: budget computed from frame timing
  'warp': { tickInterval: 0,   tickBudgetMs: 0, renderSkip: 10 }, // max ticks, no rendering
};

export function initControls(
  canvas: HTMLCanvasElement,
  renderer: Renderer,
  world: World,
): Controls {
  const controls: Controls = {
    paused: false,
    tickInterval: 500,
    tickBudgetMs: 0,
    renderSkip: 0,
    stepRequested: false,
    selectedCell: null,
    hoveredSpecies: null,
    hoverEnabled: true,
    hoverLineageEnabled: false,
    mode: 'inspect',
    onPlaceClick: null,
  };

  const btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;

  btnPlayPause.addEventListener('click', () => {
    controls.paused = !controls.paused;
    btnPlayPause.textContent = controls.paused ? '\u258C\u258C PAUSED' : '\u25BA Running';
    btnPlayPause.classList.toggle('paused', controls.paused);
  });

  // Speed presets
  const speedBtns = document.querySelectorAll<HTMLButtonElement>('.speed-btn');
  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset as SpeedPreset;
      const cfg = PRESETS[preset];
      controls.tickInterval = cfg.tickInterval;
      controls.tickBudgetMs = cfg.tickBudgetMs;
      controls.renderSkip = cfg.renderSkip;
      speedBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.preset === preset);
        if (b.dataset.preset === preset) {
          b.classList.toggle('warp', preset === 'warp');
        } else {
          b.classList.remove('warp');
        }
      });
      btnPlayPause.classList.toggle('warp-active', preset === 'warp');
    });
  });

  canvas.addEventListener('click', (e) => {
    // Exit warp mode on canvas click — switch to Fast
    if (controls.renderSkip > 0) {
      const fastCfg = PRESETS['fast'];
      controls.tickInterval = fastCfg.tickInterval;
      controls.tickBudgetMs = fastCfg.tickBudgetMs;
      controls.renderSkip = fastCfg.renderSkip;
      speedBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.preset === 'fast');
        b.classList.remove('warp');
      });
      btnPlayPause.classList.remove('warp-active');
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const pos = renderer.cellAt(e.clientX - rect.left, e.clientY - rect.top);
    if (controls.mode === 'place' && pos && controls.onPlaceClick) {
      controls.onPlaceClick(pos.x, pos.y);
    } else {
      controls.selectedCell = pos;
      updateInspector(world, controls);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!controls.hoverEnabled && !controls.hoverLineageEnabled) { controls.hoveredSpecies = null; return; }
    const rect = canvas.getBoundingClientRect();
    const pos = renderer.cellAt(e.clientX - rect.left, e.clientY - rect.top);
    if (pos) {
      const cell = world.grid[pos.y][pos.x];
      let exact: number | null = null;
      if (cell.plantId !== null) {
        const p = world.plants.get(cell.plantId);
        if (p?.alive) exact = p.speciesId;
      }
      if (exact !== null) {
        // Exact cell has a living plant — use its species directly
        controls.hoveredSpecies = exact;
      } else {
        // Empty cell — scan a 5x5 neighborhood and pick the dominant species
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
      }
    } else {
      controls.hoveredSpecies = null;
    }
  });

  canvas.addEventListener('mouseleave', () => {
    controls.hoveredSpecies = null;
  });

  const hoverToggle = document.getElementById('hover-toggle') as HTMLInputElement;
  hoverToggle.addEventListener('change', () => {
    controls.hoverEnabled = hoverToggle.checked;
    if (!controls.hoverEnabled) controls.hoveredSpecies = null;
  });

  const hoverLineageToggle = document.getElementById('hover-lineage-toggle') as HTMLInputElement;
  hoverLineageToggle.addEventListener('change', () => {
    controls.hoverLineageEnabled = hoverLineageToggle.checked;
  });

  return controls;
}

