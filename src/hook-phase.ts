import type { World, SimEvent } from './types';
import type { History } from './types/history';
import { createHookCamera } from './hook-camera';
import type * as THREE from 'three';
import type { MapControls } from 'three/addons/controls/MapControls.js';

/**
 * Hook phase — the curated first-load experience.
 *
 * States: 'idle' | 'waiting' | 'growing' | 'revealing' | 'done'
 *
 * waiting:   tick 0-100, canvas only + title card sequence
 * growing:   tick 100-300+, show plant count, allow commentary
 * revealing: speciation trigger hit, speciation announcement + camera reveal + UI slide-in
 * done:      normal UI
 */

type HookState = 'idle' | 'waiting' | 'growing' | 'revealing' | 'done';

const STORAGE_KEY = 'overgreen-hook-seen';
const REVEAL_SPECIES_THRESHOLD = 3;
const REVEAL_TICK_MIN = 200;
const REVEAL_SEQUENCE_MS = 6000; // total reveal animation time

interface HookPhaseOpts {
  container: HTMLElement;
  camera: THREE.PerspectiveCamera;
  mapControls: MapControls;
  worldWidth: number;
  worldHeight: number;
  onRevealComplete: () => void;
}

export function createHookPhase(opts: HookPhaseOpts) {
  const { container, camera, mapControls, worldWidth, worldHeight, onRevealComplete } = opts;

  let state: HookState = 'idle';
  let revealStartTime = 0;
  let commentaryTimer = 0;
  let lastCommentaryText = '';

  // Event tracking state
  let speciationCount = 0;
  let shownPopMilestone = false;

  // Grid center → world coords (renderer uses x - HALF, z = y - HALF)
  const HALF = worldWidth / 2;
  const hookCam = createHookCamera({
    camera,
    mapControls,
    worldCenter: { x: 0, z: 0 }, // renderer centers world at 0,0
  });

  // DOM refs
  const overlay = document.getElementById('hook-overlay')!;
  const titleEl = document.getElementById('hook-title')!;
  const subtitleEl = document.getElementById('hook-subtitle')!;
  const statsEl = document.getElementById('hook-stats')!;
  const commentaryEl = document.getElementById('hook-commentary')!;
  const speciationEl = document.getElementById('hook-speciation')!;
  const skipBtn = document.getElementById('hook-skip')!;

  skipBtn.addEventListener('click', () => skip());

  function start(): void {
    // ?hook in URL forces the hook to replay
    if (new URLSearchParams(window.location.search).has('hook')) {
      localStorage.removeItem(STORAGE_KEY);
    }

    // Check localStorage — skip if already seen
    if (localStorage.getItem(STORAGE_KEY)) {
      skip();
      return;
    }

    state = 'waiting';
    speciationCount = 0;
    shownPopMilestone = false;
    document.body.classList.add('hook-active');
    overlay.classList.remove('hidden');
    titleEl.classList.remove('visible', 'corner');
    subtitleEl.classList.remove('visible', 'faded');
    statsEl.classList.remove('visible');
    commentaryEl.classList.remove('visible');
    speciationEl.classList.remove('visible');

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
    if (state === 'idle' || state === 'done') return;

    // Update camera
    hookCam.update(world.tick);

    if (state === 'waiting') {
      // Transition to growing once plants > 10
      if (world.plants.size > 10) {
        state = 'growing';
        statsEl.classList.add('visible');
      }
    }

    if (state === 'growing') {
      // Update stats overlay
      const speciesCount = world.speciesNames.size;
      statsEl.textContent = `${world.plants.size} plants · ${speciesCount} species`;

      // Check reveal trigger: 3+ species and tick > 200
      if (speciesCount >= REVEAL_SPECIES_THRESHOLD && world.tick > REVEAL_TICK_MIN) {
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
    if (state === 'done' || state === 'idle') return;

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
    if (state === 'done' || state === 'idle') return;
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

    // Hide commentary and stats
    commentaryEl.classList.remove('visible');
    statsEl.style.opacity = '0';

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
    // Reset inline styles
    titleEl.style.opacity = '';
    subtitleEl.style.opacity = '';
    statsEl.style.opacity = '';
    titleEl.classList.remove('visible', 'corner');
    subtitleEl.classList.remove('visible', 'faded');
    speciationEl.classList.remove('visible');
    commentaryEl.classList.remove('visible');

    localStorage.setItem(STORAGE_KEY, '1');
    onRevealComplete();
  }

  function skip(): void {
    state = 'done';
    document.body.classList.remove('hook-active');
    overlay.classList.add('hidden');
    hookCam.skip();
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
