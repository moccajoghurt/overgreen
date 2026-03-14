import type { Scenario } from './scenario';
import type { ColorMode } from './renderer';
import type { Genome, World } from './core';
import type { History } from './history';

export interface ExperimentStep {
  /** Unique id for this step */
  id: string;
  /** Title shown at top of step card */
  title: string;
  /** Body text (HTML allowed for emphasis) */
  body: string;
  /** When to activate this step. Omit = immediate after previous step's Continue. */
  trigger?: (world: World, history: History) => boolean;
  /** Auto-pause sim when this step activates */
  autoPause?: boolean;
  /** Switch heatmap color mode when step activates */
  colorMode?: ColorMode;
  /** Trait to show when colorMode is 'trait' */
  traitColorTrait?: keyof Genome;
  /** Set speed preset when step activates */
  speed?: 'play' | 'fast';
  /** Show Continue button. Default true. Set false for auto-advance steps. */
  waitForContinue?: boolean;
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  scenario: Scenario;
  steps: ExperimentStep[];
  wrapUp?: { title: string; body: string };
}
