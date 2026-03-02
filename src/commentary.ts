import { History, SpeciesColor, SimEvent, World, Renderer } from './types';
import { speciesCentroid, speciesColorToRgb } from './ui-utils';
import { createFloatingLabels } from './floating-labels';

const MAX_GENERAL = 2;
const MAX_POSITIONED = 4;
const COOLDOWN_MS = 1500;

function shouldShow(event: SimEvent): boolean {
  switch (event.type) {
    case 'mass_extinction': return true;
    case 'dominance_shift': return true;
    case 'extinction': return true;
    case 'fire_start': return true;
    case 'drought_start': return true;
    case 'disease_start': return true;
    case 'season_change': return true;
    case 'era_change': return true;
    case 'herbivore_spawn': return true;
    case 'herbivore_boom': return true;
    case 'herbivore_crash': return true;
    case 'population_record': {
      const m = event.message.match(/reached (\d+)/);
      return m ? parseInt(m[1]) >= 100 : false;
    }
    case 'notable_age': {
      const m = event.message.match(/age (\d+)/);
      return m ? parseInt(m[1]) >= 300 : false;
    }
    default: return false;
  }
}

/** Is this a general (non-positioned) event? */
function isGeneral(event: SimEvent): boolean {
  return event.type === 'season_change'
    || event.type === 'era_change'
    || event.type === 'mass_extinction'
    || event.type === 'drought_end'
    || event.type === 'fire_end'
    || event.type === 'disease_end'
    || event.type === 'herbivore_spawn'
    || event.type === 'herbivore_boom'
    || event.type === 'herbivore_crash';
}

/** Parse "(x, y)" coordinates from event message */
function parseMessageCoords(message: string): { x: number; y: number } | null {
  const m = message.match(/\((\d+),\s*(\d+)\)/);
  return m ? { x: parseInt(m[1]), y: parseInt(m[2]) } : null;
}

function accentColor(event: SimEvent, speciesColors: Map<number, SpeciesColor>): string {
  if (event.type === 'era_change') return '#d4a030';
  if (event.type === 'mass_extinction') return '#f44';
  if (event.type === 'fire_start' || event.type === 'fire_end') return '#f80';
  if (event.type === 'drought_start' || event.type === 'drought_end') return '#c90';
  if (event.type === 'disease_start' || event.type === 'disease_end') return '#8b0';
  if (event.type === 'herbivore_spawn' || event.type === 'herbivore_boom') return '#c86';
  if (event.type === 'herbivore_crash') return '#a54';
  if (event.type === 'season_change') return '#8cf';
  if (event.speciesId != null) {
    const sc = speciesColors.get(event.speciesId);
    if (sc) return speciesColorToRgb(sc);
  }
  return '#d4a030';
}

const ITEM_CSS = `
  background:rgba(0,0,0,0.55); backdrop-filter:blur(4px);
  border-left:3px solid __ACCENT__;
  padding:6px 12px; border-radius:0 4px 4px 0;
  color:#eee; font-family:monospace; font-size:13px;
  text-shadow:0 1px 3px rgba(0,0,0,0.6);
  white-space:nowrap;
  animation:commentary-in 0.4s ease-out;
`;

export function createCommentary(container: HTMLElement) {
  let lastEventSeq = 0;
  let lastShowTime = 0;
  let posLabels: ReturnType<typeof createFloatingLabels> | null = null;

  // General commentary: top-center
  const topOverlay = document.createElement('div');
  topOverlay.style.cssText = `
    position:absolute; top:8%; left:50%; transform:translateX(-50%);
    display:flex; flex-direction:column; align-items:center; gap:6px;
    pointer-events:none; z-index:10; max-width:70%;
  `;
  container.appendChild(topOverlay);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes commentary-in {
      from { opacity:0; transform:translateY(8px); }
      to   { opacity:1; transform:translateY(0); }
    }
  `;
  document.head.appendChild(style);

  function makeItem(event: SimEvent, speciesColors: Map<number, SpeciesColor>): HTMLElement {
    const item = document.createElement('div');
    const accent = accentColor(event, speciesColors);
    item.style.cssText = ITEM_CSS.replace('__ACCENT__', accent);
    item.textContent = event.message;
    return item;
  }

  function showGeneral(event: SimEvent, speciesColors: Map<number, SpeciesColor>): void {
    const item = makeItem(event, speciesColors);
    topOverlay.appendChild(item);
    while (topOverlay.children.length > MAX_GENERAL) {
      topOverlay.firstChild!.remove();
    }
    scheduleRemoval(item, event);
  }

  function showPositioned(
    event: SimEvent,
    speciesColors: Map<number, SpeciesColor>,
    gridX: number,
    gridY: number,
  ): void {
    if (!posLabels) return;
    const item = makeItem(event, speciesColors);
    const holdMs = (event.type === 'fire_start' || event.type === 'disease_start') ? 5000 : 3500;
    posLabels.showElement(item, gridX, gridY, holdMs);
  }

  function scheduleRemoval(item: HTMLElement, event: SimEvent): void {
    const holdMs = (event.type === 'mass_extinction' || event.type === 'fire_start' || event.type === 'disease_start') ? 5000 : 3500;
    const fadeMs = 600;
    setTimeout(() => {
      item.style.animation = `commentary-out ${fadeMs}ms ease-in forwards`;
      setTimeout(() => item.remove(), fadeMs);
    }, holdMs);
  }


  /** Find a specific plant by ID (parsed from message) */
  function findPlantPosition(world: World, event: SimEvent): { x: number; y: number } | null {
    const m = event.message.match(/Plant #(\d+)/);
    if (!m) return null;
    const plantId = parseInt(m[1]);
    const plant = world.plants.get(plantId);
    if (plant) return { x: plant.x, y: plant.y };
    return null;
  }

  function update(
    history: History,
    speciesColors: Map<number, SpeciesColor>,
    world: World,
    renderer: Renderer,
  ): void {
    // Lazily create positioned labels (needs renderer)
    if (!posLabels) {
      posLabels = createFloatingLabels(container, renderer, {
        zIndex: 10, holdMs: 3500, fadeMs: 600, animPrefix: 'commentary', maxLabels: MAX_POSITIONED,
      });
    }

    const events = history.events;

    // Process new events
    if (history.eventSeq !== lastEventSeq) {
      const count = Math.min(history.eventSeq - lastEventSeq, events.length);
      const newEvents = events.slice(-count);
      lastEventSeq = history.eventSeq;
      const now = performance.now();

      for (const evt of newEvents) {
        if (!shouldShow(evt)) continue;
        if (now - lastShowTime < COOLDOWN_MS) continue;

        if (isGeneral(evt)) {
          showGeneral(evt, speciesColors);
        } else {
          // Try to find a position for this event
          let pos: { x: number; y: number } | null = null;

          // Plant-specific events: position at the plant
          if (evt.type === 'notable_age') {
            pos = findPlantPosition(world, evt);
          }

          // Location-based events (fire, drought): parse coords from message
          if (!pos && (evt.type === 'fire_start' || evt.type === 'drought_start' || evt.type === 'disease_start')) {
            pos = parseMessageCoords(evt.message);
          }

          // Species-level events: position at species centroid
          if (!pos && evt.speciesId != null) {
            pos = speciesCentroid(world, evt.speciesId);
          }

          if (pos) {
            showPositioned(evt, speciesColors, pos.x, pos.y);
          } else {
            // Fallback to general (e.g. extinct species with no plants left)
            showGeneral(evt, speciesColors);
          }
        }

        lastShowTime = now;
      }
    }

    posLabels.updatePositions();
  }

  function destroy(): void {
    topOverlay.remove();
    posLabels?.destroy();
    style.remove();
  }

  return { update, destroy };
}
