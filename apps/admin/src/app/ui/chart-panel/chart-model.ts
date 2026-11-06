import type { CategorySlot, StatusTone } from '../../theme/status-tones';

export type ChartPanelKind = 'donut' | 'line' | 'bar';

/** Labels are supplied in the host's language and, for instants, its explicit time zone. */
export interface ChartPanelPoint {
  readonly id: string;
  readonly label: string;
  /** Donut segments use point colours; Cartesian charts use series colours. */
  readonly category?: CategorySlot;
  readonly tone?: StatusTone;
}

export interface ChartPanelSeries {
  readonly id: string;
  readonly label: string;
  /** Values match the points by index. Null is a gap; zero is a measured zero. */
  readonly values: readonly (number | null)[];
  readonly category?: CategorySlot;
  readonly tone?: StatusTone;
}

export interface ChartPanelSelection {
  readonly point: ChartPanelPoint;
  readonly series: ChartPanelSeries;
  readonly value: number;
  readonly pointIndex: number;
  readonly seriesIndex: number;
}
