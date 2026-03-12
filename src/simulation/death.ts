import { SIM, World, getPlantConstants } from '../types';

export function phaseDeath(world: World): void {
  for (const plant of world.plants.values()) {
    if (!plant.alive) continue;
    const maxAge = getPlantConstants(plant.genome).maxAge;

    // Environmental stress mortality — poorly adapted plants die from environmental pressure
    if (plant.age > 10) { // skip seedlings
      const traitMod = plant.lastTraitModifier;
      const stressGap = SIM.STRESS_MORTALITY_THRESHOLD - traitMod;
      if (stressGap > 0 && Math.random() < stressGap * SIM.STRESS_MORTALITY_RATE) {
        plant.alive = false;
        world.deathEvents.push({
          id: plant.id,
          speciesId: plant.speciesId,
          cause: 'stress',
          age: plant.age,
          offspringCount: plant.offspringCount,
          generation: plant.generation,
        });
        continue;
      }
    }

    if (plant.energy <= SIM.STARVATION_THRESHOLD || plant.age >= maxAge) {
      plant.alive = false;

      // Use disease flag computed in phaseUpdatePlants
      let cause: 'starvation' | 'age' | 'disease' = plant.age >= maxAge ? 'age' : 'starvation';
      if (cause === 'starvation' && plant.isDiseased) {
        cause = 'disease';
        plant.causeOfDeath = 'disease';
        for (const disease of world.environment.diseases) {
          if (disease.cells.has(`${plant.x},${plant.y}`)) {
            disease.killCount++;
            break;
          }
        }
      }

      world.deathEvents.push({
        id: plant.id,
        speciesId: plant.speciesId,
        cause,
        age: plant.age,
        offspringCount: plant.offspringCount,
        generation: plant.generation,
      });
    }
  }
}
