/** Presentation facts shared by real Karma report and measurement views. */
export type SourceAvailability = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
export interface SourceProvenance {
  readonly origin: 'OBSERVED' | 'DERIVED' | 'UNAVAILABLE';
  readonly source: 'KARMA_API';
  readonly sourceRecordId: string | null;
  readonly eventAt: string | null;
  readonly receivedAt: string | null;
  readonly retrievedAt: string;
}
export interface SourcePeriod {
  readonly from: string;
  readonly toExclusive: string;
  readonly timeZone: string;
}
export interface SourceCoverage {
  readonly retrieval: 'NOT_STARTED' | SourceAvailability;
  readonly positionCoverage: 'COMPLETE' | 'PARTIAL' | 'NOT_ASSESSED';
  readonly positionsLoaded: number;
  readonly gaps: readonly { readonly from: string; readonly toExclusive: string }[];
}
