import { World } from './types';
import { tickWorld, clearFrameEvents } from './simulation';
import { recordTick } from './history';
import type { Controls } from './controls';
import type { PerfTracker } from './perf';
import type { Renderer, History } from './types';

export interface FrameLoopDeps {
  world: World;
  controls: Controls;
  perfTracker: PerfTracker;
  perfPanel: { update(): void };
  renderer: Renderer;
  hookPhase: {
    active: boolean;
    update(world: World, history: History): void;
    handleEvent(ev: any): void;
  };
  experimentRunner: {
    active: boolean;
    update(world: World, history: History): void;
  };
  ffOverlay: { show(): void; hide(): void; update(world: World): void };
  speciesLabels: {
    setVisible(on: boolean): void;
    setLineageVisible(on: boolean): void;
    setHoveredSpecies(id: number | null, pos?: { x: number; y: number } | null): void;
    setHoveredLineageRoot(rootId: number | null): void;
    updatePositions(): void;
  };
  terrainLabels: { setVisible(on: boolean): void; updatePositions(): void };
  zoneLabels: { setVisible(on: boolean): void; updatePositions(): void };
  systemsOverlay: { show(): void; hide(): void };
  plantCard: { update(world: World, plantId: number | null): void; updatePosition(): void };
  cellCard: { updatePosition(): void };
  history: History;
  diagLogger: { recordTick(world: World): void };
  updateUI: () => void;
  speciesCardsToggle: HTMLInputElement;
  terrainToggle: HTMLInputElement;
  climateToggle: HTMLInputElement;
  systemsToggle: HTMLInputElement;
}

const WARP_BUDGET_MS = 15;
const TARGET_FRAME_MS = 15;
const SAFETY_MARGIN_MS = 3;

export function startFrameLoop(deps: FrameLoopDeps): {
  resetLastUITick: () => void;
  resetLastEventSeq: () => void;
  doTick: () => void;
} {
  const {
    world, controls, perfTracker, perfPanel, renderer,
    hookPhase, experimentRunner,
    ffOverlay, speciesLabels, terrainLabels, zoneLabels, systemsOverlay,
    plantCard, cellCard,
    history, diagLogger,
  } = deps;

  let lastTickTime = 0;
  let lastUITick = -1;
  let lastUISelectedCell: { x: number; y: number } | null = null;
  let frameCount = 0;
  let lastEventSeq = 0;
  let wasWarpActive = false;
  let lastRenderMs = 4;
  let lastTickMs = 2;

  function doTick(hooks?: PerfTracker): void {
    tickWorld(world, hooks);
    recordTick(history, world);
    diagLogger.recordTick(world);

    if (hookPhase.active && history.events.length > lastEventSeq) {
      for (let i = lastEventSeq; i < history.events.length; i++) {
        const ev = history.events[i];
        if (ev.type === 'population_record' || ev.type === 'dominance_shift'
          || ev.type === 'extinction' || ev.type === 'speciation'
          || ev.type === 'mass_extinction') {
          hookPhase.handleEvent(ev);
        }
      }
      lastEventSeq = history.events.length;
    }
  }

  function loop(now: number): void {
    perfTracker.markFrame(now);
    perfTracker.begin('frame');
    frameCount++;
    const warpActive = controls.renderSkip > 0 && !controls.paused;

    // Warp mode transitions
    if (warpActive && !wasWarpActive) {
      ffOverlay.show();
      speciesLabels.setVisible(false);
      speciesLabels.setLineageVisible(false);
      terrainLabels.setVisible(false);
      zoneLabels.setVisible(false);
      systemsOverlay.hide();
    } else if (!warpActive && wasWarpActive) {
      ffOverlay.hide();
      speciesLabels.setVisible(deps.speciesCardsToggle.checked);
      terrainLabels.setVisible(deps.terrainToggle.checked);
      zoneLabels.setVisible(deps.climateToggle.checked);
      if (deps.systemsToggle.checked) systemsOverlay.show();
      lastUITick = -1;
    }
    wasWarpActive = warpActive;

    const shouldRender = !warpActive;
    const perfHooks = perfTracker;

    if (!controls.paused) {
      clearFrameEvents(world);
      perfTracker.begin('simTotal');
      if (controls.renderSkip > 0) {
        const deadline = performance.now() + WARP_BUDGET_MS;
        while (performance.now() < deadline) {
          doTick(perfHooks);
        }
        lastTickTime = now;
        ffOverlay.update(world);
      } else if (controls.tickBudgetMs > 0) {
        const tickBudget = TARGET_FRAME_MS - lastRenderMs - SAFETY_MARGIN_MS;
        const deadline = performance.now() + Math.max(0, tickBudget);
        let tickStart = performance.now();
        doTick(perfHooks);
        lastTickMs = lastTickMs * 0.8 + (performance.now() - tickStart) * 0.2;
        while (performance.now() + lastTickMs < deadline) {
          tickStart = performance.now();
          doTick(perfHooks);
          lastTickMs = lastTickMs * 0.8 + (performance.now() - tickStart) * 0.2;
        }
        lastTickTime = now;
      } else if (now - lastTickTime >= controls.tickInterval) {
        doTick(perfHooks);
        lastTickTime = now;
      }
      perfTracker.end('simTotal');
    }

    if (hookPhase.active) {
      hookPhase.update(world, history);
    }

    if (experimentRunner.active) {
      experimentRunner.update(world, history);
    }

    if (shouldRender) {
      const renderStart = performance.now();
      let highlightSet: Set<number> | null = null;
      const hoveredPlant = controls.hoveredPlantId !== null ? world.plants.get(controls.hoveredPlantId) : null;
      if (controls.hoverPlantEnabled && hoveredPlant?.alive) {
        renderer.setHighlightedPlant(hoveredPlant.id);
        renderer.setHighlightedLineageRoot(null);
        renderer.setHighlightedSpecies(null);
      } else if (controls.hoverLineageEnabled && hoveredPlant?.alive) {
        renderer.setHighlightedPlant(null);
        renderer.setHighlightedLineageRoot(hoveredPlant.lineageRoot);
        renderer.setHighlightedSpecies(null);
      } else {
        renderer.setHighlightedPlant(null);
        renderer.setHighlightedLineageRoot(null);
        if (controls.hoverEnabled && controls.hoveredSpecies !== null) {
          highlightSet = new Set([controls.hoveredSpecies]);
        }
        renderer.setHighlightedSpecies(highlightSet);
      }
      perfTracker.begin('renderTotal');
      renderer.render(controls.selectedCell, perfHooks);
      if (!hookPhase.active) {
        const hoveredPlantPos = hoveredPlant?.alive ? { x: hoveredPlant.x, y: hoveredPlant.y } : null;
        speciesLabels.setHoveredSpecies(controls.hoverEnabled && !controls.hoverLineageEnabled ? controls.hoveredSpecies : null, hoveredPlantPos);
        speciesLabels.setHoveredLineageRoot(
          controls.hoverLineageEnabled && hoveredPlant?.alive
            ? hoveredPlant.lineageRoot
            : null,
        );
        speciesLabels.updatePositions();
        terrainLabels.updatePositions();
        zoneLabels.updatePositions();
        plantCard.update(world, controls.hoverPlantEnabled ? controls.hoveredPlantId : null);
        plantCard.updatePosition();
        cellCard.updatePosition();
      }
      perfTracker.end('renderTotal');
      lastRenderMs = lastRenderMs * 0.8 + (performance.now() - renderStart) * 0.2;
    }

    const selChanged = controls.selectedCell !== lastUISelectedCell;
    const isFastMode = controls.tickBudgetMs > 0;
    if (shouldRender && (world.tick !== lastUITick || selChanged)) {
      const skipUI = isFastMode && !selChanged && (world.tick % 8 !== 0);
      if (!skipUI) {
        lastUITick = world.tick;
        lastUISelectedCell = controls.selectedCell;
        if (!hookPhase.active) {
          deps.updateUI();
        }
      }
    }

    perfTracker.end('frame');
    perfPanel.update();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  return {
    resetLastUITick: () => { lastUITick = -1; },
    resetLastEventSeq: () => { lastEventSeq = 0; },
    doTick: () => doTick(),
  };
}
