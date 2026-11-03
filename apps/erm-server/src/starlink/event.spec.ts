import { expect, it } from '@jest/globals';
import { decodeEvent, DEFAULT_EVENT_STRUCTURE } from './event.js';
import { parseFrame } from './protocol.js';

it('decodes event tokens with UTC times, nautical speed and coordinates while preserving raw fields', () => {
  const structure = DEFAULT_EVENT_STRUCTURE.split(',');
  const values = [
    '261103142530',
    '04',
    '261103142520',
    '+4238.9347',
    '-07109.9017',
    '002.3',
    '180',
    '12345.678',
    '10052',
    '8738',
    '1',
    '12.200',
    '03.600',
    '86',
    '75',
    '1.02',
    '25.1',
    '1',
    '120',
    '52',
    'external',
    'raw',
  ];
  for (const command of ['06', '86']) {
    const parsed = parseFrame(
      Buffer.from(`$SLU862129080366630,${command},66,${values.join(',')}`, 'latin1'),
    );
    if (!parsed) {
      throw new Error('Event envelope did not parse.');
    }
    const event = decodeEvent(parsed, structure);
    expect(event).toMatchObject({
      unitId: '862129080366630',
      eventId: '04',
      eventTime: new Date('2026-11-03T14:25:30Z'),
      positionTime: new Date('2026-11-03T14:25:20Z'),
      heading: 180,
      odometer: 12345.678,
      engineOn: true,
      mainVoltage: 12.2,
      backupVoltage: 3.6,
      fields: Object.fromEntries<string | string[] | undefined>([
        ...structure.map((token, index) => [token, values[index]] as const),
        ['extra', ['external', 'raw']],
      ]),
    });
    expect(event?.latitude).toBeCloseTo(42.6489116667, 7);
    expect(event?.longitude).toBeCloseTo(-71.1650283333, 7);
    expect(event?.speedKmh).toBeCloseTo(4.2596, 7);
  }
  const invalidFields = [
    ['#EDT#', '261132142530', 'eventTime'],
    ['#PDT#', '', 'positionTime'],
    ['#LAT#', '+4260.0000', 'latitude'],
    ['#LONG#', '-18109.9017', 'longitude'],
    ['#SPD#', 'not-a-speed', 'speedKmh'],
    ['#ODOD#', '123garbage', 'odometer'],
    ['#ENG#', '2', 'engineOn'],
  ] as const;
  for (const [token, raw, property] of invalidFields) {
    const parsed = parseFrame(Buffer.from(`$SLU123ABC,06,1,${raw}`, 'latin1'));
    if (!parsed) {
      throw new Error('Event envelope did not parse.');
    }
    expect(decodeEvent(parsed, [token])).toMatchObject({
      [property]: null,
      fields: { [token]: raw, extra: [] },
    });
  }
  const absent = parseFrame(Buffer.from('$SLU123ABC,86,2'));
  if (!absent) {
    throw new Error('Event envelope did not parse.');
  }
  expect(decodeEvent(absent)).toMatchObject({
    eventId: null,
    eventTime: null,
    positionTime: null,
    latitude: null,
    longitude: null,
    speedKmh: null,
    heading: null,
    odometer: null,
    engineOn: null,
    mainVoltage: null,
    backupVoltage: null,
    fields: { '#EDT#': null, extra: [] },
  });
});
