import { expect, it } from '@jest/globals';
import { buildServerFrame, FrameSplitter, parseFrame, unescape } from './index.js';

it('splits bounded StarLink frames and preserves the checksum and binary wire contract', () => {
  const examples = [
    '$SRV0004D2,04,51,0001,0*A0',
    '$SRV00162E,04,51,0001,5678*4E',
    '$SRV358281002705360,04,51,0001,-1*96',
    '$SRVFFFFFF,04,51,0001,0*0A',
    '$SRV0004D2,04,4,0001,0*6E',
    '$SLU0004D2,01,1,2.11,2.11*F4',
    '$SRV0004D2,04,53,0049,myserver.com*68',
  ];
  for (const frame of examples) {
    expect({ frame, checksum: parseFrame(Buffer.from(frame))?.checksum }).toEqual({
      frame,
      checksum: 'ok',
    });
  }
  const binary = Buffer.from([0x24, 0x2a, 0x10, 0x0d, 0x0a, 0x00, 0x11, 0x13]);
  const encoded = Buffer.from([
    0x24, 0x24, 0x2a, 0x2a, 0x10, 0x10, 0x10, 0x01, 0x10, 0x02, 0x10, 0x03, 0x10, 0x04, 0x10, 0x05,
  ]);
  const escapedFrame = Buffer.concat([
    Buffer.from('$SRV0004D2,30,7,2,0,'),
    encoded,
    Buffer.from('*A6\r\n'),
  ]);
  expect(unescape(encoded)).toEqual(binary);
  expect(buildServerFrame('0004D2', '30', '7', ['2', '0', binary])).toEqual(escapedFrame);
  expect(parseFrame(escapedFrame.subarray(0, -2))).toEqual({
    header: '$',
    origin: 'SRV',
    unitId: '0004D2',
    command: '30',
    reference: '7',
    fields: [Buffer.from('2'), Buffer.from('0'), binary],
    checksum: 'ok',
  });
  expect(buildServerFrame('0004D2', '02', '1')).toEqual(Buffer.from('$SRV0004D2,02,1*20\r\n'));
  for (const [frame, expected] of [
    ['$SLU0004D2,01,1,2.11,2.11*00', 'mismatch'],
    ['$SRV0004D2,30,7,2,0,$$**\x10\x10\x10\x01\x10\x02\x10\x03\x10\x04\x10\x05*A7', 'mismatch'],
    ['$SLU862129080366630,125,999999999,payload', 'absent'],
    ['$SLU0004D2,01,1', 'absent'],
  ]) {
    expect({ frame, checksum: parseFrame(Buffer.from(frame ?? '', 'latin1'))?.checksum }).toEqual({
      frame,
      checksum: expected,
    });
  }
  expect(parseFrame(Buffer.from('not StarLink'))).toBeUndefined();

  const first = Buffer.from('$SLU0004D2,01,1,2.11,2.11*F4');
  const second = Buffer.from('$SRV0004D2,04,4,0001,0*6E');
  const splittingCases = [
    {
      name: 'fragmented and coalesced frames',
      chunks: [
        first.subarray(0, 5),
        Buffer.concat([first.subarray(5), Buffer.from('\r')]),
        Buffer.concat([Buffer.from('\n'), second, Buffer.from('\r\n')]),
      ],
      expected: [
        { raw: first, partial: false },
        { raw: second, partial: false },
      ],
    },
    {
      name: 'oversized data remains bounded and the following frame is complete',
      chunks: [
        Buffer.alloc(16_385, 0x61),
        Buffer.from('\r'),
        Buffer.concat([Buffer.from('\n'), first, Buffer.from('\r\n')]),
      ],
      expected: [
        { raw: Buffer.alloc(16_384, 0x61), partial: true },
        { raw: Buffer.from('a'), partial: true },
        { raw: first, partial: false },
      ],
    },
    {
      name: 'a frame at the bound retains its fragmented terminator',
      chunks: [Buffer.alloc(16_384, 0x61), Buffer.from('\r'), Buffer.from('\n')],
      expected: [{ raw: Buffer.alloc(16_384, 0x61), partial: false }],
    },
  ];
  for (const scenario of splittingCases) {
    const splitter = new FrameSplitter();
    expect({
      name: scenario.name,
      frames: scenario.chunks.flatMap((chunk) => splitter.push(chunk)),
    }).toEqual({ name: scenario.name, frames: scenario.expected });
    expect(splitter.flush()).toEqual([]);
  }
  for (const scenario of [
    {
      tail: Buffer.from('unfinished\r'),
      expected: [{ raw: Buffer.from('unfinished\r'), partial: true }],
    },
    {
      tail: Buffer.concat([Buffer.alloc(16_384, 0x61), Buffer.from('\r')]),
      expected: [
        { raw: Buffer.alloc(16_384, 0x61), partial: true },
        { raw: Buffer.from('\r'), partial: true },
      ],
    },
  ]) {
    const tail = new FrameSplitter();
    expect(tail.push(scenario.tail)).toEqual([]);
    expect(tail.flush()).toEqual(scenario.expected);
  }
});
