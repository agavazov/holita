import type {
  KarmaPositionSamples,
  KarmaPositionSamplesInput,
} from '../../generated/graphql/types.js';
import { positionEventRows } from './history-response.js';
import { positionSamplesLimits } from './position-samples-query.js';

export function initialPositionSamples(input: KarmaPositionSamplesInput): KarmaPositionSamples {
  return {
    ...input,
    samples: [],
    retrieval: 'NOT_STARTED',
    reason: 'NONE',
    sourceClock: 'EDT_UTC',
    ordering: 'SOURCE_ORDER',
    positionCoverage: 'NOT_ASSESSED',
    startMessagePresent: false,
    stopMessagePresent: false,
    loadedRows: 0,
    duplicateIdsRemoved: 0,
    retrievedAt: new Date().toISOString(),
    ...positionSamplesLimits,
  };
}

function instantUtc(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return null;
  }
  const normalized = value.replace(' ', 'T') + 'Z';
  const instant = new Date(normalized);
  return Number.isFinite(instant.getTime()) &&
    instant.toISOString() === normalized.replace('Z', '.000Z')
    ? instant.toISOString()
    : null;
}

export function positionSamplesResult(
  result: KarmaPositionSamples,
  value: unknown,
): KarmaPositionSamples {
  const rows = positionEventRows(value);
  const seen = new Set<string>();
  for (const event of rows) {
    if (
      event.carId !== result.carId ||
      Number(event.id) < Number(result.startMessageId) ||
      Number(event.id) > Number(result.stopMessageId)
    ) {
      continue;
    }
    if (seen.has(event.id)) {
      result.duplicateIdsRemoved++;
      continue;
    }
    seen.add(event.id);
    if (result.samples.length < result.maxRows) {
      result.samples.push({ event, instantUtc: instantUtc(event.edt) });
    }
  }
  if (result.samples.every((sample) => sample.instantUtc !== null)) {
    result.ordering = 'UTC_THEN_MESSAGE_ID';
    result.samples.sort(
      (left, right) =>
        (left.instantUtc ?? '').localeCompare(right.instantUtc ?? '') ||
        Number(left.event.id) - Number(right.event.id),
    );
  }
  result.loadedRows = result.samples.length;
  result.startMessagePresent = result.samples.some(
    (sample) => sample.event.id === result.startMessageId,
  );
  result.stopMessagePresent = result.samples.some(
    (sample) => sample.event.id === result.stopMessageId,
  );
  result.reason =
    rows.length >= result.maxRows
      ? 'ROW_LIMIT'
      : result.startMessagePresent && result.stopMessagePresent
        ? 'NONE'
        : 'BOUNDARIES_MISSING';
  result.retrieval = result.reason === 'NONE' ? 'COMPLETE' : 'PARTIAL';
  return result;
}
