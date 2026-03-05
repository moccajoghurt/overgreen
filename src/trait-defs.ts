import { Genome, TraitAverages } from './types';

export interface TraitDef {
  genomeKey: keyof Genome;
  shortKey: keyof TraitAverages;
  label: string;
  color: string;
}

export const TRAITS: TraitDef[] = [
  { genomeKey: 'rootPriority',   shortKey: 'root',   label: 'Root',   color: '#c96' },
  { genomeKey: 'heightPriority', shortKey: 'height', label: 'Height', color: '#69c' },
  { genomeKey: 'leafSize',       shortKey: 'leaf',   label: 'Leaf',   color: '#6c6' },
  { genomeKey: 'seedInvestment', shortKey: 'seed',   label: 'Seed',   color: '#c6c' },
  { genomeKey: 'defense',        shortKey: 'def',    label: 'Def',    color: '#c66' },
  { genomeKey: 'woodiness',      shortKey: 'wood',   label: 'Wood',   color: '#a86' },
];
