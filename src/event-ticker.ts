import { History, SpeciesColor, SimEventType } from './types';

const MAX_DOM_EVENTS = 50;

const TYPE_STYLES: Record<SimEventType, string> = {
  extinction: 'color:#f66',
  population_record: 'color:#8f8',
  notable_age: 'color:#8cf',
  dominance_shift: 'color:#fd8',
  mass_extinction: 'color:#f44; font-weight:bold',
  season_change: 'color:#adf',
  era_change: 'color:#d4a030; font-weight:bold',
  drought_start: 'color:#fa4',
  drought_end: 'color:#fa4',
  fire_start: 'color:#f44; font-weight:bold',
  fire_end: 'color:#f84',
  disease_start: 'color:#8b0; font-weight:bold',
  disease_end: 'color:#8b0',
};

export function createEventTicker(container: HTMLElement) {
  let lastSeq = 0;

  function update(history: History, speciesColors: Map<number, SpeciesColor>): void {
    const events = history.events;
    if (history.eventSeq === lastSeq) return;

    // Prepend new events (newest first)
    const count = Math.min(history.eventSeq - lastSeq, events.length);
    const newEvents = events.slice(-count);
    lastSeq = history.eventSeq;

    for (let i = newEvents.length - 1; i >= 0; i--) {
      const evt = newEvents[i];
      const div = document.createElement('div');
      div.className = 'event event-new';

      const style = TYPE_STYLES[evt.type] || '';

      let dotHtml = '';
      if (evt.speciesId != null) {
        const sc = speciesColors.get(evt.speciesId);
        const rgb = sc
          ? `rgb(${Math.round(sc.r * 255)},${Math.round(sc.g * 255)},${Math.round(sc.b * 255)})`
          : '#888';
        dotHtml = `<span class="event-dot" style="background:${rgb}"></span>`;
      }

      div.innerHTML = `${dotHtml}<span style="${style}"><span style="color:#666">[${evt.tick}]</span> ${escapeHtml(evt.message)}</span>`;
      container.insertBefore(div, container.firstChild);
    }

    // Prune old entries
    while (container.children.length > MAX_DOM_EVENTS) {
      container.removeChild(container.lastChild!);
    }
  }

  function destroy(): void {
    container.innerHTML = '';
  }

  return { update, destroy };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
