import { Renderer } from './types';

export interface Controls {
  paused: boolean;
  tickInterval: number;   // ms between ticks (timer mode, when tickBudgetMs === 0)
  tickBudgetMs: number;   // >0 = time-budgeted: run ticks until budget exhausted, then render
  renderSkip: number;     // >0 = render only every Nth frame (0 = every frame)
  stepRequested: boolean;
  selectedCell: { x: number; y: number } | null;
  hoveredSpecies: number | null;
  hoveredPlantId: number | null;
  hoverEnabled: boolean;
  hoverPlantEnabled: boolean;
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
): Controls {
  const controls: Controls = {
    paused: false,
    tickInterval: 500,
    tickBudgetMs: 0,
    renderSkip: 0,
    stepRequested: false,
    selectedCell: null,
    hoveredSpecies: null,
    hoveredPlantId: null,
    hoverEnabled: false,
    hoverPlantEnabled: true,
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

  // Track mousedown position to distinguish clicks from drags
  let downX = 0, downY = 0;
  const DRAG_THRESHOLD = 5; // px — beyond this, it's a drag not a click
  canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });

  canvas.addEventListener('click', (e) => {
    // Ignore clicks that were actually drags (camera orbit/pan)
    const dx = e.clientX - downX, dy = e.clientY - downY;
    if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) return;

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
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!controls.hoverEnabled && !controls.hoverPlantEnabled && !controls.hoverLineageEnabled) { controls.hoveredSpecies = null; controls.hoveredPlantId = null; return; }
    const rect = canvas.getBoundingClientRect();
    const hit = renderer.plantAt(e.clientX - rect.left, e.clientY - rect.top);
    controls.hoveredSpecies = hit ? hit.speciesId : null;
    controls.hoveredPlantId = hit ? hit.plantId : null;
  });

  canvas.addEventListener('mouseleave', () => {
    controls.hoveredSpecies = null;
    controls.hoveredPlantId = null;
  });

  const hoverToggle = document.getElementById('toggle-hover') as HTMLInputElement;
  hoverToggle.addEventListener('change', () => {
    controls.hoverEnabled = hoverToggle.checked;
    if (!controls.hoverEnabled) { controls.hoveredSpecies = null; controls.hoveredPlantId = null; }
  });

  const hoverPlantToggle = document.getElementById('toggle-hover-plant') as HTMLInputElement;
  hoverPlantToggle.addEventListener('change', () => {
    controls.hoverPlantEnabled = hoverPlantToggle.checked;
  });

  const hoverLineageToggle = document.getElementById('toggle-hover-lineage') as HTMLInputElement;
  hoverLineageToggle.addEventListener('change', () => {
    controls.hoverLineageEnabled = hoverLineageToggle.checked;
  });

  return controls;
}

