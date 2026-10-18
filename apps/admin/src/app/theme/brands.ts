import type { BrandName } from './theme-choice';

/** Aura primitive palettes a brand may use; tokens reference them, never copies of their hex values. */
export type AccentPalette = 'blue' | 'orange' | 'teal';
export type NeutralPalette = 'slate' | 'zinc' | 'stone';
export type PaletteStep = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export interface BrandSteps {
  readonly color: PaletteStep;
  readonly hover: PaletteStep;
  readonly active: PaletteStep;
}

export interface Brand {
  readonly name: BrandName;
  /** Storybook toolbar title. */
  readonly title: string;
  readonly primary: AccentPalette;
  readonly neutral: NeutralPalette;
  readonly light: BrandSteps;
  readonly dark: BrandSteps;
  /** Primary step for selected-row and accent-tag text in light mode. */
  readonly emphasis: PaletteStep;
}

export const paletteSteps: readonly PaletteStep[] = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
];

export const brands: Readonly<Record<BrandName, Brand>> = {
  cobalt: {
    name: 'cobalt',
    title: 'Cobalt · blue/slate',
    primary: 'blue',
    neutral: 'slate',
    light: { color: 600, hover: 700, active: 800 },
    dark: { color: 400, hover: 300, active: 200 },
    emphasis: 700,
  },
  ember: {
    name: 'ember',
    title: 'Ember · orange/zinc',
    primary: 'orange',
    neutral: 'zinc',
    light: { color: 700, hover: 800, active: 900 },
    dark: { color: 400, hover: 300, active: 200 },
    emphasis: 800,
  },
  pine: {
    name: 'pine',
    title: 'Pine · teal/stone',
    primary: 'teal',
    neutral: 'stone',
    light: { color: 700, hover: 800, active: 900 },
    dark: { color: 400, hover: 300, active: 200 },
    emphasis: 800,
  },
};
