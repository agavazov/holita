import type { StatusTone } from '../../theme/status-tones';
import { mapCoordinates, type MapCoordinates } from '../map-preview/location-map';

export interface LocationMapRecord {
  readonly id: string;
  readonly label: string;
  readonly plate?: string | null;
  readonly countryCode?: string;
  readonly status: { readonly label: string; readonly tone: StatusTone };
  readonly position: MapCoordinates | null;
  readonly positionAt: string | null;
  /** Measured bearing in degrees clockwise from north; absence never implies north. */
  readonly heading?: number | null;
  readonly href?: string | null;
}

export interface LocationTrackPoint {
  readonly position: MapCoordinates | null;
  readonly recordedAt: string;
  /** The source reports an unavailable interval before this sample. */
  readonly breakBefore?: boolean;
}

export interface LocationMapTrack {
  readonly recordId: string;
  readonly points: readonly LocationTrackPoint[];
  readonly from: string;
  readonly to: string;
  readonly truncated: boolean;
  /** Source-supplied coverage, including known unavailable intervals. */
  readonly coverage: string;
}

/** Only recorded positions join; explicit gaps start a new line. Never infer a road route. */
export function recordedTrackSegments(points: readonly LocationTrackPoint[]): MapCoordinates[][] {
  const segments: MapCoordinates[][] = [];
  let segment: MapCoordinates[] = [];
  for (const sample of points) {
    const position = mapCoordinates(sample.position?.latitude, sample.position?.longitude);
    if (sample.breakBefore || !position) {
      if (segment.length > 1) {
        segments.push(segment);
      }
      segment = [];
    }
    if (position) {
      segment.push(position);
    }
  }
  if (segment.length > 1) {
    segments.push(segment);
  }
  return segments;
}
