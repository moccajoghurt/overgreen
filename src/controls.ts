import { SIM, World } from './types';
import { Renderer } from './renderer';

export interface Controls {
  paused: boolean;
  ticksPerFrame: number;
  selectedCell: { x: number; y: number } | null;
}

export function initControls(
  canvas: HTMLCanvasElement,
  renderer: Renderer,
  world: World,
): Controls {
  const controls: Controls = {
    paused: false,
    ticksPerFrame: 1,
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
    // main loop handles the single step via a flag
    (controls as Controls & { stepRequested?: boolean }).stepRequested = true;
  });

  speedSlider.addEventListener('input', () => {
    controls.ticksPerFrame = parseInt(speedSlider.value, 10);
    speedLabel.textContent = speedSlider.value;
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
  let text = `Cell (${x}, ${y})\n`;
  text += `Water: ${cell.waterLevel.toFixed(1)} / ${SIM.MAX_WATER}  Recharge: ${cell.waterRechargeRate.toFixed(2)}\n`;
  text += `Nutrients: ${cell.nutrients.toFixed(1)}\n`;
  text += `Light: ${cell.lightLevel.toFixed(2)}\n`;

  if (cell.plantId !== null) {
    const plant = world.plants.get(cell.plantId);
    if (plant) {
      text += `\n[Plant #${plant.id}]  Age: ${plant.age}\n`;
      text += `Height: ${plant.height.toFixed(1)}  Root: ${plant.rootDepth.toFixed(1)}  Leaf: ${plant.leafArea.toFixed(1)}\n`;
      text += `Energy: ${plant.energy.toFixed(1)}\n`;
      text += `Genome: R=${plant.genome.rootPriority.toFixed(2)} H=${plant.genome.heightPriority.toFixed(2)} L=${plant.genome.leafSize.toFixed(2)} S=${plant.genome.seedInvestment.toFixed(2)}\n`;
      text += `\nLight: ${plant.lastLightReceived.toFixed(2)}  Water: ${plant.lastWaterAbsorbed.toFixed(2)}\n`;
      text += `Energy +${plant.lastEnergyProduced.toFixed(2)}  Maint -${plant.lastMaintenanceCost.toFixed(2)}`;
      const net = plant.lastEnergyProduced - plant.lastMaintenanceCost;
      text += `  Net ${net >= 0 ? '+' : ''}${net.toFixed(2)}`;
    }
  } else {
    text += '\nNo plant on this cell.';
  }

  el.textContent = text;
}
