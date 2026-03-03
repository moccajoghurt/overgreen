import { SIM, World, Renderer, WeatherOverlay } from './types';

export interface Controls {
  paused: boolean;
  tickInterval: number; // ms between ticks
  stepRequested: boolean;
  selectedCell: { x: number; y: number } | null;
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

  return controls;
}

export function updateInspector(world: World, controls: Controls): void {
  const el = document.getElementById('inspector')!;
  if (!controls.selectedCell) {
    el.textContent = 'Click a cell to inspect...';
    return;
  }

  const { x, y } = controls.selectedCell;
  const cell = world.grid[y][x];
  const terrainNames = ['Soil', 'River', 'Rock', 'Hill'];
  let text = `Cell (${x}, ${y})  ${terrainNames[cell.terrainType]}  Elev: ${cell.elevation.toFixed(2)}\n`;
  text += `Water: ${cell.waterLevel.toFixed(1)} / ${SIM.MAX_WATER}  Recharge: ${cell.waterRechargeRate.toFixed(2)}\n`;
  text += `Nutrients: ${cell.nutrients.toFixed(1)}\n`;
  text += `Light: ${cell.lightLevel.toFixed(2)}\n`;

  const env = world.environment;
  const overlayVal = env.weatherOverlay[y * world.width + x];
  if (overlayVal === WeatherOverlay.Drought) text += `  [DROUGHT]\n`;
  else if (overlayVal === WeatherOverlay.Burning) text += `  [BURNING]\n`;
  else if (overlayVal === WeatherOverlay.Scorched) text += `  [SCORCHED]\n`;
  else if (overlayVal === WeatherOverlay.Parched) text += `  [PARCHED]\n`;
  else if (overlayVal === WeatherOverlay.Diseased) text += `  [DISEASED]\n`;
  else if (overlayVal === WeatherOverlay.Blighted) text += `  [BLIGHTED]\n`;

  if (cell.plantId !== null) {
    const plant = world.plants.get(cell.plantId);
    if (plant) {
      const spName = world.speciesNames.get(plant.speciesId) ?? `Sp ${plant.speciesId}`;
      text += `\n[Plant #${plant.id}]  ${spName}  Age: ${plant.age}\n`;
      text += `Gen: ${plant.generation}  Parent: ${plant.parentId ?? 'founder'}  Offspring: ${plant.offspringCount}\n`;
      text += `Height: ${plant.height.toFixed(1)}  Root: ${plant.rootDepth.toFixed(1)}  Leaf: ${plant.leafArea.toFixed(1)}\n`;
      text += `Energy: ${plant.energy.toFixed(1)}\n`;
      text += `Genome: R=${plant.genome.rootPriority.toFixed(2)} H=${plant.genome.heightPriority.toFixed(2)} L=${plant.genome.leafSize.toFixed(2)} S=${plant.genome.seedInvestment.toFixed(2)} A=${plant.genome.allelopathy.toFixed(2)} D=${plant.genome.defense.toFixed(2)}\n`;
      text += `\nLight: ${plant.lastLightReceived.toFixed(2)}  Water: ${plant.lastWaterAbsorbed.toFixed(2)}\n`;
      text += `Energy +${plant.lastEnergyProduced.toFixed(2)}  Maint -${plant.lastMaintenanceCost.toFixed(2)}`;
      const net = plant.lastEnergyProduced - plant.lastMaintenanceCost;
      text += `  Net ${net >= 0 ? '+' : ''}${net.toFixed(2)}`;
    }
  } else {
    text += '\nNo plant on this cell.';
    if (cell.lastSpeciesId !== null) {
      const lastName = world.speciesNames.get(cell.lastSpeciesId!) ?? `Sp ${cell.lastSpeciesId}`;
      text += `\nLast: ${lastName}`;
    }
  }

  // Herbivores at this cell
  for (const h of world.herbivores.values()) {
    if (h.x === x && h.y === y && h.alive) {
      text += `\n\n[Deer #${h.id}]  Age: ${h.age}`;
      text += `\nEnergy: ${h.energy.toFixed(1)}`;
      text += `\nGenome: Spd=${h.genome.speed.toFixed(2)} App=${h.genome.appetite.toFixed(2)} Hrd=${h.genome.herdInstinct.toFixed(2)} Rep=${h.genome.reproduction.toFixed(2)}`;
      text += `\nGrazed +${h.lastEnergyGained.toFixed(2)}  Maint -${h.lastMaintenanceCost.toFixed(2)}`;
    }
  }

  el.textContent = text;
}
