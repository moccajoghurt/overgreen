import type { ExperimentStep } from './types/experiment';

export function createExperimentOverlay(container: HTMLElement) {
  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes experiment-dot-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1.0; }
    }
    @keyframes experiment-slide-in {
      from { transform: translateY(16px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .experiment-card {
      position: absolute;
      bottom: 8px;
      left: 8px;
      width: 320px;
      z-index: 25;
      background: rgba(0,0,0,0.88);
      backdrop-filter: blur(4px);
      border: 1px solid #3a3a3a;
      border-radius: 6px;
      padding: 14px 16px;
      font-family: monospace;
      color: #ccc;
      animation: experiment-slide-in 0.25s ease-out;
      pointer-events: auto;
    }
    .experiment-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .experiment-step-indicator {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .experiment-close {
      background: none;
      border: none;
      color: #666;
      font-size: 16px;
      cursor: pointer;
      padding: 0 2px;
      line-height: 1;
      font-family: monospace;
    }
    .experiment-close:hover { color: #aaa; }
    .experiment-title {
      font-size: 14px;
      font-weight: bold;
      color: #8f8;
      margin: 0 0 8px 0;
    }
    .experiment-body {
      font-size: 12px;
      line-height: 1.5;
      color: #bbb;
      margin-bottom: 12px;
    }
    .experiment-body em { color: #8f8; font-style: normal; }
    .experiment-body strong { color: #fff; }
    .experiment-progress {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
    }
    .experiment-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      border: 1px solid #555;
      background: transparent;
      transition: background 0.2s, border-color 0.2s;
    }
    .experiment-dot.done { background: #5a5; border-color: #5a5; }
    .experiment-dot.current { background: #8f8; border-color: #8f8; }
    .experiment-continue {
      display: block;
      width: 100%;
      padding: 7px 0;
      background: transparent;
      border: 1px solid #4a7a4a;
      border-radius: 4px;
      color: #8f8;
      font-family: monospace;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .experiment-continue:hover { background: rgba(80,180,80,0.15); }
  `;
  document.head.appendChild(style);

  // Create card
  const card = document.createElement('div');
  card.className = 'experiment-card';
  card.style.display = 'none';
  container.appendChild(card);

  const header = document.createElement('div');
  header.className = 'experiment-header';
  card.appendChild(header);

  const stepIndicator = document.createElement('span');
  stepIndicator.className = 'experiment-step-indicator';
  header.appendChild(stepIndicator);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'experiment-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.title = 'Close experiment';
  header.appendChild(closeBtn);

  const title = document.createElement('h3');
  title.className = 'experiment-title';
  card.appendChild(title);

  const body = document.createElement('div');
  body.className = 'experiment-body';
  card.appendChild(body);

  const progress = document.createElement('div');
  progress.className = 'experiment-progress';
  card.appendChild(progress);

  const continueBtn = document.createElement('button');
  continueBtn.className = 'experiment-continue';
  continueBtn.textContent = 'Continue';
  card.appendChild(continueBtn);

  // Callbacks
  let onContinue: (() => void) | null = null;
  let onClose: (() => void) | null = null;

  continueBtn.addEventListener('click', () => onContinue?.());
  closeBtn.addEventListener('click', () => onClose?.());

  function buildDots(total: number, currentIndex: number): void {
    progress.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('div');
      dot.className = 'experiment-dot';
      if (i < currentIndex) dot.classList.add('done');
      if (i === currentIndex) dot.classList.add('current');
      progress.appendChild(dot);
    }
  }

  function showStep(index: number, total: number, step: ExperimentStep): void {
    card.style.display = '';
    // Re-trigger animation
    card.style.animation = 'none';
    card.offsetHeight; // force reflow
    card.style.animation = '';

    stepIndicator.textContent = `Step ${index + 1} of ${total}`;
    title.textContent = step.title;
    body.innerHTML = step.body;
    buildDots(total, index);
    continueBtn.style.display = step.waitForContinue === false ? 'none' : '';
  }

  function showWaiting(stepIndex: number, total: number): void {
    continueBtn.style.display = 'none';
    stepIndicator.textContent = `Step ${stepIndex + 1} of ${total}`;
    body.innerHTML = '<span style="color:#666; animation:experiment-dot-pulse 1.5s ease-in-out infinite; display:inline-block;">Simulating...</span>';
    buildDots(total, stepIndex);
  }

  function showWrapUp(wrapUp: { title: string; body: string }): void {
    card.style.display = '';
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = '';

    stepIndicator.textContent = 'Complete';
    title.textContent = wrapUp.title;
    body.innerHTML = wrapUp.body;
    progress.innerHTML = '';
    continueBtn.style.display = 'none';
  }

  function hide(): void {
    card.style.display = 'none';
  }

  return {
    showStep,
    showWaiting,
    showWrapUp,
    hide,
    set onContinue(fn: (() => void) | null) { onContinue = fn; },
    set onClose(fn: (() => void) | null) { onClose = fn; },
  };
}
