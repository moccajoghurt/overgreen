import type { World, SimEvent } from './types';
import type { History } from './types/history';
import type { Controls } from './controls';
import { createHookCamera } from './hook-camera';
import type * as THREE from 'three';
import type { MapControls } from 'three/addons/controls/MapControls.js';

/**
 * Hook phase — the curated first-load experience.
 *
 * States: 'idle' | 'intro' | 'waiting' | 'growing' | 'revealing' | 'done'
 *
 * intro:     context card overlay — paused at tick 0, user chooses path
 * waiting:   cinematic mode: tick 0-100, canvas only + title card sequence
 * growing:   cinematic mode: tick 100-300+, show plant count, allow commentary
 * revealing: cinematic mode: speciation trigger hit, announcement + camera reveal + UI slide-in
 * done:      normal UI
 */

type HookState = 'idle' | 'intro' | 'waiting' | 'growing' | 'revealing' | 'done';

const STORAGE_KEY = 'overgreen-hook-seen';
const REVEAL_SPECIES_THRESHOLD = 3;
const REVEAL_ELAPSED_MIN_MS = 8000; // don't reveal until camera has pulled back enough
const REVEAL_SEQUENCE_MS = 6000; // total reveal animation time

interface HookPhaseOpts {
  container: HTMLElement;
  camera: THREE.PerspectiveCamera;
  mapControls: MapControls;
  controls: Controls;
  onRevealComplete: () => void;
  onStartExperiment: () => void;
}

export function createHookPhase(opts: HookPhaseOpts) {
  const { container, camera, mapControls, controls, onRevealComplete } = opts;

  let state: HookState = 'idle';
  let hookStartTime = 0;
  let revealStartTime = 0;
  let commentaryTimer = 0;
  let lastCommentaryText = '';

  // Event tracking state
  let speciationCount = 0;
  let shownPopMilestone = false;
  let cameraHandedOver = false;
  let delayUIReveal = false;

  const hookCam = createHookCamera({
    camera,
    mapControls,
    worldCenter: { x: 0, z: 0 }, // renderer centers world at 0,0
  });

  // DOM refs
  const overlay = document.getElementById('hook-overlay')!;
  const introCard = document.getElementById('hook-intro-card')!;
  const titleEl = document.getElementById('hook-title')!;
  const subtitleEl = document.getElementById('hook-subtitle')!;
  const statsEl = document.getElementById('hook-stats')!;
  const commentaryEl = document.getElementById('hook-commentary')!;
  const speciationEl = document.getElementById('hook-speciation')!;
  const skipBtn = document.getElementById('hook-skip')!;
  const speedEl = document.getElementById('hook-speed')!;
  const speedBtns = speedEl.querySelectorAll<HTMLButtonElement>('.hook-speed-btn');

  skipBtn.addEventListener('click', () => skip());

  // Intro card button handlers
  const btnExperiment = document.getElementById('hook-btn-experiment')!;
  const btnExplore = document.getElementById('hook-btn-explore')!;

  btnExperiment.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, '1');
    delayUIReveal = true;
    opts.onStartExperiment();
    // onStartExperiment → doStartExperiment → doLoadScenario → hookPhase.skip()
  });

  btnExplore.addEventListener('click', () => {
    skip();
  });

  // Speed pill click handlers
  const HOOK_SPEEDS: Record<string, { tickInterval: number; tickBudgetMs: number }> = {
    '2x':  { tickInterval: 200, tickBudgetMs: 0 },
    '5x':  { tickInterval: 67,  tickBudgetMs: 0 },
    '10x': { tickInterval: 0,   tickBudgetMs: 8 },
  };

  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = btn.dataset.speed!;
      const cfg = HOOK_SPEEDS[speed];
      if (cfg) {
        controls.tickInterval = cfg.tickInterval;
        controls.tickBudgetMs = cfg.tickBudgetMs;
        speedBtns.forEach(b => b.classList.toggle('active', b.dataset.speed === speed));
      }
    });
  });

  // Camera takeover: user drags on canvas → hand over camera control
  function onCameraInteraction(e: Event): void {
    if (state !== 'growing' && state !== 'waiting') return;
    if (cameraHandedOver) return;
    // Don't intercept clicks on hook UI elements
    if ((e.target as HTMLElement).closest('#hook-overlay')) return;
    cameraHandedOver = true;
    hookCam.handOver();
  }

  container.addEventListener('mousedown', onCameraInteraction);
  container.addEventListener('touchstart', onCameraInteraction);

  function start(): void {
    const params = new URLSearchParams(window.location.search);

    // ?hook or ?demo forces cinematic replay
    if (params.has('hook') || params.has('demo')) {
      localStorage.removeItem(STORAGE_KEY);
      startCinematic();
      return;
    }

    // Returning visitor — skip everything
    if (localStorage.getItem(STORAGE_KEY)) {
      skip();
      return;
    }

    // First-time visitor — show intro card, paused at tick 0
    state = 'intro';
    document.body.classList.add('hook-active');
    overlay.classList.remove('hidden');
    introCard.classList.remove('hidden');

    // Hide all cinematic elements
    titleEl.classList.remove('visible', 'corner');
    subtitleEl.classList.remove('visible', 'faded');
    statsEl.classList.remove('visible');
    commentaryEl.classList.remove('visible');
    speciationEl.classList.remove('visible');
    speedEl.classList.remove('visible');
    skipBtn.style.display = 'none';

    // Pause simulation — terrain visible, nothing ticking
    controls.paused = true;
  }

  /** Full cinematic experience (camera choreography + text overlay). Used for ?hook / ?demo. */
  function startCinematic(): void {
    state = 'waiting';
    hookStartTime = performance.now();
    speciationCount = 0;
    shownPopMilestone = false;
    cameraHandedOver = false;
    document.body.classList.add('hook-active');
    overlay.classList.remove('hidden');
    introCard.classList.add('hidden');
    titleEl.classList.remove('visible', 'corner');
    subtitleEl.classList.remove('visible', 'faded');
    statsEl.classList.remove('visible');
    commentaryEl.classList.remove('visible');
    speciationEl.classList.remove('visible');
    speedEl.classList.remove('visible');
    skipBtn.style.display = '';
    // Default hook speed: 5x for fast time-lapse to moneyshot
    controls.tickInterval = 67;
    controls.tickBudgetMs = 0;
    controls.paused = false;
    speedBtns.forEach(b => b.classList.toggle('active', b.dataset.speed === '5x'));

    // Start camera choreography
    hookCam.start();

    // Title card sequence:
    // 0.5s: "Overgreen" fades in centered
    setTimeout(() => {
      if (state === 'waiting' || state === 'growing') {
        titleEl.classList.add('visible');
      }
    }, 500);

    // 1.5s: "One seed. One world." fades in below, large
    setTimeout(() => {
      if (state === 'waiting' || state === 'growing') {
        subtitleEl.classList.add('visible');
      }
    }, 1500);

    // 4.5s: title card fades, wordmark shrinks to corner
    setTimeout(() => {
      if (state === 'waiting' || state === 'growing') {
        subtitleEl.classList.remove('visible');
        subtitleEl.classList.add('faded');
        titleEl.classList.remove('visible');
        titleEl.classList.add('corner', 'visible');
      }
    }, 4500);
  }

  function update(world: World, _history: History): void {
    if (state === 'idle' || state === 'done' || state === 'intro') return;

    // Update camera (time-based, independent of sim speed)
    hookCam.update();

    if (state === 'waiting') {
      // Transition to growing once plants > 10
      if (world.plants.size > 10) {
        state = 'growing';
        statsEl.classList.add('visible');
        speedEl.classList.add('visible');
      }
    }

    if (state === 'growing') {
      // Update stats overlay
      const speciesCount = world.species.size;
      statsEl.textContent = `${world.plants.size} plants · ${speciesCount} species`;

      // Check reveal trigger: 3+ species and enough real time elapsed for camera pullback
      const hookElapsed = performance.now() - hookStartTime;
      if (speciesCount >= REVEAL_SPECIES_THRESHOLD && hookElapsed > REVEAL_ELAPSED_MIN_MS) {
        beginReveal();
      }
    }

    if (state === 'revealing') {
      const elapsed = performance.now() - revealStartTime;
      if (elapsed >= REVEAL_SEQUENCE_MS) {
        finishReveal();
      }
    }

    // Tick down commentary timer
    if (commentaryTimer > 0) {
      commentaryTimer -= 16; // ~1 frame
      if (commentaryTimer <= 0) {
        commentaryEl.classList.remove('visible');
      }
    }
  }

  function handleEvent(event: SimEvent): void {
    if (state === 'done' || state === 'idle' || state === 'intro') return;

    switch (event.type) {
      case 'population_record':
        // Show "The colony takes root." once, then ignore subsequent
        if (!shownPopMilestone) {
          shownPopMilestone = true;
          showCommentary('The colony takes root.', 4000);
        }
        break;

      case 'speciation':
        speciationCount++;
        if (speciationCount === 1) {
          showCommentary('First mutation takes hold — a new lineage appears.', 5000);
        } else if (speciationCount === 2) {
          showCommentary('Two bloodlines now diverge.', 4000);
        }
        break;

      case 'dominance_shift':
      case 'extinction':
      case 'mass_extinction':
        showCommentary(event.message, 4000);
        break;
    }
  }

  function showCommentary(text: string, durationMs: number = 4000): void {
    if (state === 'done' || state === 'idle' || state === 'intro') return;
    if (text === lastCommentaryText) return;
    lastCommentaryText = text;
    commentaryEl.textContent = text;
    commentaryEl.classList.add('visible');
    commentaryTimer = durationMs;
  }

  function beginReveal(): void {
    if (state === 'revealing' || state === 'done') return;
    state = 'revealing';
    revealStartTime = performance.now();

    // Hide commentary, stats, and speed pill
    commentaryEl.classList.remove('visible');
    statsEl.style.opacity = '0';
    speedEl.classList.remove('visible');

    // Show large speciation announcement centered
    speciationEl.textContent = 'A new species has emerged.';
    speciationEl.classList.add('visible');

    // After 2.5s: fade speciation announcement, begin camera reveal + UI slide-in
    setTimeout(() => {
      speciationEl.classList.remove('visible');

      // Camera: begin dolly to default view
      hookCam.beginReveal();

      // Sidebar slides in
      setTimeout(() => {
        document.body.classList.remove('hook-active');
      }, 300);

      // Fade out hook overlay elements
      setTimeout(() => {
        titleEl.style.opacity = '0';
        subtitleEl.style.opacity = '0';
      }, 800);
    }, 2500);
  }

  function finishReveal(): void {
    state = 'done';
    overlay.classList.add('hidden');
    introCard.classList.add('hidden');
    // Reset inline styles
    titleEl.style.opacity = '';
    subtitleEl.style.opacity = '';
    statsEl.style.opacity = '';
    titleEl.classList.remove('visible', 'corner');
    subtitleEl.classList.remove('visible', 'faded');
    speciationEl.classList.remove('visible');
    commentaryEl.classList.remove('visible');
    speedEl.classList.remove('visible');
    skipBtn.style.display = '';

    localStorage.setItem(STORAGE_KEY, '1');
    onRevealComplete();
  }

  function skip(): void {
    state = 'done';
    cameraHandedOver = false;
    controls.paused = false;
    overlay.classList.add('hidden');
    introCard.classList.add('hidden');
    speedEl.classList.remove('visible');
    skipBtn.style.display = '';
    hookCam.skip();

    if (delayUIReveal) {
      // Experiment transition: delay sidebar/bottom-panel reveal so experiment card appears first
      delayUIReveal = false;
      setTimeout(() => {
        document.body.classList.remove('hook-active');
      }, 800);
    } else {
      document.body.classList.remove('hook-active');
    }

    onRevealComplete();
  }

  return {
    start,
    update,
    skip,
    showCommentary,
    handleEvent,
    get active() { return state !== 'idle' && state !== 'done'; },
    get state() { return state; },
  };
}
