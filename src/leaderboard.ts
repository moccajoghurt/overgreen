import { World } from './types';

export function updateLeaderboard(world: World): void {
  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;

  const counts = new Map<number, number>();
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    counts.set(plant.speciesId, (counts.get(plant.speciesId) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 10);

  let html = '';
  for (const [speciesId, count] of top) {
    const sc = world.speciesColors.get(speciesId);
    const rgb = sc
      ? `rgb(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)})`
      : '#888';
    html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">`;
    html += `<span style="display:inline-block;width:10px;height:10px;background:${rgb};border:1px solid #555;flex-shrink:0;"></span>`;
    html += `<span style="color:${rgb}">Sp ${speciesId}</span>`;
    html += `<span style="margin-left:auto;">${count}</span>`;
    html += `</div>`;
  }

  const totalSpecies = counts.size;
  const totalPlants = [...counts.values()].reduce((a, b) => a + b, 0);
  html += `<div style="color:#666;margin-top:4px;border-top:1px solid #333;padding-top:2px;">${totalSpecies} species / ${totalPlants} plants</div>`;

  listEl.innerHTML = html;
}
