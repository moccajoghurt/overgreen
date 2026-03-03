import { TRAITS } from './trait-defs';
import {
  createPlant, genomeDistance, randomGenome, generateSpeciesColor,
} from './simulation/plants';
import { generateSpeciesName } from './species-names';
import { speciesColorToRgb } from './ui-utils';
import { World, Genome, Archetype, TerrainType } from './types';
import { Controls } from './controls';

interface CustomSpecies {
  name: string;
  genome: Genome;
  archetype: Archetype;
  placedCount: number;
}

const PRESETS: Record<string, Partial<Record<keyof Genome, number>>> = {
  Towering:   { heightPriority: 0.9, rootPriority: 0.3, leafSize: 0.4, seedInvestment: 0.2, allelopathy: 0.1, defense: 0.1 },
  'Deep Roots': { rootPriority: 0.9, heightPriority: 0.3, leafSize: 0.4, seedInvestment: 0.3, allelopathy: 0.2, defense: 0.2 },
  Leafy:      { leafSize: 0.9, rootPriority: 0.3, heightPriority: 0.3, seedInvestment: 0.3, allelopathy: 0.1, defense: 0.1 },
  Spreader:   { seedInvestment: 0.9, rootPriority: 0.3, heightPriority: 0.3, leafSize: 0.4, allelopathy: 0.1, defense: 0.1 },
  Toxic:      { allelopathy: 0.9, rootPriority: 0.4, heightPriority: 0.3, leafSize: 0.5, seedInvestment: 0.3, defense: 0.2 },
  Fortress:   { defense: 0.9, rootPriority: 0.4, heightPriority: 0.5, leafSize: 0.4, seedInvestment: 0.2, allelopathy: 0.1 },
};

export function createSandboxPanel(
  container: HTMLElement,
  world: World,
  controls: Controls,
  canvas: HTMLCanvasElement,
): { update(world: World): void; setVisible(visible: boolean): void; isVisible(): boolean } {

  let visible = false;
  let archetype: Archetype = 'tree';
  let placeModeActive = false;
  let currentGenome: Genome = {
    rootPriority: 0.5, heightPriority: 0.5, leafSize: 0.5,
    seedInvestment: 0.5, allelopathy: 0.5, defense: 0.5,
  };
  const customSpecies = new Map<number, CustomSpecies>();
  let lastUpdateTick = -1;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #sandbox-panel {
      width: 260px; padding: 0; background: #1a1a1a;
      display: flex; flex-direction: column; overflow: hidden;
      border-left: 1px solid #333; font-family: monospace;
      transition: width 0.15s ease, padding 0.15s ease;
    }
    #sandbox-panel.hidden { width: 0; border-left: none; }
    .sb-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid #333; flex-shrink: 0;
    }
    .sb-header h2 { font-size: 14px; color: #8f8; margin: 0; }
    .sb-close { background: none; border: none; color: #888; cursor: pointer; font-size: 16px; padding: 0 4px; }
    .sb-close:hover { color: #fff; }
    .sb-body {
      flex: 1; overflow-y: auto; padding: 8px 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .sb-section-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .sb-archetype-row { display: flex; gap: 4px; }
    .sb-archetype-btn {
      flex: 1; padding: 4px 8px; cursor: pointer;
      background: #333; color: #ccc; border: 1px solid #555;
      font-family: monospace; font-size: 12px; text-align: center;
    }
    .sb-archetype-btn:hover { background: #444; }
    .sb-archetype-btn.active { background: #2a4a2a; border-color: #8f8; color: #8f8; }
    .sb-slider-group { display: flex; flex-direction: column; gap: 6px; }
    .sb-slider-row { display: flex; align-items: center; gap: 6px; }
    .sb-slider-label { font-size: 11px; width: 44px; flex-shrink: 0; }
    .sb-slider-row input[type="range"] { flex: 1; height: 14px; }
    .sb-slider-val { font-size: 10px; color: #888; width: 30px; text-align: right; flex-shrink: 0; }
    .sb-presets { display: flex; flex-wrap: wrap; gap: 3px; }
    .sb-preset-btn {
      padding: 2px 6px; cursor: pointer;
      background: #2a2a2a; color: #aaa; border: 1px solid #444;
      font-family: monospace; font-size: 10px;
    }
    .sb-preset-btn:hover { background: #383838; color: #fff; }
    .sb-preview { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
    .sb-preview-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; border: 1px solid #555; }
    .sb-preview-name { font-size: 12px; color: #ccc; }
    .sb-place-btn {
      width: 100%; padding: 6px; cursor: pointer;
      font-family: monospace; font-size: 12px;
      border: 1px solid #555; text-align: center;
    }
    .sb-place-btn.inactive { background: #333; color: #ccc; }
    .sb-place-btn.active { background: #2a4a2a; color: #8f8; border-color: #8f8; }
    .sb-place-hint { font-size: 10px; color: #666; text-align: center; }
    .sb-clear-btn {
      width: 100%; padding: 4px; cursor: pointer;
      background: #3a2020; color: #c88; border: 1px solid #644;
      font-family: monospace; font-size: 11px; text-align: center;
    }
    .sb-clear-btn:hover { background: #4a2828; }
    .sb-placed-list { display: flex; flex-direction: column; gap: 2px; }
    .sb-placed-row {
      display: flex; align-items: center; gap: 6px; padding: 2px 4px;
      cursor: pointer; border-radius: 2px;
    }
    .sb-placed-row:hover { background: rgba(255,255,255,0.05); }
    .sb-placed-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .sb-placed-name { font-size: 11px; color: #ccc; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sb-placed-count { font-size: 10px; color: #888; flex-shrink: 0; }
  `;
  document.head.appendChild(style);

  // Build DOM
  const header = document.createElement('div');
  header.className = 'sb-header';
  header.innerHTML = '<h2>Sandbox</h2>';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'sb-close';
  closeBtn.textContent = '\u00d7';
  header.appendChild(closeBtn);
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'sb-body';
  container.appendChild(body);

  // --- Archetype toggle ---
  const archetypeSection = document.createElement('div');
  archetypeSection.innerHTML = '<div class="sb-section-label">Archetype</div>';
  const archetypeRow = document.createElement('div');
  archetypeRow.className = 'sb-archetype-row';
  const btnTree = document.createElement('button');
  btnTree.className = 'sb-archetype-btn active';
  btnTree.textContent = 'Tree';
  const btnGrass = document.createElement('button');
  btnGrass.className = 'sb-archetype-btn';
  btnGrass.textContent = 'Grass';
  archetypeRow.appendChild(btnTree);
  archetypeRow.appendChild(btnGrass);
  archetypeSection.appendChild(archetypeRow);
  body.appendChild(archetypeSection);

  function setArchetype(a: Archetype): void {
    archetype = a;
    btnTree.classList.toggle('active', a === 'tree');
    btnGrass.classList.toggle('active', a === 'grass');
    updatePreview();
  }
  btnTree.addEventListener('click', () => setArchetype('tree'));
  btnGrass.addEventListener('click', () => setArchetype('grass'));

  // --- Genome sliders ---
  const sliderSection = document.createElement('div');
  sliderSection.innerHTML = '<div class="sb-section-label">Genome</div>';
  const sliderGroup = document.createElement('div');
  sliderGroup.className = 'sb-slider-group';
  sliderSection.appendChild(sliderGroup);
  body.appendChild(sliderSection);

  const sliderEls: { input: HTMLInputElement; valEl: HTMLElement; trait: typeof TRAITS[0] }[] = [];

  for (const trait of TRAITS) {
    const row = document.createElement('div');
    row.className = 'sb-slider-row';

    const label = document.createElement('span');
    label.className = 'sb-slider-label';
    label.style.color = trait.color;
    label.textContent = trait.label;
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0.01';
    input.max = '0.99';
    input.step = '0.01';
    input.value = '0.50';
    row.appendChild(input);

    const valEl = document.createElement('span');
    valEl.className = 'sb-slider-val';
    valEl.textContent = '0.50';
    row.appendChild(valEl);

    sliderGroup.appendChild(row);
    sliderEls.push({ input, valEl, trait });

    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      valEl.textContent = v.toFixed(2);
      currentGenome[trait.genomeKey] = v;
      updatePreview();
    });
  }

  function setSliders(genome: Genome): void {
    for (const s of sliderEls) {
      const v = genome[s.trait.genomeKey];
      s.input.value = String(v);
      s.valEl.textContent = v.toFixed(2);
    }
    currentGenome = { ...genome };
    updatePreview();
  }

  // --- Presets ---
  const presetSection = document.createElement('div');
  presetSection.innerHTML = '<div class="sb-section-label">Presets</div>';
  const presetRow = document.createElement('div');
  presetRow.className = 'sb-presets';
  presetSection.appendChild(presetRow);
  body.appendChild(presetSection);

  for (const [name, values] of Object.entries(PRESETS)) {
    const btn = document.createElement('button');
    btn.className = 'sb-preset-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => {
      const g: Genome = { rootPriority: 0.5, heightPriority: 0.5, leafSize: 0.5, seedInvestment: 0.5, allelopathy: 0.5, defense: 0.5 };
      for (const [k, v] of Object.entries(values)) {
        (g as any)[k] = v;
      }
      setSliders(g);
    });
    presetRow.appendChild(btn);
  }
  // Random preset
  const randomBtn = document.createElement('button');
  randomBtn.className = 'sb-preset-btn';
  randomBtn.textContent = 'Random';
  randomBtn.addEventListener('click', () => setSliders(randomGenome()));
  presetRow.appendChild(randomBtn);

  // --- Preview ---
  const previewSection = document.createElement('div');
  previewSection.innerHTML = '<div class="sb-section-label">Preview</div>';
  const previewRow = document.createElement('div');
  previewRow.className = 'sb-preview';
  const previewDot = document.createElement('div');
  previewDot.className = 'sb-preview-dot';
  const previewName = document.createElement('div');
  previewName.className = 'sb-preview-name';
  previewRow.appendChild(previewDot);
  previewRow.appendChild(previewName);
  previewSection.appendChild(previewRow);
  body.appendChild(previewSection);

  function updatePreview(): void {
    // Check if current genome matches an existing custom species
    let matchId: number | null = null;
    for (const [sid, sp] of customSpecies) {
      if (sp.archetype === archetype && genomeDistance(sp.genome, currentGenome) < 0.001) {
        matchId = sid;
        break;
      }
    }

    if (matchId !== null) {
      const sp = customSpecies.get(matchId)!;
      const color = world.speciesColors.get(matchId);
      previewDot.style.background = color ? speciesColorToRgb(color) : '#888';
      previewName.textContent = sp.name;
    } else {
      const color = generateSpeciesColor(world.nextSpeciesId);
      previewDot.style.background = speciesColorToRgb(color);
      previewName.textContent = generateSpeciesName(currentGenome, world.nextSpeciesId, archetype);
    }
  }

  // --- Place Mode ---
  const placeSection = document.createElement('div');
  const placeBtn = document.createElement('button');
  placeBtn.className = 'sb-place-btn inactive';
  placeBtn.textContent = 'Place Mode';
  placeSection.appendChild(placeBtn);
  const placeHint = document.createElement('div');
  placeHint.className = 'sb-place-hint';
  placeHint.textContent = 'Click map to place plants';
  placeHint.style.display = 'none';
  placeSection.appendChild(placeHint);
  body.appendChild(placeSection);

  function setPlaceMode(active: boolean): void {
    placeModeActive = active;
    if (active) {
      controls.mode = 'place';
      controls.onPlaceClick = handlePlacement;
      canvas.style.cursor = 'crosshair';
      placeBtn.className = 'sb-place-btn active';
      placeBtn.textContent = 'Place Mode ON';
      placeHint.style.display = '';
    } else {
      controls.mode = 'inspect';
      controls.onPlaceClick = null;
      canvas.style.cursor = '';
      placeBtn.className = 'sb-place-btn inactive';
      placeBtn.textContent = 'Place Mode';
      placeHint.style.display = 'none';
    }
  }

  placeBtn.addEventListener('click', () => setPlaceMode(!placeModeActive));

  // --- Clear All Custom ---
  const clearSection = document.createElement('div');
  const clearBtn = document.createElement('button');
  clearBtn.className = 'sb-clear-btn';
  clearBtn.textContent = 'Clear All Custom';
  clearSection.appendChild(clearBtn);
  body.appendChild(clearSection);

  clearBtn.addEventListener('click', () => {
    const speciesIds = new Set(customSpecies.keys());
    for (const plant of world.plants.values()) {
      if (speciesIds.has(plant.speciesId)) {
        const cell = world.grid[plant.y][plant.x];
        if (cell.plantId === plant.id) cell.plantId = null;
        world.plants.delete(plant.id);
      }
    }
    customSpecies.clear();
    rebuildPlacedList();
  });

  // --- Clear All Plants (entire map) ---
  const clearAllSection = document.createElement('div');
  const clearAllBtn = document.createElement('button');
  clearAllBtn.className = 'sb-clear-btn';
  clearAllBtn.style.background = '#3a1a1a';
  clearAllBtn.style.borderColor = '#844';
  clearAllBtn.textContent = 'Clear Entire Map';
  clearAllSection.appendChild(clearAllBtn);
  body.appendChild(clearAllSection);

  clearAllBtn.addEventListener('click', () => {
    for (const plant of world.plants.values()) {
      const cell = world.grid[plant.y][plant.x];
      if (cell.plantId === plant.id) cell.plantId = null;
    }
    world.plants.clear();
    customSpecies.clear();
    rebuildPlacedList();
  });

  // --- Placed species list ---
  const placedSection = document.createElement('div');
  placedSection.innerHTML = '<div class="sb-section-label">Placed Species</div>';
  const placedList = document.createElement('div');
  placedList.className = 'sb-placed-list';
  placedSection.appendChild(placedList);
  body.appendChild(placedSection);

  function rebuildPlacedList(): void {
    placedList.innerHTML = '';
    if (customSpecies.size === 0) return;

    for (const [sid, sp] of customSpecies) {
      // Count alive plants for this species
      let alive = 0;
      for (const plant of world.plants.values()) {
        if (plant.speciesId === sid && plant.alive) alive++;
      }

      const row = document.createElement('div');
      row.className = 'sb-placed-row';

      const dot = document.createElement('div');
      dot.className = 'sb-placed-dot';
      const color = world.speciesColors.get(sid);
      dot.style.background = color ? speciesColorToRgb(color) : '#888';
      row.appendChild(dot);

      const nameEl = document.createElement('div');
      nameEl.className = 'sb-placed-name';
      nameEl.textContent = sp.name;
      row.appendChild(nameEl);

      const countEl = document.createElement('div');
      countEl.className = 'sb-placed-count';
      countEl.textContent = `(${alive} alive)`;
      row.appendChild(countEl);

      row.addEventListener('click', () => {
        setArchetype(sp.archetype);
        setSliders(sp.genome);
      });

      placedList.appendChild(row);
    }
  }

  // --- Placement logic ---
  function handlePlacement(x: number, y: number): void {
    const cell = world.grid[y][x];
    if (cell.terrainType === TerrainType.River || cell.terrainType === TerrainType.Rock) return;
    if (cell.plantId !== null) return;

    const genome = { ...currentGenome };

    // Species matching — find existing custom species with same archetype and genome
    let speciesId: number | null = null;
    for (const [sid, sp] of customSpecies) {
      if (sp.archetype === archetype && genomeDistance(sp.genome, genome) < 0.001) {
        speciesId = sid;
        sp.placedCount++;
        break;
      }
    }

    // New species
    if (speciesId === null) {
      speciesId = world.nextSpeciesId++;
      const color = generateSpeciesColor(speciesId);
      const name = generateSpeciesName(genome, speciesId, archetype);
      world.speciesColors.set(speciesId, color);
      world.speciesNames.set(speciesId, name);
      customSpecies.set(speciesId, { name, genome, archetype, placedCount: 1 });
    }

    // Create plant
    const id = world.nextPlantId++;
    const plant = createPlant(id, x, y, genome, speciesId, archetype);
    world.plants.set(id, plant);
    cell.plantId = id;
    cell.lastSpeciesId = speciesId;

    rebuildPlacedList();
    updatePreview();
  }

  // --- Close button ---
  closeBtn.addEventListener('click', () => {
    setVisible(false);
  });

  // --- Public API ---
  function setVisible(v: boolean): void {
    visible = v;
    container.classList.toggle('hidden', !v);
    if (!v) {
      setPlaceMode(false);
    }
    // Update the sidebar button text
    const btn = document.getElementById('btn-sandbox');
    if (btn) btn.textContent = v ? 'Close Sandbox' : 'Sandbox';
  }

  function update(w: World): void {
    if (!visible) return;
    if (w.tick === lastUpdateTick) return;
    lastUpdateTick = w.tick;
    rebuildPlacedList();
  }

  // Initialize preview
  updatePreview();

  return {
    update,
    setVisible,
    isVisible: () => visible,
  };
}
