import { World, SEASON_NAMES } from './types';
import { ERA_NAMES } from './simulation/eras';

export interface FFOverlay {
  show(): void;
  hide(): void;
  update(world: World): void;
}

export function createFFOverlay(container: HTMLElement): FFOverlay {
  // Inject keyframe animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ff-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1.0; }
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute; top:0; left:0; width:100%; height:100%;
    background:rgba(0,0,0,0.75);
    display:none; flex-direction:column; align-items:center; justify-content:center;
    z-index:20; font-family:monospace; color:#8f8; pointer-events:none;
    user-select:none;
  `;
  container.appendChild(overlay);

  const headerEl = document.createElement('div');
  headerEl.style.cssText = 'font-size:20px; color:#5a5; margin-bottom:12px; letter-spacing:4px; animation:ff-pulse 1.5s ease-in-out infinite;';
  headerEl.textContent = '\u25B6\u25B6 FAST FORWARD \u25B6\u25B6';
  overlay.appendChild(headerEl);

  const tickEl = document.createElement('div');
  tickEl.style.cssText = 'font-size:48px; font-weight:bold; margin-bottom:4px;';
  overlay.appendChild(tickEl);

  const seasonEl = document.createElement('div');
  seasonEl.style.cssText = 'font-size:18px; color:#7d7; margin-bottom:2px;';
  overlay.appendChild(seasonEl);

  const eraEl = document.createElement('div');
  eraEl.style.cssText = 'font-size:14px; color:#d4a030; margin-bottom:14px;';
  overlay.appendChild(eraEl);

  const tpsEl = document.createElement('div');
  tpsEl.style.cssText = 'font-size:16px; color:#999;';
  overlay.appendChild(tpsEl);

  const plantsEl = document.createElement('div');
  plantsEl.style.cssText = 'font-size:14px; color:#777; margin-top:4px;';
  overlay.appendChild(plantsEl);

  // Throughput sampling state
  let sampleTick = 0;
  let sampleTime = 0;
  let displayTps = 0;

  function show(): void {
    overlay.style.display = 'flex';
    sampleTick = 0;
    sampleTime = 0;
    displayTps = 0;
    tpsEl.textContent = '';
  }

  function hide(): void {
    overlay.style.display = 'none';
  }

  function update(world: World): void {
    const now = performance.now();

    tickEl.textContent = `Tick ${world.tick.toLocaleString()}`;
    seasonEl.textContent = `${SEASON_NAMES[world.environment.season]}  \u2014  Year ${world.environment.yearCount + 1}`;
    eraEl.textContent = ERA_NAMES[world.environment.era.current];
    plantsEl.textContent = `${world.plants.size} plants`;

    if (sampleTime === 0) {
      sampleTick = world.tick;
      sampleTime = now;
    } else if (now - sampleTime >= 250) {
      const elapsed = (now - sampleTime) / 1000;
      displayTps = Math.round((world.tick - sampleTick) / elapsed);
      sampleTick = world.tick;
      sampleTime = now;
    }

    if (displayTps > 0) {
      tpsEl.textContent = `${displayTps.toLocaleString()} ticks/sec`;
    }
  }

  return { show, hide, update };
}
