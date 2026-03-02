import { World, Renderer } from './types';
import { speciesCentroid, speciesColorToRgb } from './ui-utils';

const UPDATE_EVERY_N_TICKS = 10;
const LERP_SPEED = 0.08; // per frame — smooth but responsive

interface LabelEntry {
  el: HTMLElement;
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
  let visible = false;
  let lastUpdateTick = -UPDATE_EVERY_N_TICKS;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute; top:0; left:0; width:100%; height:100%;
    pointer-events:none; z-index:9; overflow:hidden; display:none;
  `;
  mapContainer.appendChild(overlay);

  function createLabel(name: string, rgb: string): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute; transform:translate(-50%, -100%);
      background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
      border-left:3px solid ${rgb};
      padding:3px 8px; border-radius:0 4px 4px 0;
      color:${rgb}; font-family:monospace; font-size:11px; font-weight:bold;
      text-shadow:0 1px 3px rgba(0,0,0,0.7);
      white-space:nowrap;
    `;
    el.textContent = name;
    return el;
  }

  function updateCentroids(world: World): void {
    if (world.tick - lastUpdateTick < UPDATE_EVERY_N_TICKS) return;
    lastUpdateTick = world.tick;

    // Gather alive species
    const aliveSpecies = new Set<number>();
    for (const plant of world.plants.values()) {
      if (plant.alive) aliveSpecies.add(plant.speciesId);
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

      const existing = labels.get(sid);
      if (existing) {
        existing.targetX = pos.x;
        existing.targetY = pos.y;
        const sc = world.speciesColors.get(sid);
        const rgb = sc ? speciesColorToRgb(sc) : '#888';
        const name = world.speciesNames.get(sid) ?? `Sp ${sid}`;
        existing.el.textContent = name;
        existing.el.style.color = rgb;
        existing.el.style.borderLeftColor = rgb;
      } else {
        const sc = world.speciesColors.get(sid);
        const rgb = sc ? speciesColorToRgb(sc) : '#888';
        const name = world.speciesNames.get(sid) ?? `Sp ${sid}`;
        const el = createLabel(name, rgb);
        overlay.appendChild(el);
        labels.set(sid, {
          el,
          targetX: pos.x, targetY: pos.y,
          displayX: pos.x, displayY: pos.y,
          screenX: 0, screenY: 0,
        });
      }
    }
  }

  function updatePositions(): void {
    for (const entry of labels.values()) {
      // Lerp display position toward target
      entry.displayX += (entry.targetX - entry.displayX) * LERP_SPEED;
      entry.displayY += (entry.targetY - entry.displayY) * LERP_SPEED;

      const screen = renderer.projectToScreen(entry.displayX, entry.displayY);
      if (screen) {
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
    visible = show;
    overlay.style.display = show ? '' : 'none';
  }

  function update(world: World): void {
    if (!visible) return;
    updateCentroids(world);
    updatePositions();
  }

  return { update, updatePositions, setVisible };
}
