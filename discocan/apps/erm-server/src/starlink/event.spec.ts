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
      reference: '66',
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
    reference: '2',
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
      [
        0x03, 0xff, 0xff, 0xff, 0xff, 0x08, 0x01, 0x20, 0x5f, 0xdc, 0x26, 0x39, 0x41, 0x00, 0x86,
        0xff, 0x32, 0x0b,
      ],
      {
        reference: '4294967295',
        mainVoltage: 24.54,
        engineOn: true,
        fields: { '#BATH#': '57', '#STRT#': '1.34', '#IGN#': '1' },
      },
    ],
    [
      '862129080366630',
      [0x08, 0x01, 0x26, 0x64, 0x41, 0x00, 0x04, 0x32, 0x00],
      {
        reference: null,
        engineOn: false,
        fields: { '#BATH#': '100', '#STRT#': '0.04', '#IGN#': '0' },
      },
    ],
    [
      '862129080320033',
      [0x08, 0x01, 0x21, 0x0f, 0xbf, 0x41, 0x01, 0x17, 0x18, 0x1c, 0x18],
      {
        reference: null,
        backupVoltage: 4.031,
        engineOn: null,
        fields: { '#BATH#': null, '#STRT#': '2.79', '#SATN#': '28', '#SATU#': '24', '#IGN#': null },
      },
    ],
    // Observed CB6711TE defect: opaque tag 04 prevented the following 405 from being decoded.
    [
      '862129080319233',
      [0x08, 0x21, 0x04, 0xac, 0xfe, ...Buffer.from('19,0,405,0,1,1,1001,140001000155')],
      {
        eventId: '33',
        fields: {
          binary04: 'ac',
          edata: {
            type: 405,
            parameters: [{ parameter: 1, type: 0, valueSize: 1, valueHex: '55' }],
          },
        },
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

  // CB6711TE's freeze frame (ERM event 69735, 2026-11-11), sent after its 419 added SPN 1247/FMI 11
  // and SPN 3720/FMI 15: 65 parameter=value pairs, all of type 0.
  const freezeFrame = [
    ...`539=12 188=0F 1=5F 687=00020F57 64=2300 785=2D 1657=00020F57 2=00 718=00 694=63 781=18
      696=0208 697=0208 672=22E6 688=0004E6FB 1296=06 662=00 1417=00 1551=03 651=63 153=00
      630=00 1298=0B 1322=08 164=7D 1301=7D 579=65 23=00 189=01 660=00 838=00 1548=00
      2236=00 1608=00 1419=00 695=00 1288=00 708=0D 1435=00 1436=00 1437=00 1438=00 1439=01
      1441=00 1444=00 1445=00 1135=00 1447=00 1136=00 1324=00 1889=00 1890=00 1891=00
      1892=00 1893=00 1894=00 1895=03 1896=00 1897=00 1898=00 1899=00 1900=00 1901=00
      1902=00 1903=00`.matchAll(/(\d+)=([0-9A-F]+)/g),
  ].map(([, parameter = '', valueHex = '']) => ({
    parameter: Number(parameter),
    type: 0,
    valueSize: valueHex.length / 2,
    valueHex,
  }));
  // Vendor examples, except 411/415/419 (real captures) and 418 (synthetic documented layout).
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
    {
      type: 415,
      payload:
        '1D021B00011200BC00010F000100015F02AF000400020F57004000022300031100012D0679000400020F57000200010002CE00010002B6000163030D00011802B80002020802B90002020802A0000222E602B000040004E6FB051000010602960001000589000100060F000103028B00016300990001000276000100051200010B052A00010800A400017D051500017D0243000165001700010000BD00010102940001000346000100060C00010008BC0001000648000100058B00010002B7000100050800010002C400010D059B000100059C000100059D000100059E000100059F00010105A100010005A400010005A5000100046F00010005A70001000470000100052C000100076100010007620001000763000100076400010007650001000766000100076700010307680001000769000100076A000100076B000100076C000100076D000100076E000100076F000100',
      decoded: { parameters: freezeFrame },
    },
    { type: 417, payload: '', decoded: { noCanMessages: true } },
    { type: 417, payload: '00', decoded: {} },
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
    {
      type: 419,
      payload: '21000010F30701000004DF0B02',
      decoded: {
        faults: [
          { spn: 4339, fmi: 7, status: 1 },
          { spn: 1247, fmi: 11, status: 2 },
        ],
      },
    },
    { type: 413, payload: '1911110162', decoded: {} },
    { type: 415, payload: '140001000155', decoded: {} },
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
