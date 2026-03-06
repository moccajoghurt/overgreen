import type { World } from './types';
import type { HistoryState } from './history';
import { createHookCamera } from './hook-camera';
import type * as THREE from 'three';
import type { MapControls } from 'three/addons/controls/MapControls.js';

/**
 * Hook phase — the curated first-load experience.
 *
 * States: 'idle' | 'waiting' | 'growing' | 'revealing' | 'done'
 *
 * waiting:   tick 0-100, canvas only + wordmark + subtitle
 * growing:   tick 100-300+, show plant count, allow commentary
 * revealing: speciation trigger hit, sidebar/panel animate in
 * done:      normal UI
 */

type HookState = 'idle' | 'waiting' | 'growing' | 'revealing' | 'done';

const STORAGE_KEY = 'overgreen-hook-seen';
const REVEAL_SPECIES_THRESHOLD = 3;
const REVEAL_TICK_MIN = 200;
const REVEAL_SEQUENCE_MS = 3500; // total reveal animation time

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
    document.body.classList.add('hook-active');
    overlay.classList.remove('hidden');
    subtitleEl.classList.remove('visible');
    statsEl.classList.remove('visible');
    commentaryEl.classList.remove('visible');

    // Start camera choreography
    hookCam.start();

    // Fade in subtitle after 2 seconds
    setTimeout(() => {
      if (state === 'waiting' || state === 'growing') {
        subtitleEl.classList.add('visible');
      }
    }, 2000);
  }

  function update(world: World, _history: HistoryState): void {
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

    // Show "Evolution begins" commentary
    showCommentary('A new species has diverged. Evolution begins.', 3000);

    // Camera: begin dolly to default view
    hookCam.beginReveal();

    // Sequence: sidebar slides in after 800ms, bottom panel after 1300ms
    setTimeout(() => {
      document.body.classList.remove('hook-active');
    }, 800);

    // Fade out hook overlay elements
    setTimeout(() => {
      titleEl.style.opacity = '0';
      subtitleEl.style.opacity = '0';
      statsEl.style.opacity = '0';
    }, 1500);
  }

  function finishReveal(): void {
    state = 'done';
    overlay.classList.add('hidden');
    // Reset inline styles
    titleEl.style.opacity = '';
    subtitleEl.style.opacity = '';
    statsEl.style.opacity = '';
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
    get active() { return state !== 'idle' && state !== 'done'; },
    get state() { return state; },
  };
}
