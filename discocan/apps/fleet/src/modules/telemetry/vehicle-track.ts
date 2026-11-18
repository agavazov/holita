import type {
  FleetTrackGap,
  FleetTrackGapReason,
  FleetTrackSegment,
  FleetVehicleTrack,
} from '../../generated/graphql/types.js';
import type { SampleRow } from './telemetry.repository.js';

/** Position continuity inferred from samples, using ERM's 5-minute active/1-hour rest cadence. */
export function vehicleTrack(
  items: readonly SampleRow[],
  period: { from: Date; to: Date },
  truncated: boolean,
  asOf: Date | null,
): FleetVehicleTrack {
  const segments: FleetTrackSegment[] = [];
  const gaps: FleetTrackGap[] = [];
  let previousPosition: SampleRow | undefined;
  let currentSegment: FleetTrackSegment | undefined;
  let positionCount = 0;
  let missingPosition = false;
  let deviceImei: string | null = null;
  let ignition: boolean | null = null;
  let speedKph: number | null = null;
  let previousThresholdSeconds = 7200;

  for (const sample of items) {
    if (sample.deviceImei === null) {
      continue;
    }
    if (sample.deviceImei !== deviceImei) {
      ignition = null;
      speedKph = null;
      deviceImei = sample.deviceImei;
    }
    ignition = sample.ignition ?? ignition;
    speedKph = sample.speedKph ?? speedKph;
    if (sample.latitude === null || sample.longitude === null) {
      missingPosition = true;
      continue;
    }

    let reason: FleetTrackGapReason | undefined;
    if (previousPosition === undefined) {
      reason = truncated
        ? 'TRUNCATED'
        : missingPosition
          ? 'POSITION_UNAVAILABLE'
          : 'OUTSIDE_SAMPLES';
    } else if (missingPosition) {
      reason = 'POSITION_UNAVAILABLE';
    } else if (previousPosition.deviceImei !== sample.deviceImei) {
      reason = 'DEVICE_CHANGED';
    } else if (
      sample.recordedAt.getTime() - previousPosition.recordedAt.getTime() >
      previousThresholdSeconds * 1000
    ) {
      reason = 'SAMPLE_GAP';
    }

    if (reason !== undefined) {
      const from = previousPosition?.recordedAt ?? period.from;
      if (from.getTime() < sample.recordedAt.getTime()) {
        gaps.push({
          from,
          to: sample.recordedAt,
          reason,
          thresholdSeconds: reason === 'SAMPLE_GAP' ? previousThresholdSeconds : null,
        });
      }
      currentSegment = undefined;
    }
    if (currentSegment === undefined) {
      currentSegment = {
        from: sample.recordedAt,
        to: sample.recordedAt,
        sampleIds: [],
      };
      segments.push(currentSegment);
    }
    currentSegment.sampleIds.push(sample.id);
    currentSegment.to = sample.recordedAt;
    previousPosition = sample;
    previousThresholdSeconds = ignition === true || (speedKph ?? 0) > 0 ? 600 : 7200;
    missingPosition = false;
    positionCount++;
  }

  gaps.push({
    from: previousPosition?.recordedAt ?? period.from,
    to: period.to,
    reason:
      previousPosition === undefined
        ? truncated
          ? 'TRUNCATED'
          : 'POSITION_UNAVAILABLE'
        : missingPosition
          ? 'POSITION_UNAVAILABLE'
          : 'OUTSIDE_SAMPLES',
    thresholdSeconds: null,
  });
  return {
    asOf,
    positionCount,
    firstPositionAt: segments[0]?.from ?? null,
    lastPositionAt: previousPosition?.recordedAt ?? null,
    segments,
    gaps,
  };
}
