import { World } from './types';
import type { TimingHooks } from './perf';
import { phaseEnvironment } from './simulation/environment';
import { phaseRechargeWater } from './simulation/water';
import { phaseCalculateLight } from './simulation/light';
import { phaseTierAssignment, phaseTierLight } from './simulation/tiers';
import { phaseUpdatePlants } from './simulation/growth';
import { phaseHerbivores } from './simulation/herbivores';
import { phaseDeath } from './simulation/death';
import { phaseDecomposition } from './simulation/decomposition';
import { phaseGermination } from './simulation/germination';

export { createWorld } from './simulation/terrain';
export { seedInitialPlants, seedSinglePlant } from './simulation/plants';
export { spawnFire, spawnDisease } from './simulation/environment';
export { sandboxPlacePlant, removePlantsBySpecies, clearAllPlants } from './simulation/sandbox-ops';

/** Clear renderer event arrays. Call once per frame before the tick batch. */
export function clearFrameEvents(world: World): void {
  world.seedLandingEvents.length = 0;
  world.germinationEvents.length = 0;
  world.fireDeathEvents.length = 0;
  world.heightChangedIds.clear();
}

export function tickWorld(world: World, hooks?: TimingHooks): void {
  // Per-tick arrays consumed by history/diagnostics — must clear each tick
  world.deathEvents.length = 0;
  world.seedsAttempted = 0;
  world.environmentEvents.length = 0;
  world.speciationEvents.length = 0;
  hooks?.begin('environment');  phaseEnvironment(world);       hooks?.end('environment');
  hooks?.begin('rechargeWater'); phaseRechargeWater(world);    hooks?.end('rechargeWater');
  hooks?.begin('calculateLight'); phaseCalculateLight(world);  hooks?.end('calculateLight');
  hooks?.begin('tierAssignment'); phaseTierAssignment(world);  hooks?.end('tierAssignment');
  hooks?.begin('tierLight');    phaseTierLight(world);         hooks?.end('tierLight');
  hooks?.begin('updatePlants'); phaseUpdatePlants(world);      hooks?.end('updatePlants');
  hooks?.begin('herbivores');   phaseHerbivores(world);        hooks?.end('herbivores');
  hooks?.begin('death');        phaseDeath(world);             hooks?.end('death');
  hooks?.begin('decomposition'); phaseDecomposition(world);    hooks?.end('decomposition');
  hooks?.begin('germination');  phaseGermination(world);       hooks?.end('germination');
  world.tick++;
}
