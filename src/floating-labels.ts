import { Renderer } from './types';

interface FloatingLabel {
  el: HTMLElement;
  gridX: number;
  gridY: number;
  expireTime: number;
  fadeStarted: boolean;
}

interface FloatingLabelsOptions {
  /** CSS z-index for the overlay */
  zIndex: number;
  /** How long labels stay visible before fading (ms) */
  holdMs: number;
  /** Duration of the fade-out animation (ms) */
  fadeMs: number;
  /** Unique prefix for CSS keyframe names */
  animPrefix: string;
  /** Max simultaneous labels. When exceeded, oldest are removed. 0 = clear all on new show. */
  maxLabels: number;
}

export function createFloatingLabels(
  mapContainer: HTMLElement,
  renderer: Renderer,
  opts: FloatingLabelsOptions,
) {
  const activeLabels: FloatingLabel[] = [];

  // Overlay element
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:absolute; top:0; left:0; width:100%; height:100%;
    pointer-events:none; z-index:${opts.zIndex}; overflow:hidden;
  `;
  mapContainer.appendChild(overlay);

  // Inject keyframe styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ${opts.animPrefix}-in {
      from { opacity:0; transform:translate(-50%, -100%) translateY(6px); }
      to   { opacity:1; transform:translate(-50%, -100%) translateY(0); }
    }
    @keyframes ${opts.animPrefix}-out {
      from { opacity:1; }
      to   { opacity:0; }
    }
  `;
  document.head.appendChild(style);

  function evict(): void {
    if (opts.maxLabels === 0) {
      for (let i = activeLabels.length - 1; i >= 0; i--) {
        activeLabels[i].el.remove();
        activeLabels.splice(i, 1);
      }
    } else {
      while (activeLabels.length >= opts.maxLabels) {
        const old = activeLabels.shift()!;
        old.el.remove();
      }
    }
  }

  function track(el: HTMLElement, gridX: number, gridY: number, holdMs?: number): void {
    overlay.appendChild(el);
    activeLabels.push({
      el, gridX, gridY,
      expireTime: performance.now() + (holdMs ?? opts.holdMs),
      fadeStarted: false,
    });
  }

  function show(text: string, rgb: string, gridX: number, gridY: number): void {
    evict();

    const el = document.createElement('div');
    el.style.cssText = `
      position:absolute; transform:translate(-50%, -100%);
      background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
      border-left:3px solid ${rgb};
      padding:5px 10px; border-radius:0 4px 4px 0;
      color:${rgb}; font-family:monospace; font-size:13px; font-weight:bold;
      text-shadow:0 1px 3px rgba(0,0,0,0.7);
      white-space:nowrap;
      animation:${opts.animPrefix}-in 0.3s ease-out;
    `;
    el.textContent = text;
    track(el, gridX, gridY);
  }

  /** Add a pre-styled element as a positioned label with optional custom hold time */
  function showElement(el: HTMLElement, gridX: number, gridY: number, holdMs?: number): void {
    evict();
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%, -100%)';
    track(el, gridX, gridY, holdMs);
  }

  function updatePositions(): void {
    const now = performance.now();
    for (let i = activeLabels.length - 1; i >= 0; i--) {
      const label = activeLabels[i];
      if (now >= label.expireTime && !label.fadeStarted) {
        label.fadeStarted = true;
        label.el.style.animation = `${opts.animPrefix}-out ${opts.fadeMs}ms ease-in forwards`;
        setTimeout(() => {
          label.el.remove();
          const idx = activeLabels.indexOf(label);
          if (idx >= 0) activeLabels.splice(idx, 1);
        }, opts.fadeMs);
        continue;
      }
      const screen = renderer.projectToScreen(label.gridX, label.gridY);
      if (screen) {
        label.el.style.left = `${screen.x}px`;
        label.el.style.top = `${screen.y}px`;
        label.el.style.display = '';
      } else {
        label.el.style.display = 'none';
      }
    }
  }

  function destroy(): void {
    overlay.remove();
    style.remove();
  }

  return { show, showElement, updatePositions, destroy };
}
