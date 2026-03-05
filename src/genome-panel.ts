import { World, SpeciesColor, Renderer } from './types';
import { speciesCentroid, speciesColorToRgb, hexToRgba } from './ui-utils';
import { createFloatingLabels } from './floating-labels';
import { TRAITS } from './trait-defs';

export function createGenomePanel(
  container: HTMLElement,
  mapContainer: HTMLElement,
  renderer: Renderer,
) {
  let lastRenderedTick = -1;
  let lastWorld: World | null = null;
  let sortBy: 'count' | string = 'count'; // 'count' or a trait key

  // Build DOM structure
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; flex-direction:column; height:100%; font-family:monospace;';

  // Sticky header
  const header = document.createElement('div');
  header.style.cssText = `
    display:flex; align-items:center; padding:2px 8px; flex-shrink:0;
    font-size:9px; color:rgba(255,255,255,0.35); border-bottom:1px solid #2a2a2a;
  `;
  wrapper.appendChild(header);

  // Scrollable body
  const body = document.createElement('div');
  body.style.cssText = 'flex:1; overflow-y:auto; overflow-x:hidden;';
  wrapper.appendChild(body);

  container.appendChild(wrapper);

  // Floating labels
  const labels = createFloatingLabels(mapContainer, renderer, {
    zIndex: 11, holdMs: 5000, fadeMs: 600, animPrefix: 'genome-label', maxLabels: 0,
  });

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    .genome-row {
      display:flex; align-items:center; padding:2px 8px; cursor:pointer;
      border-bottom:1px solid rgba(255,255,255,0.03);
    }
    .genome-row:hover { background:rgba(255,255,255,0.04); }
    .genome-dot {
      width:8px; height:8px; flex-shrink:0; margin-right:6px;
    }
    .genome-name {
      font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .genome-count {
      font-size:9px; color:#888; text-align:right; flex-shrink:0; width:32px; margin-left:auto;
    }
    .genome-bars {
      display:flex; flex:1; gap:2px; margin-left:8px;
    }
    .genome-bar-cell {
      flex:1; position:relative; height:14px; background:rgba(255,255,255,0.06);
    }
    .genome-bar-fill {
      position:absolute; top:0; left:0; height:100%;
    }
    .genome-bar-val {
      position:absolute; top:0; left:0; width:100%; height:100%;
      display:flex; align-items:center; justify-content:center;
      font-size:8px; color:rgba(255,255,255,0.6);
    }
    .genome-sort-header {
      flex:1; text-align:center; cursor:pointer; padding:1px 0;
      border-bottom:2px solid transparent; transition:border-color 0.15s;
    }
    .genome-sort-header:hover { color:#fff !important; }
    .genome-sort-header.active { border-bottom-color:currentColor; color:#fff !important; }
    .genome-count-header {
      cursor:pointer; padding:1px 0;
      border-bottom:2px solid transparent; transition:border-color 0.15s;
    }
    .genome-count-header:hover { color:#aaa !important; }
    .genome-count-header.active { border-bottom-color:#888; color:#ccc !important; }
  `;
  document.head.appendChild(style);


  function handleRowClick(speciesId: number, name: string, color: SpeciesColor): void {
    if (!lastWorld) return;
    const pos = speciesCentroid(lastWorld, speciesId);
    if (!pos) return;
    renderer.moveTo(pos.x, pos.y);
    labels.show(name, speciesColorToRgb(color), pos.x, pos.y);
  }

  // Track rows so we can update in-place instead of recreating DOM
  let rowEls: HTMLElement[] = [];
  let rowSpeciesOrder: number[] = [];

  function rebuildRows(
    data: { speciesId: number; name: string; count: number; color: SpeciesColor;
      avgGenome: Record<string, number> }[],
  ): void {
    body.innerHTML = '';
    rowEls = [];
    rowSpeciesOrder = [];

    for (const sp of data) {
      const rgb = speciesColorToRgb(sp.color);
      const row = document.createElement('div');
      row.className = 'genome-row';
      row.addEventListener('click', () => handleRowClick(sp.speciesId, sp.name, sp.color));

      // Dot
      const dot = document.createElement('div');
      dot.className = 'genome-dot';
      dot.style.background = rgb;
      row.appendChild(dot);

      // Name
      const nameEl = document.createElement('div');
      nameEl.className = 'genome-name';
      nameEl.style.color = rgb;
      nameEl.style.width = '120px';
      nameEl.style.flexShrink = '0';
      nameEl.textContent = sp.name;
      row.appendChild(nameEl);

      // Count
      const countEl = document.createElement('div');
      countEl.className = 'genome-count';
      countEl.textContent = String(sp.count);
      row.appendChild(countEl);

      // Bars
      const barsEl = document.createElement('div');
      barsEl.className = 'genome-bars';
      for (const trait of TRAITS) {
        const cell = document.createElement('div');
        cell.className = 'genome-bar-cell';

        const fill = document.createElement('div');
        fill.className = 'genome-bar-fill';
        const val = sp.avgGenome[trait.genomeKey];
        fill.style.width = (val * 100) + '%';
        fill.style.background = hexToRgba(trait.color, 0.6);
        cell.appendChild(fill);

        const valEl = document.createElement('div');
        valEl.className = 'genome-bar-val';
        valEl.textContent = val.toFixed(2);
        cell.appendChild(valEl);

        barsEl.appendChild(cell);
      }
      row.appendChild(barsEl);

      body.appendChild(row);
      rowEls.push(row);
      rowSpeciesOrder.push(sp.speciesId);
    }
  }

  function setSortBy(key: string): void {
    sortBy = key;
    lastRenderedTick = -1; // force re-sort on next update
  }

  function buildHeader(total: number): void {
    header.innerHTML = '';

    // Species count + count sort header
    const countLabel = document.createElement('span');
    countLabel.className = 'genome-count-header genome-species-count';
    countLabel.textContent = `${total} species`;
    countLabel.style.cssText = 'width:168px; flex-shrink:0; color:#666;';
    countLabel.addEventListener('click', () => setSortBy('count'));
    header.appendChild(countLabel);

    for (const trait of TRAITS) {
      const lbl = document.createElement('span');
      lbl.className = 'genome-sort-header';
      lbl.dataset.sortKey = trait.genomeKey;
      lbl.textContent = trait.label;
      lbl.style.color = trait.color;
      lbl.addEventListener('click', () => setSortBy(trait.genomeKey));
      header.appendChild(lbl);
    }
  }

  function updateHeaderActive(): void {
    const countEl = header.querySelector('.genome-count-header') as HTMLElement;
    if (countEl) countEl.classList.toggle('active', sortBy === 'count');
    header.querySelectorAll('.genome-sort-header').forEach(el => {
      (el as HTMLElement).classList.toggle('active', (el as HTMLElement).dataset.sortKey === sortBy);
    });
  }

  function update(world: World): void {
    lastWorld = world;

    labels.updatePositions();

    // Rebuild table on new ticks
    if (world.tick === lastRenderedTick) return;
    lastRenderedTick = world.tick;

    // Gather all species (no limit)
    const buckets = new Map<number, { count: number; root: number; height: number; leaf: number; seed: number; allelo: number; def: number; wood: number }>();
    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;
      let b = buckets.get(plant.speciesId);
      if (!b) {
        b = { count: 0, root: 0, height: 0, leaf: 0, seed: 0, allelo: 0, def: 0, wood: 0 };
        buckets.set(plant.speciesId, b);
      }
      b.count++;
      b.root += plant.genome.rootPriority;
      b.height += plant.genome.heightPriority;
      b.leaf += plant.genome.leafSize;
      b.seed += plant.genome.seedInvestment;
      b.allelo += plant.genome.allelopathy;
      b.def += plant.genome.defense;
      b.wood += plant.genome.woodiness;
    }

    const sorted = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count);
    const data = sorted.map(([speciesId, b]) => ({
      speciesId,
      name: world.speciesNames.get(speciesId) ?? `Sp ${speciesId}`,
      count: b.count,
      color: world.speciesColors.get(speciesId) ?? { r: 0.5, g: 0.5, b: 0.5 },
      avgGenome: {
        rootPriority: b.root / b.count,
        heightPriority: b.height / b.count,
        leafSize: b.leaf / b.count,
        seedInvestment: b.seed / b.count,
        allelopathy: b.allelo / b.count,
        defense: b.def / b.count,
        woodiness: b.wood / b.count,
      } as Record<string, number>,
    }));

    // Update header (only rebuild once, then update active state)
    if (header.childElementCount === 0) buildHeader(data.length);
    else (header.querySelector('.genome-species-count') as HTMLElement).textContent = `${data.length} species`;
    updateHeaderActive();

    // Sort data
    if (sortBy !== 'count') {
      const key = sortBy;
      data.sort((a, b) => b.avgGenome[key] - a.avgGenome[key]);
    }

    // Check if species order changed — if so, full rebuild
    const newOrder = data.map(d => d.speciesId);
    const orderChanged = newOrder.length !== rowSpeciesOrder.length ||
      newOrder.some((id, i) => id !== rowSpeciesOrder[i]);

    if (orderChanged) {
      rebuildRows(data);
    } else {
      // In-place update of counts and bars
      for (let i = 0; i < data.length; i++) {
        const row = rowEls[i];
        const sp = data[i];
        const countEl = row.querySelector('.genome-count') as HTMLElement;
        countEl.textContent = String(sp.count);

        const bars = row.querySelectorAll('.genome-bar-cell');
        TRAITS.forEach((trait, t) => {
          const cell = bars[t];
          const fill = cell.querySelector('.genome-bar-fill') as HTMLElement;
          const valEl = cell.querySelector('.genome-bar-val') as HTMLElement;
          const val = sp.avgGenome[trait.genomeKey];
          fill.style.width = (val * 100) + '%';
          valEl.textContent = val.toFixed(2);
        });
      }
    }
  }

  function destroy(): void {
    wrapper.remove();
    labels.destroy();
    style.remove();
  }

  function reset(): void {
    lastRenderedTick = -1;
  }

  return { update, destroy, reset };
}
