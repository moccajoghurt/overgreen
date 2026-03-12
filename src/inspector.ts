import { SIM, World, WeatherOverlay } from './types';
import type { Controls } from './controls';

export function updateInspector(world: World, controls: Controls): void {
  const el = document.getElementById('inspector')!;
  if (!controls.selectedCell) {
    el.textContent = 'Click a cell to inspect...';
    return;
  }

  const { x, y } = controls.selectedCell;
  const cell = world.grid[y][x];
  const terrainNames = ['Soil', 'River', 'Rock', 'Hill', 'Wetland', 'Arid'];
  const zoneNames = ['Temperate', 'Tropical', 'Mediterranean', 'Desert'];
  let text = `Cell (${x}, ${y})  ${terrainNames[cell.terrainType]}  ${zoneNames[cell.climateZone]}  Elev: ${cell.elevation.toFixed(2)}\n`;
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

  // Show all tier plants
  const tierLabels = ['Ground', 'Understory', 'Canopy'];
  const tierIds = [cell.groundId, cell.understoryId, cell.canopyId];
  let hasAnyPlant = false;
  for (let t = tierIds.length - 1; t >= 0; t--) {
    const pid = tierIds[t];
    if (pid === null) continue;
    const plant = world.plants.get(pid);
    if (!plant) continue;
    hasAnyPlant = true;
    const spName = world.species.get(plant.speciesId)?.name ?? `Sp ${plant.speciesId}`;
    const w = plant.genome.woodiness;
    const arcLabel = w < 0.25 ? 'Herb' : w < 0.5 ? 'Shrubby' : w < 0.75 ? 'Woody' : 'Tree';
    text += `\n[${tierLabels[t]}] Plant #${plant.id}  ${spName}  (${arcLabel})  Age: ${plant.age}\n`;
    text += `Gen: ${plant.generation}  Parent: ${plant.parentId ?? 'founder'}  Offspring: ${plant.offspringCount}\n`;
    text += `Height: ${plant.height.toFixed(1)}  Root: ${plant.rootDepth.toFixed(1)}  Leaf: ${plant.leafArea.toFixed(1)}\n`;
    text += `Energy: ${plant.energy.toFixed(1)}\n`;
    text += `Genome: R=${plant.genome.rootPriority.toFixed(2)} H=${plant.genome.heightPriority.toFixed(2)} L=${plant.genome.leafSize.toFixed(2)} SI=${plant.genome.seedInvestment.toFixed(2)} SM=${plant.genome.seedSize.toFixed(2)} D=${plant.genome.defense.toFixed(2)} W=${plant.genome.woodiness.toFixed(2)} WS=${plant.genome.waterStorage.toFixed(2)} Lon=${plant.genome.longevity.toFixed(2)}\n`;
    const wsCap = plant.genome.waterStorage * SIM.WATER_STORAGE_CAPACITY;
    text += `Stored Water: ${plant.storedWater.toFixed(1)} / ${wsCap.toFixed(1)}\n`;
    text += `Light: ${plant.lastLightReceived.toFixed(2)}  EffLight: ${plant.effectiveLight.toFixed(2)}  Water: ${plant.lastWaterAbsorbed.toFixed(2)}\n`;
    text += `Energy +${plant.lastEnergyProduced.toFixed(2)}  Maint -${plant.lastMaintenanceCost.toFixed(2)}`;
    const net = plant.lastEnergyProduced - plant.lastMaintenanceCost;
    text += `  Net ${net >= 0 ? '+' : ''}${net.toFixed(2)}`;
  }
  if (!hasAnyPlant) {
    text += '\nNo plant on this cell.';
    if (cell.lastSpeciesId !== null) {
      const lastName = world.species.get(cell.lastSpeciesId!)?.name ?? `Sp ${cell.lastSpeciesId}`;
      text += `\nLast: ${lastName}`;
    }
  }

  // Show dormant seeds
  if (cell.seeds.length > 0) {
    text += `\n\nDormant Seeds: ${cell.seeds.length}`;
    for (const seed of cell.seeds) {
      const seedName = world.species.get(seed.speciesId)?.name ?? `Sp ${seed.speciesId}`;
      text += `\n  ${seedName}  E:${seed.energy.toFixed(1)}  Age:${seed.age}`;
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
