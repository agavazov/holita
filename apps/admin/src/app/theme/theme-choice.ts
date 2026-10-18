export type BrandName = 'cobalt' | 'ember' | 'pine';
export type DensityName = 'compact' | 'comfortable';

export interface ThemeChoice {
  readonly brand: BrandName;
  readonly density: DensityName;
}

export const brandNames: readonly BrandName[] = ['cobalt', 'ember', 'pine'];
export const densityNames: readonly DensityName[] = ['compact', 'comfortable'];

/** The application's single configured design choice. Change it here only. */
export const appTheme: ThemeChoice = { brand: 'cobalt', density: 'compact' };
