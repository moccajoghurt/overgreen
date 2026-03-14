import type { Experiment, ExperimentStep } from './types/experiment';
import type { ColorMode } from './types/renderer';
import type { Genome, World } from './types/core';
import type { History } from './types/history';

export type ExperimentRunnerState = 'inactive' | 'running' | 'waitingContinue' | 'complete';

export interface ExperimentRunnerCallbacks {
  onStepActivated(index: number, step: ExperimentStep): void;
  onWaiting(nextStepIndex: number): void;
  onComplete(wrapUp?: Experiment['wrapUp']): void;
  onPauseRequested(): void;
  onResumeRequested(): void;
  onColorModeRequested(mode: ColorMode, trait?: keyof Genome): void;
  onSpeedRequested(speed: 'play' | 'fast'): void;
}

export function createExperimentRunner(callbacks: ExperimentRunnerCallbacks) {
  let experiment: Experiment | null = null;
  let currentStep = -1;
  let state: ExperimentRunnerState = 'inactive';

  function activateStep(index: number): void {
    currentStep = index;
    const step = experiment!.steps[index];

    callbacks.onStepActivated(index, step);

    if (step.colorMode) {
      callbacks.onColorModeRequested(step.colorMode, step.traitColorTrait);
    }

    // Auto-pause at this step, or keep running fast toward next trigger
    if (step.autoPause) {
      callbacks.onPauseRequested();
    }

    if (step.waitForContinue !== false) {
      state = 'waitingContinue';
    } else {
      state = 'running';
    }
  }

  function start(exp: Experiment): void {
    experiment = exp;
    currentStep = -1;
    state = 'running';

    // Activate step 0 immediately
    if (exp.steps.length > 0) {
      activateStep(0);
    } else {
      state = 'complete';
      callbacks.onComplete(exp.wrapUp);
    }
  }

  function update(world: World, history: History): void {
    if (state !== 'running' || !experiment) return;

    const nextIndex = currentStep + 1;
    if (nextIndex >= experiment.steps.length) {
      // All steps done
      state = 'complete';
      callbacks.onComplete(experiment.wrapUp);
      return;
    }

    const nextStep = experiment.steps[nextIndex];
    if (!nextStep.trigger || nextStep.trigger(world, history)) {
      activateStep(nextIndex);
    }
  }

  function continueStep(): void {
    if (state !== 'waitingContinue' || !experiment) return;
    state = 'running';

    const nextIndex = currentStep + 1;
    if (nextIndex >= experiment.steps.length) {
      state = 'complete';
      callbacks.onComplete(experiment.wrapUp);
      return;
    }

    // If next step has a trigger, fast-forward and show waiting state
    // If no trigger, it'll activate immediately in the next update()
    if (experiment.steps[nextIndex].trigger) {
      callbacks.onWaiting(nextIndex);
      callbacks.onSpeedRequested('fast');
    }
    callbacks.onResumeRequested();
  }

  function stop(): void {
    experiment = null;
    currentStep = -1;
    state = 'inactive';
  }

  return {
    start,
    update,
    continueStep,
    stop,
    get active(): boolean { return state !== 'inactive'; },
    get state(): ExperimentRunnerState { return state; },
    get currentStepIndex(): number { return currentStep; },
    get totalSteps(): number { return experiment?.steps.length ?? 0; },
    get currentExperiment(): Experiment | null { return experiment; },
  };
}
