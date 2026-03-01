import { History, SpeciesColor, SimEventType } from './types';

const MAX_DOM_EVENTS = 50;

const TYPE_STYLES: Record<SimEventType, string> = {
  extinction: 'color:#f66',
  population_record: 'color:#8f8',
  notable_age: 'color:#8cf',
  dominance_shift: 'color:#fd8',
  mass_extinction: 'color:#f44; font-weight:bold',
};

export function createEventTicker(container: HTMLElement) {
  let lastCount = 0;

  function update(history: History, speciesColors: Map<number, SpeciesColor>): void {
    const events = history.events;
    if (events.length === lastCount) return;

    // Prepend new events (newest first)
    const newEvents = events.slice(lastCount);
    lastCount = events.length;

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
