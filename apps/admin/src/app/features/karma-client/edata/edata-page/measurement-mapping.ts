import type {
  AdminKarmaEdataQuery,
  FleetEvidenceFragment,
} from '../../../../../generated/graphql/operations';
import type { Language } from '../../../../i18n/messages';
import { mapCoordinates } from '../../../../ui/map-preview/location-map';
import type {
  MeasurementChannel,
  MeasurementRecord,
} from '../../../../ui/measurement-workspace/measurement-workspace';
import bg from './measurements.bg.json';
import en from './measurements.en.json';

type Message = AdminKarmaEdataQuery['karmaEdata']['items'][number];
const catalogs: Record<Language, typeof en> = { bg, en };
export function measurementMessages(language: Language) {
  return catalogs[language];
}

export function edataInstant(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return null;
  }
  const utc = value.replace(' ', 'T') + 'Z';
  const instant = new Date(utc);
  return Number.isFinite(instant.getTime()) && instant.toISOString() === utc.replace('Z', '.000Z')
    ? instant.toISOString()
    : null;
}

export function edataChannels(
  rows: readonly Message[],
  language: Language,
): readonly MeasurementChannel[] {
  const text = catalogs[language];
  const known: Readonly<Record<string, string>> = text.channels;
  const ids = [
    ...new Set([
      ...Object.keys(known),
      ...rows.flatMap((row) => row.parameters.map((parameter) => parameter.id)),
    ]),
  ].sort((left, right) => Number(left) - Number(right));
  return [
    ...ids.map((id) => ({
      key: `parameter:${id}`,
      id,
      label: known[id] ?? text.parameter,
      unit: null,
      unitConfirmed: false,
      limitation:
        id === '781'
          ? text.voltageGate
          : ['64', '152', '687', '1657'].includes(id)
            ? text.counterGate
            : id === '662'
              ? text.rateGate
              : text.unitGate,
    })),
    {
      key: 'envelope:spd',
      id: 'spd',
      label: text.speed,
      unit: null,
      unitConfirmed: false,
      limitation: text.envelopeGate,
    },
    {
      key: 'envelope:odo',
      id: 'odo',
      label: text.odometer,
      unit: null,
      unitConfirmed: false,
      limitation: text.envelopeGate,
    },
  ];
}

export function edataRecords(
  rows: readonly Message[],
  retrievedAt: string,
): readonly MeasurementRecord[] {
  return rows.map((row) => {
    const instantUtc = edataInstant(row.eventTimeUtc);
    const provenance: FleetEvidenceFragment = {
      origin: 'OBSERVED',
      source: 'KARMA_API',
      scenarioId: null,
      sourceRecordId: row.id,
      eventAt: instantUtc,
      receivedAt: null,
      retrievedAt,
    };
    return {
      key: `KARMA_API:${row.id}`,
      source: 'KARMA_API',
      id: row.id,
      sourceTime: row.eventTimeUtc ?? null,
      instantUtc,
      coordinates: mapCoordinates(row.latitude, row.longitude),
      provenance,
      readings: [
        ...row.parameters.map((parameter) => ({
          channelKey: `parameter:${parameter.id}`,
          id: row.id,
          value: parameter.value ?? null,
          description: parameter.description ?? null,
          provenance,
        })),
        {
          channelKey: 'envelope:spd',
          id: row.id,
          value: row.spd ?? null,
          description: null,
          provenance,
        },
        {
          channelKey: 'envelope:odo',
          id: row.id,
          value: row.odo ?? null,
          description: null,
          provenance,
        },
      ],
    };
  });
}
