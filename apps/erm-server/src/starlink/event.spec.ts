import { expect, it } from '@jest/globals';
import { decodeBinaryEvent, decodeEvent, DEFAULT_EVENT_STRUCTURE } from './event.js';
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
    expect(event?.fields['edata']).toBeUndefined();
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

  // Tracker $SLB reports: tag 26 is BATH and tag 41 is STRT x100; CB9369PE sends 41 without 26.
  const escapes = new Map([
    [0x10, 0x10],
    [0x0d, 0x01],
    [0x0a, 0x02],
    [0x00, 0x03],
    [0x11, 0x04],
    [0x13, 0x05],
  ]);
  const slb = (imei: string, tags: readonly number[]) =>
    Buffer.concat([
      Buffer.from('$SLB'),
      Buffer.from(
        [0x04, ...Buffer.from(imei.slice(0, 14), 'hex'), 0x0f, 0x01, 0x06, ...tags].flatMap(
          (byte) => {
            const code = escapes.get(byte);
            return code === undefined ? [byte] : [0x10, code];
          },
        ),
      ),
    ]);
  const reports = [
    [
      '862129080319233',
      [0x08, 0x01, 0x20, 0x5f, 0xdc, 0x26, 0x39, 0x41, 0x00, 0x86],
      { mainVoltage: 24.54, fields: { '#BATH#': '57', '#STRT#': '1.34' } },
    ],
    [
      '862129080366630',
      [0x08, 0x01, 0x26, 0x64, 0x41, 0x00, 0x04],
      { fields: { '#BATH#': '100', '#STRT#': '0.04' } },
    ],
    [
      '862129080320033',
      [0x08, 0x01, 0x21, 0x0f, 0xbf, 0x41, 0x01, 0x17, 0x18, 0x1c, 0x18],
      {
        backupVoltage: 4.031,
        fields: { '#BATH#': null, '#STRT#': '2.79', '#SATN#': '28', '#SATU#': '24' },
      },
    ],
  ] as const;
  for (const [unitId, tags, expected] of reports) {
    expect(decodeBinaryEvent(slb(unitId, tags))).toMatchObject({
      unitId,
      eventId: '01',
      ...expected,
    });
  }

  // Vendor examples, except 411/419 (real captures) and 418 (synthetic documented layout).
  const edataReports = [
    {
      type: 401,
      payload: '07000180BD000100080001000100000100010000F0003C',
      decoded: {
        parameters: [
          {
            parameter: 1,
            headerId: 0x80bd0001,
            startBit: 0,
            bitCount: 8,
            multiplier: 1,
            divisor: 1,
            offsetHex: '0000',
            filterMask: 0x0100,
            filterValue: 0x0100,
            type: 0,
            flags: 0xf0,
            intervalSeconds: 60,
          },
        ],
      },
    },
    {
      type: 402,
      payload: '0800011AAA1BBB00640707021400010E00',
      decoded: {
        rules: [
          {
            rule: 1,
            trueEventId: 0x1aaa,
            falseEventId: 0x1bbb,
            debounceMilliseconds: 100,
            activateDashboard: false,
            dataLength: 7,
            data: '07021400010E00',
          },
        ],
      },
    },
    {
      type: 405,
      payload: '140001000155000201021234',
      decoded: {
        parameters: [
          { parameter: 1, type: 0, valueSize: 1, valueHex: '55' },
          { parameter: 2, type: 1, valueSize: 2, valueHex: '1234' },
        ],
      },
    },
    {
      type: 411,
      payload: '01000001010CBA',
      decoded: {
        communicationMask: 1,
        obdCommunicationMask: 0,
        canError: 0,
        ignition: 1,
        extension: '010CBA',
      },
    },
    {
      type: 413,
      payload: '19111101622202B33301',
      decoded: {
        faults: [
          { code: 'P1111', status: 1 },
          { code: 'C2222', status: 2 },
          { code: 'B3333', status: 1 },
        ],
      },
    },
    { type: 417, payload: '', decoded: { noCanMessages: true } },
    {
      type: 418,
      payload: '20503134383201553031303002',
      decoded: {
        faults: [
          { code: 'P1482', status: 1 },
          { code: 'U0100', status: 2 },
        ],
      },
    },
    {
      type: 419,
      payload: '21000010F30701000004DF0B01',
      decoded: {
        faults: [
          { spn: 4339, fmi: 7, status: 1 },
          { spn: 1247, fmi: 11, status: 1 },
        ],
      },
    },
    { type: 412, payload: '01020304', decoded: {} },
    { type: 419, payload: '21000010F3', decoded: {} },
    // The PDF's printed 418 example conflicts with its five-ASCII-character layout.
    { type: 418, payload: '20804952565601854849484802', decoded: {} },
  ];
  const externalValues = values.slice(0, structure.length);
  externalValues[1] = '33';
  for (const { type, payload, decoded } of edataReports) {
    const extra = `19,0,${String(type)},0,1,1,1001,${payload}`;
    const expected = { type, ...decoded, payload };
    for (const command of ['06', '86']) {
      const parsed = parseFrame(
        Buffer.from(
          `$SLU862129080366630,${command},66,${externalValues.join(',')},${extra}`,
          'latin1',
        ),
      );
      if (!parsed) {
        throw new Error('External-device event envelope did not parse.');
      }
      const event = decodeEvent(parsed, structure);
      expect(event?.fields['edata']).toEqual(expected);
      expect(event?.fields['extra']).toEqual(extra.split(','));
    }
    const event = decodeBinaryEvent(
      slb('862129080366630', [0x08, 0x21, 0xfe, ...Buffer.from(extra, 'latin1')]),
    );
    expect(event?.eventId).toBe('33');
    expect(event?.fields['edata']).toEqual(expected);
    expect(event?.fields['extra']).toEqual(extra.split(','));
  }
});
