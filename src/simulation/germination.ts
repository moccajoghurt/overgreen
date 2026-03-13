import { Plant, SIM, TERRAIN_PROPS, World, getPlantConstants } from '../types';
import { inBounds } from './neighbors';
import {
  archetype,
  generateSpeciesColor,
} from './plants';
import { generateSpeciesName } from '../species-names';
import { cellPlantIds, cellHasSpace, setCellPlant, Tier } from './tiers';
import { classifySubtype } from '../types/subtypes';

export function phaseGermination(world: World): void {
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      const cell = world.grid[y][x];
      if (cell.seeds.length === 0) continue;

      // Age and decay all seeds; remove dead ones
      for (let i = cell.seeds.length - 1; i >= 0; i--) {
        const seed = cell.seeds[i];
        seed.age++;
        seed.energy -= SIM.SEED_DECAY_RATE;
        const maxAge = seed.seedMaxAge;
        if (seed.energy <= 0 || seed.age >= maxAge) {
          // Decrement seed population tracking
          const count = world.seedPopulations.get(seed.speciesId) ?? 1;
          if (count <= 1) world.seedPopulations.delete(seed.speciesId);
          else world.seedPopulations.set(seed.speciesId, count - 1);
          cell.seeds[i] = cell.seeds[cell.seeds.length - 1];
          cell.seeds.pop();
        }
      }

      // Germinate if cell has space and has enough water
      if (!cellHasSpace(cell) || cell.seeds.length === 0) continue;

      // Weighted lottery — each qualifying seed's chance proportional to energy.
      // No hard archetype blocks: the trait engine's negative modifiers make
      // poorly-adapted archetypes unviable via stress mortality instead.
      let totalEnergy = 0;
      const qualifying: number[] = [];
      for (let i = 0; i < cell.seeds.length; i++) {
        const seed = cell.seeds[i];
        const waterThreshold = seed.seedGerminationWater;
        if (cell.waterLevel >= waterThreshold) {
          qualifying.push(i);
          totalEnergy += seed.energy;
        }
      }
      let bestIdx = -1;
      if (qualifying.length === 1) {
        bestIdx = qualifying[0];
      } else if (qualifying.length > 1) {
        let roll = Math.random() * totalEnergy;
        for (const idx of qualifying) {
          roll -= cell.seeds[idx].energy;
          if (roll <= 0) { bestIdx = idx; break; }
        }
        if (bestIdx < 0) bestIdx = qualifying[qualifying.length - 1];
      }

      if (bestIdx < 0) continue;
      const winner = cell.seeds[bestIdx];
      cell.seeds[bestIdx] = cell.seeds[cell.seeds.length - 1];
      cell.seeds.pop();

      // Decrement seed population tracking
      const count = world.seedPopulations.get(winner.speciesId) ?? 1;
      if (count <= 1) world.seedPopulations.delete(winner.speciesId);
      else world.seedPopulations.set(winner.speciesId, count - 1);

      // Create plant from seed — large seeds produce larger seedlings
      // On productive terrain, dampen vigor toward 1.0 (resources equalize seedling size)
      const wpc = getPlantConstants(winner.genome);
      const rawVigor = SIM.SEED_SIZE_VIGOR_MIN + winner.genome.seedSize * SIM.SEED_SIZE_VIGOR_RANGE;
      const dampen = TERRAIN_PROPS[cell.terrainType].vigorDampen;
      const seedSizeVigor = Math.max(0.1, rawVigor + (1.0 - rawVigor) * dampen);

      // Janzen-Connell effect: two levels of density-dependent establishment failure
      const childSubtype = classifySubtype(winner.genome);
      const childArch = archetype(winner.genome);
      let conspecificCount = 0;
      let archConspecific = 0;
      for (let jy = y - 2; jy <= y + 2; jy++) {
        for (let jx = x - 2; jx <= x + 2; jx++) {
          if (jx === x && jy === y) continue;
          if (!inBounds(jx, jy, world.width, world.height)) continue;
          const jc = world.grid[jy][jx];
          for (const jid of cellPlantIds(jc)) {
            const jn = world.plants.get(jid);
            if (jn && jn.alive) {
              if (classifySubtype(jn.genome) === childSubtype) conspecificCount++;
              if (archetype(jn.genome) === childArch) archConspecific++;
            }
          }
        }
      }
      // Subtype JC: strong penalty near same-subtype adults
      if (conspecificCount > 0 && Math.random() > 1.0 / (1.0 + conspecificCount * SIM.JC_SUBTYPE_COEFF)) {
        cell.seeds.push(winner);
        world.seedPopulations.set(winner.speciesId,
          (world.seedPopulations.get(winner.speciesId) ?? 0) + 1);
        continue;
      }
      // Archetype JC: weaker penalty near same-archetype adults (prevents monoculture biomes)
      if (archConspecific > 2 && Math.random() > 1.0 / (1.0 + (archConspecific - 2) * SIM.JC_ARCHETYPE_COEFF)) {
        cell.seeds.push(winner);
        world.seedPopulations.set(winner.speciesId,
          (world.seedPopulations.get(winner.speciesId) ?? 0) + 1);
        continue;
      }

      // Speciation check: subtype-based
      let finalSpeciesId = winner.speciesId;
      const parentSubtype = world.species.get(winner.speciesId)?.subtype;
      if (childSubtype !== parentSubtype) {
        const existingSpeciesForSubtype = world.subtypeSpecies.get(childSubtype);
        if (existingSpeciesForSubtype !== undefined) {
          // Join existing species for this subtype
          finalSpeciesId = existingSpeciesForSubtype;
        } else {
          // Create new species for this subtype
          finalSpeciesId = world.nextSpeciesId++;
          const newName = generateSpeciesName(winner.genome, finalSpeciesId, childSubtype);
          world.species.set(finalSpeciesId, {
            id: finalSpeciesId,
            name: newName,
            color: generateSpeciesColor(finalSpeciesId),
            subtype: childSubtype,
          });
          world.subtypeSpecies.set(childSubtype, finalSpeciesId);
          world.speciationEvents.push({
            newSpeciesId: finalSpeciesId,
            parentSpeciesId: winner.speciesId,
            newSpeciesName: newName,
          });
        }
      }

      const childId = world.nextPlantId++;
      const child: Plant = {
        id: childId, speciesId: finalSpeciesId, lineageRoot: winner.lineageRoot,
        x, y,
        height: wpc.seedlingHeight * seedSizeVigor, rootDepth: wpc.seedlingRoot * seedSizeVigor, leafArea: wpc.seedlingLeaf * seedSizeVigor,
        energy: winner.energy, age: 0, alive: true,
        genome: winner.genome,
        lastLightReceived: 0, lastWaterAbsorbed: 0, lastWaterSatisfaction: 0,
        lastEnergyProduced: 0, lastMaintenanceCost: 0, isDiseased: false,
        storedWater: seedSizeVigor * winner.genome.waterStorage * SIM.WATER_STORAGE_SEEDLING_PROVISION,
        healthEMA: 1.0, peakEnergy: 2.0,
        generation: winner.generation, parentId: null, offspringCount: 0, effectiveLight: 0, lastTraitModifier: 0,
        subtype: childSubtype,
      };
      world.plants.set(childId, child);
      setCellPlant(cell, Tier.Ground, childId);
      cell.lastSpeciesId = finalSpeciesId;

      world.germinationEvents.push({
        x, y,
        plantId: childId,
        speciesId: finalSpeciesId,
        woodiness: winner.genome.woodiness,
      });
    }
  }
}
