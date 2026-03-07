import { World, SpeciesColor, Renderer } from './types';
import { speciesColorToRgb, hexToRgba } from './ui-utils';
import { TRAITS } from './trait-defs';
import { getLineageRoot } from './lineage';

export function createLineagePanel(
  container: HTMLElement,
  mapContainer: HTMLElement,
  renderer: Renderer,
) {
  let lastRenderedTick = -1;
  let sortBy: 'count' | string = 'count';
  let lineageMapRef: Map<number, number> = new Map();

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex; flex-direction:column; height:100%; font-family:monospace;';

  const header = document.createElement('div');
  header.style.cssText = `
    display:flex; align-items:center; padding:2px 8px; flex-shrink:0;
    font-size:9px; color:rgba(255,255,255,0.35); border-bottom:1px solid #2a2a2a;
  `;
  wrapper.appendChild(header);

  const body = document.createElement('div');
  body.style.cssText = 'flex:1; overflow-y:auto; overflow-x:hidden;';
  wrapper.appendChild(body);

  container.appendChild(wrapper);

  let rowEls: HTMLElement[] = [];
  let rowOrder: number[] = [];

  interface LineageData {
    rootId: number;
    name: string;
    count: number;
    speciesCount: number;
    color: SpeciesColor;
    avgGenome: Record<string, number>;
  }

  function rebuildRows(data: LineageData[]): void {
    body.innerHTML = '';
    rowEls = [];
    rowOrder = [];

    for (const d of data) {
      const rgb = speciesColorToRgb(d.color);
      const row = document.createElement('div');
      row.className = 'genome-row';

      // Dot
      const dot = document.createElement('div');
      dot.className = 'genome-dot';
      dot.style.background = rgb;
      row.appendChild(dot);

      // Name + species count
      const nameEl = document.createElement('div');
      nameEl.className = 'genome-name';
      nameEl.style.color = rgb;
      nameEl.style.width = '120px';
      nameEl.style.flexShrink = '0';
      nameEl.innerHTML = `${d.name} <span style="color:#888;font-size:9px">${d.speciesCount} sp</span>`;
      row.appendChild(nameEl);

      // Count
      const countEl = document.createElement('div');
      countEl.className = 'genome-count';
      countEl.textContent = String(d.count);
      row.appendChild(countEl);

      // Bars
      const barsEl = document.createElement('div');
      barsEl.className = 'genome-bars';
      for (const trait of TRAITS) {
        const cell = document.createElement('div');
        cell.className = 'genome-bar-cell';

        const fill = document.createElement('div');
        fill.className = 'genome-bar-fill';
        const val = d.avgGenome[trait.genomeKey];
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
      rowOrder.push(d.rootId);
    }
  }

  function setSortBy(key: string): void {
    sortBy = key;
    lastRenderedTick = -1;
  }

  function buildHeader(total: number): void {
    header.innerHTML = '';

    const countLabel = document.createElement('span');
    countLabel.className = 'genome-count-header lineage-group-count';
    countLabel.textContent = `${total} lineages`;
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

  function setLineageMap(map: Map<number, number>): void {
    lineageMapRef = map;
  }

  function update(world: World): void {
    if (world.tick === lastRenderedTick) return;
    lastRenderedTick = world.tick;

    // Accumulate per-species genome sums
    const speciesBuckets = new Map<number, {
      count: number; root: number; height: number; leaf: number;
      seed: number; sz: number; def: number; wood: number; wst: number; lon: number;
    }>();
    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;
      let b = speciesBuckets.get(plant.speciesId);
      if (!b) {
        b = { count: 0, root: 0, height: 0, leaf: 0, seed: 0, sz: 0, def: 0, wood: 0, wst: 0, lon: 0 };
        speciesBuckets.set(plant.speciesId, b);
      }
      b.count++;
      b.root += plant.genome.rootPriority;
      b.height += plant.genome.heightPriority;
      b.leaf += plant.genome.leafSize;
      b.seed += plant.genome.seedInvestment;
      b.sz += plant.genome.seedSize;
      b.def += plant.genome.defense;
      b.wood += plant.genome.woodiness;
      b.wst += plant.genome.waterStorage;
      b.lon += plant.genome.longevity;
    }

    // Group by lineage root
    const groups = new Map<number, number[]>();
    for (const sid of speciesBuckets.keys()) {
      const root = getLineageRoot(lineageMapRef, sid);
      let g = groups.get(root);
      if (!g) { g = []; groups.set(root, g); }
      g.push(sid);
    }

    // Build lineage data with population-weighted genome averages
    const data: LineageData[] = [];
    for (const [rootId, members] of groups) {
      let totalCount = 0;
      let root = 0, height = 0, leaf = 0, seed = 0, sz = 0, def = 0, wood = 0, wst = 0, lon = 0;
      for (const sid of members) {
        const b = speciesBuckets.get(sid)!;
        totalCount += b.count;
        root += b.root; height += b.height; leaf += b.leaf;
        seed += b.seed; sz += b.sz; def += b.def;
        wood += b.wood; wst += b.wst; lon += b.lon;
      }
      data.push({
        rootId,
        name: world.speciesNames.get(rootId) ?? `Sp ${rootId}`,
        count: totalCount,
        speciesCount: members.length,
        color: world.speciesColors.get(rootId) ?? { r: 0.5, g: 0.5, b: 0.5 },
        avgGenome: {
          rootPriority: root / totalCount,
          heightPriority: height / totalCount,
          leafSize: leaf / totalCount,
          seedInvestment: seed / totalCount,
          seedSize: sz / totalCount,
          defense: def / totalCount,
          woodiness: wood / totalCount,
          waterStorage: wst / totalCount,
          longevity: lon / totalCount,
        },
      });
    }

    // Sort
    if (sortBy === 'count') {
      data.sort((a, b) => b.count - a.count);
    } else {
      const key = sortBy;
      data.sort((a, b) => b.avgGenome[key] - a.avgGenome[key]);
    }

    if (header.childElementCount === 0) buildHeader(data.length);
    else (header.querySelector('.lineage-group-count') as HTMLElement).textContent = `${data.length} lineages`;
    updateHeaderActive();

    const newOrder = data.map(d => d.rootId);
    const orderChanged = newOrder.length !== rowOrder.length ||
      newOrder.some((id, i) => id !== rowOrder[i]);

    if (orderChanged) {
      rebuildRows(data);
    } else {
      for (let i = 0; i < data.length; i++) {
        const row = rowEls[i];
        const d = data[i];
        const countEl = row.querySelector('.genome-count') as HTMLElement;
        countEl.textContent = String(d.count);

        const nameEl = row.querySelector('.genome-name') as HTMLElement;
        nameEl.innerHTML = `${d.name} <span style="color:#888;font-size:9px">${d.speciesCount} sp</span>`;

        const bars = row.querySelectorAll('.genome-bar-cell');
        TRAITS.forEach((trait, t) => {
          const cell = bars[t];
          const fill = cell.querySelector('.genome-bar-fill') as HTMLElement;
          const valEl = cell.querySelector('.genome-bar-val') as HTMLElement;
          const val = d.avgGenome[trait.genomeKey];
          fill.style.width = (val * 100) + '%';
          valEl.textContent = val.toFixed(2);
        });
      }
    }
  }

  function reset(): void {
    lastRenderedTick = -1;
  }

  return { update, setLineageMap, reset };
}
