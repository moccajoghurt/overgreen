import { World, Renderer, History } from './types';
import { speciesCentroid, speciesColorToRgb, hexToRgba } from './ui-utils';
import { TRAITS } from './trait-defs';

const UPDATE_EVERY_N_TICKS = 10;
const LERP_SPEED = 0.08; // per frame — smooth but responsive

const SPARKLINE_W = 120;
const SPARKLINE_H = 36;
const SPARKLINE_DPR = 2;
const MAX_SPARK_POINTS = 80;

interface LabelEntry {
  el: HTMLElement;
  nameEl: HTMLElement;
  genEl: HTMLElement;
  barFills: HTMLElement[];
  sparkCanvas: HTMLCanvasElement;
  sparkCtx: CanvasRenderingContext2D;
  targetX: number;
  targetY: number;
  displayX: number;
  displayY: number;
  screenX: number;
  screenY: number;
}

export function createSpeciesLabelsOverlay(
  mapContainer: HTMLElement,
  renderer: Renderer,
) {
  const labels = new Map<number, LabelEntry>();
  let showAll = false;
  let hoveredSpecies: number | null = null;
  let lastUpdateTick = -UPDATE_EVERY_N_TICKS;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute; top:0; left:0; width:100%; height:100%;
    pointer-events:none; z-index:9; overflow:hidden;
  `;
  mapContainer.appendChild(overlay);

  function createLabel(name: string, rgb: string) {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute; transform:translate(-50%, -100%);
      background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
      border-left:3px solid ${rgb};
      padding:5px 12px; border-radius:0 4px 4px 0;
      color:${rgb}; font-family:monospace; font-size:16px; font-weight:bold;
      text-shadow:0 1px 3px rgba(0,0,0,0.7);
      white-space:nowrap;
    `;

    const nameEl = document.createElement('div');
    nameEl.textContent = name;
    el.appendChild(nameEl);

    const genEl = document.createElement('div');
    genEl.style.cssText = `font-size:11px; font-weight:normal; color:#fff; opacity:0.7;`;
    el.appendChild(genEl);

    // Genome bars (vertical equalizer)
    const barsContainer = document.createElement('div');
    barsContainer.style.cssText = `
      display:flex; gap:2px; width:${SPARKLINE_W}px; height:24px;
      margin-top:3px;
    `;
    const barFills: HTMLElement[] = [];
    for (const trait of TRAITS) {
      const col = document.createElement('div');
      col.style.cssText = `
        flex:1; position:relative;
        background:rgba(255,255,255,0.06);
        border-radius:2px 2px 0 0;
      `;
      const fill = document.createElement('div');
      fill.style.cssText = `
        position:absolute; bottom:0; left:0; width:100%;
        background:${hexToRgba(trait.color, 0.5)};
        border-radius:2px 2px 0 0;
        transition:height 0.3s ease;
      `;
      fill.style.height = '0%';
      col.appendChild(fill);
      barFills.push(fill);

      const lbl = document.createElement('div');
      lbl.style.cssText = `
        position:absolute; bottom:1px; left:0; width:100%;
        text-align:center; font-size:7px; line-height:1;
        color:rgba(255,255,255,0.4);
      `;
      lbl.textContent = trait.label[0];
      col.appendChild(lbl);

      barsContainer.appendChild(col);
    }
    el.appendChild(barsContainer);

    const sparkCanvas = document.createElement('canvas');
    sparkCanvas.width = SPARKLINE_W * SPARKLINE_DPR;
    sparkCanvas.height = SPARKLINE_H * SPARKLINE_DPR;
    sparkCanvas.style.cssText = `
      display:block;
      width:${SPARKLINE_W}px; height:${SPARKLINE_H}px;
      margin-top:2px;
    `;
    el.appendChild(sparkCanvas);

    const sparkCtx = sparkCanvas.getContext('2d')!;
    sparkCtx.scale(SPARKLINE_DPR, SPARKLINE_DPR);

    return { el, nameEl, genEl, barFills, sparkCanvas, sparkCtx };
  }

  function drawSparkline(
    ctx: CanvasRenderingContext2D,
    speciesId: number,
    history: History,
  ): void {
    ctx.save();
    ctx.setTransform(SPARKLINE_DPR, 0, 0, SPARKLINE_DPR, 0, 0);
    ctx.clearRect(0, 0, SPARKLINE_W, SPARKLINE_H);

    const snaps = history.snapshots;
    if (snaps.length < 2) { ctx.restore(); return; }

    const step = Math.max(1, Math.floor(snaps.length / MAX_SPARK_POINTS));

    const points: (Record<string, number> | null)[] = [];
    for (let i = 0; i < snaps.length; i += step) {
      const traits = snaps[i].speciesTraitAverages.get(speciesId);
      points.push(traits ?? null);
    }
    if (snaps.length % step !== 0) {
      const last = snaps[snaps.length - 1].speciesTraitAverages.get(speciesId);
      points.push(last ?? null);
    }

    const n = points.length;
    if (n < 2) { ctx.restore(); return; }

    const xScale = SPARKLINE_W / (n - 1);
    const pad = 1;

    for (let t = 0; t < TRAITS.length; t++) {
      const key = TRAITS[t].shortKey;
      ctx.beginPath();
      ctx.strokeStyle = TRAITS[t].color;
      ctx.lineWidth = 1;
      let started = false;

      for (let i = 0; i < n; i++) {
        const pt = points[i];
        if (!pt) { started = false; continue; }
        const val = pt[key];
        const x = i * xScale;
        const y = pad + (1 - val) * (SPARKLINE_H - 2 * pad);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  function updateGenomeBars(
    entry: LabelEntry,
    speciesId: number,
    history: History,
  ): void {
    const snaps = history.snapshots;
    if (snaps.length === 0) return;
    const traits = snaps[snaps.length - 1].speciesTraitAverages.get(speciesId);
    if (!traits) return;
    for (let i = 0; i < TRAITS.length; i++) {
      const val = (traits as Record<string, number>)[TRAITS[i].shortKey];
      entry.barFills[i].style.height = `${(val * 100).toFixed(1)}%`;
    }
  }

  function updateCentroids(world: World, history: History): void {
    if (world.tick - lastUpdateTick < UPDATE_EVERY_N_TICKS) return;
    lastUpdateTick = world.tick;

    // Gather alive species and their max generation
    const aliveSpecies = new Set<number>();
    const maxGen = new Map<number, number>();
    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;
      aliveSpecies.add(plant.speciesId);
      const prev = maxGen.get(plant.speciesId) ?? 0;
      if (plant.generation > prev) maxGen.set(plant.speciesId, plant.generation);
    }

    // Remove labels for extinct species
    for (const [sid, entry] of labels) {
      if (!aliveSpecies.has(sid)) {
        entry.el.remove();
        labels.delete(sid);
      }
    }

    // Add/update labels for alive species
    for (const sid of aliveSpecies) {
      const pos = speciesCentroid(world, sid);
      if (!pos) continue;

      const sc = world.speciesColors.get(sid);
      const rgb = sc ? speciesColorToRgb(sc) : '#888';
      const name = world.speciesNames.get(sid) ?? `Sp ${sid}`;
      const rec = history.species.get(sid);
      const genText = rec
        ? `Gen ${rec.maxGeneration} · ${rec.totalOffspring} offspring`
        : '';

      const existing = labels.get(sid);
      if (existing) {
        existing.targetX = pos.x;
        existing.targetY = pos.y;
        existing.nameEl.textContent = name;
        existing.genEl.textContent = genText;
        existing.el.style.color = rgb;
        existing.el.style.borderLeftColor = rgb;
      } else {
        const label = createLabel(name, rgb);
        label.genEl.textContent = genText;
        overlay.appendChild(label.el);
        labels.set(sid, {
          ...label,
          targetX: pos.x, targetY: pos.y,
          displayX: pos.x, displayY: pos.y,
          screenX: 0, screenY: 0,
        });
      }
    }

    // Draw sparklines and update genome bars for all visible labels
    for (const [sid, entry] of labels) {
      drawSparkline(entry.sparkCtx, sid, history);
      updateGenomeBars(entry, sid, history);
    }
  }

  function updatePositions(): void {
    for (const [sid, entry] of labels) {
      // Lerp display position toward target
      entry.displayX += (entry.targetX - entry.displayX) * LERP_SPEED;
      entry.displayY += (entry.targetY - entry.displayY) * LERP_SPEED;

      const shouldShow = showAll || sid === hoveredSpecies;
      const screen = renderer.projectToScreen(entry.displayX, entry.displayY);
      if (screen && shouldShow) {
        entry.screenX = screen.x;
        entry.screenY = screen.y;
        entry.el.style.left = `${screen.x}px`;
        entry.el.style.top = `${screen.y}px`;
        entry.el.style.display = '';
      } else {
        entry.el.style.display = 'none';
      }
    }
  }

  function setVisible(show: boolean): void {
    showAll = show;
  }

  function setHoveredSpecies(speciesId: number | null): void {
    hoveredSpecies = speciesId;
  }

  function update(world: World, history: History): void {
    updateCentroids(world, history);
    updatePositions();
  }

  return { update, updatePositions, setVisible, setHoveredSpecies };
}
