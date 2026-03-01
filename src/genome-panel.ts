import { World, SpeciesColor } from './types';

const TRAITS = [
  { key: 'rootPriority' as const, label: 'Root', color: '#c96' },
  { key: 'heightPriority' as const, label: 'Height', color: '#69c' },
  { key: 'leafSize' as const, label: 'Leaf', color: '#6c6' },
  { key: 'seedInvestment' as const, label: 'Seed', color: '#c6c' },
];

const MAX_SPECIES = 6;

interface SpeciesGenomeData {
  speciesId: number;
  name: string;
  count: number;
  color: SpeciesColor;
  avgGenome: { rootPriority: number; heightPriority: number; leafSize: number; seedInvestment: number };
}

export function createGenomePanel(container: HTMLElement) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  let w = 0, h = 0;
  let lastRenderedTick = -1;

  function resize() {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    w = rect.width;
    h = rect.height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lastRenderedTick = -1;
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function gatherData(world: World): SpeciesGenomeData[] {
    const buckets = new Map<number, { count: number; root: number; height: number; leaf: number; seed: number }>();

    for (const plant of world.plants.values()) {
      if (!plant.alive) continue;
      let b = buckets.get(plant.speciesId);
      if (!b) {
        b = { count: 0, root: 0, height: 0, leaf: 0, seed: 0 };
        buckets.set(plant.speciesId, b);
      }
      b.count++;
      b.root += plant.genome.rootPriority;
      b.height += plant.genome.heightPriority;
      b.leaf += plant.genome.leafSize;
      b.seed += plant.genome.seedInvestment;
    }

    const sorted = [...buckets.entries()].sort((a, b) => b[1].count - a[1].count);
    return sorted.slice(0, MAX_SPECIES).map(([speciesId, b]) => ({
      speciesId,
      name: world.speciesNames.get(speciesId) ?? `Sp ${speciesId}`,
      count: b.count,
      color: world.speciesColors.get(speciesId) ?? { r: 0.5, g: 0.5, b: 0.5 },
      avgGenome: {
        rootPriority: b.root / b.count,
        heightPriority: b.height / b.count,
        leafSize: b.leaf / b.count,
        seedInvestment: b.seed / b.count,
      },
    }));
  }

  function update(world: World): void {
    if (world.tick === lastRenderedTick) return;
    lastRenderedTick = world.tick;

    const data = gatherData(world);
    if (data.length === 0) return;

    ctx.clearRect(0, 0, w, h);

    const pad = { left: 8, right: 8, top: 6, bottom: 4 };
    const usableW = w - pad.left - pad.right;
    const usableH = h - pad.top - pad.bottom;
    if (usableW <= 0 || usableH <= 0) return;

    const rowH = Math.min(22, usableH / data.length);
    const nameColW = Math.min(140, usableW * 0.22);
    const countColW = 36;
    const barAreaLeft = pad.left + nameColW + countColW;
    const barAreaW = usableW - nameColW - countColW - 4;
    const barGroupW = barAreaW / TRAITS.length;
    const barH = Math.min(14, rowH - 4);

    // Header row
    ctx.font = '9px monospace';
    ctx.textBaseline = 'bottom';
    const headerY = pad.top + 10;

    // "Top 6" label
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'left';
    ctx.fillText('Top ' + data.length, pad.left, headerY);

    for (let t = 0; t < TRAITS.length; t++) {
      ctx.fillStyle = TRAITS[t].color;
      ctx.textAlign = 'center';
      ctx.fillText(TRAITS[t].label, barAreaLeft + t * barGroupW + barGroupW / 2, headerY);
    }

    const startY = headerY + 3;

    for (let i = 0; i < data.length; i++) {
      const sp = data[i];
      const y = startY + i * rowH;
      const barY = y + (rowH - barH) / 2;

      // Species color dot
      const sc = sp.color;
      const rgb = `rgb(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)})`;
      ctx.fillStyle = rgb;
      ctx.fillRect(pad.left, barY + barH / 2 - 4, 8, 8);

      // Species name
      ctx.fillStyle = rgb;
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(sp.name, pad.left + 12, y + rowH / 2, nameColW - 16);

      // Count
      ctx.fillStyle = '#888';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(sp.count), pad.left + nameColW + countColW - 4, y + rowH / 2);

      // Genome bars
      for (let t = 0; t < TRAITS.length; t++) {
        const val = sp.avgGenome[TRAITS[t].key];
        const bx = barAreaLeft + t * barGroupW + 2;
        const bw = (barGroupW - 4) * val;

        // Background track
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(bx, barY, barGroupW - 4, barH);

        // Value bar
        ctx.fillStyle = TRAITS[t].color + '99';
        ctx.fillRect(bx, barY, bw, barH);

        // Value label inside bar
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toFixed(2), bx + (barGroupW - 4) / 2, barY + barH / 2);
      }
    }
  }

  function destroy(): void {
    ro.disconnect();
    canvas.remove();
  }

  return { update, destroy };
}
