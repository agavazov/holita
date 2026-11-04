import { BadRequestException, ConflictException } from '@nestjs/common';
import { expect, it } from '@jest/globals';
import { once } from 'node:events';
import net, { type Socket } from 'node:net';
import { buildServerFrame, parseFrame } from '../../starlink/index.js';
import type { CaptureRecord } from './capture-record.js';
import { validateCommand } from './command.js';
import { DeviceListener } from './device-listener.js';

const unitId = '0004D2';

function portOf(server: net.Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a TCP listener');
  }
  return address.port;
}

function deviceFrame(command: string, reference: string, fields: string[] = []): Buffer {
  const body = [`SLU${unitId}`, command, reference, ...fields].join(',');
  const sum = [...Buffer.from(body)].reduce((total, byte) => total + byte, 0);
  return Buffer.from(`$${body}*${(sum % 256).toString(16).toUpperCase().padStart(2, '0')}\r\n`);
}

class SocketFrames {
  private buffer = Buffer.alloc(0);
  private readonly frames: Buffer[] = [];
  private waiting: { resolve: (frame: Buffer) => void; reject: (error: Error) => void } | undefined;

  constructor(socket: Socket) {
    socket.on('data', (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      let boundary = this.buffer.indexOf('\r\n');
      while (boundary >= 0) {
        const frame = this.buffer.subarray(0, boundary + 2);
        this.buffer = this.buffer.subarray(boundary + 2);
        if (this.waiting) {
          this.waiting.resolve(frame);
          this.waiting = undefined;
        } else {
          this.frames.push(frame);
        }
        boundary = this.buffer.indexOf('\r\n');
      }
    });
    socket.on('error', (error) => {
      this.waiting?.reject(error);
      this.waiting = undefined;
    });
    socket.on('close', () => {
      this.waiting?.reject(new Error('Socket closed before receiving a complete frame'));
      this.waiting = undefined;
    });
  }

  next(): Promise<Buffer> {
    const frame = this.frames.shift();
    if (frame) {
      return Promise.resolve(frame);
    }
    return new Promise((resolve, reject) => {
      this.waiting = { resolve, reject };
    });
  }
}

it('acknowledges primary units, filters owned confirmations and completes allowlisted commands', async () => {
  const definition = '030D000000000000000100010000000000000000003C';
  // A whole 49-byte globals write: only the gateway's recorded workflow route may send it.
  const globals = [
    '19',
    '0',
    '19',
    '302',
    '0',
    '1',
    '1',
    '03E903E80102080001010001010100'.padEnd(98, '0'),
  ];
  for (const fields of [
    ['19', '0', '19', '301', '0', '1', '1', `02${definition}`],
    ['19', '0', '19', '301', '0', '1', '1', '10030D'],
    ['19', '0', '19', '303', '0', '1', '1', ''],
  ]) {
    expect(validateCommand({ command: '30', fields })).toEqual({ command: '30', fields });
  }
  const upstreamSockets = new Set<Socket>();
  let upstreamConnections = 0;
  const upstream = net.createServer((socket) => {
    upstreamConnections++;
    upstreamSockets.add(socket);
    socket.on('error', () => undefined);
    socket.on('close', () => {
      upstreamSockets.delete(socket);
    });
  });
  await new Promise<void>((resolve) => {
    upstream.listen(0, '127.0.0.1', resolve);
  });
  const upstreamPort = portOf(upstream);
  const records: CaptureRecord[] = [];
  let onUpstreamClose: (() => void) | undefined;
  const listener = new DeviceListener(
    {
      host: '127.0.0.1',
      port: 0,
      upstreamHost: '127.0.0.1',
      upstreamPort,
      upstream: `127.0.0.1:${String(upstreamPort)}`,
      primaryUnits: new Set([unitId]),
      ackCommands: new Set(['06']),
      reconnectDelayMs: 200,
    },
    (entry) => {
      records.push(entry);
      if ('event' in entry && entry.event === 'upstream-close') {
        onUpstreamClose?.();
      }
    },
  );
  await listener.start();
  const device = net.connect({ host: '127.0.0.1', port: portOf(listener.server) });
  const deviceFrames = new SocketFrames(device);
  try {
    await once(device, 'connect');
    const first = deviceFrame('06', '71', ['261103120000', '01']);
    device.write(first.subarray(0, -2));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
    expect(upstreamConnections).toBe(0);
    const connectedUpstream = new Promise<Socket>((resolve) => {
      upstream.once('connection', resolve);
    });
    device.write(first.subarray(-2));
    const acknowledgement = parseFrame((await deviceFrames.next()).subarray(0, -2));
    expect(acknowledgement).toMatchObject({
      origin: 'SRV',
      unitId,
      command: '02',
      checksum: 'ok',
    });
    expect(Number(acknowledgement?.reference)).toBeGreaterThanOrEqual(900000001);
    expect(Number(acknowledgement?.reference)).toBeLessThanOrEqual(999999999);
    expect(acknowledgement?.fields.map((field) => field.toString('latin1'))).toEqual(['71', '01']);
    const karma = await connectedUpstream;
    const karmaFrames = new SocketFrames(karma);
    expect(await karmaFrames.next()).toEqual(first);
    expect(listener.listUnits()).toEqual([
      expect.objectContaining({ unitId, mode: 'primary', peer: expect.any(String) }),
    ]);

    const dropped = buildServerFrame(unitId, '02', '15', ['71', '01']);
    const passed = [
      buildServerFrame(unitId, '02', '16', ['999', '01']),
      buildServerFrame(unitId, '95', '17', ['authentication-answer']),
      buildServerFrame(unitId, '04', '18', ['0774', '30']),
    ];
    karma.write(Buffer.concat([dropped, ...passed]));
    for (const frame of passed) {
      expect(await deviceFrames.next()).toEqual(frame);
    }

    const event = deviceFrame('06', '72', ['261103120001', '01']);
    const concurrent = [
      buildServerFrame(unitId, '95', '19', ['answer']),
      buildServerFrame(unitId, '04', '20', ['0774', '60']),
    ];
    karma.write(Buffer.concat(concurrent));
    device.write(event);
    const received: Buffer[] = [];
    for (let index = 0; index < 3; index++) {
      received.push(await deviceFrames.next());
    }
    for (const frame of concurrent) {
      expect(received.some((candidate) => candidate.equals(frame))).toBe(true);
    }
    expect(
      received.some((frame) => {
        const parsed = parseFrame(frame.subarray(0, -2));
        return parsed?.command === '02' && parsed.fields[0]?.toString() === '72';
      }),
    ).toBe(true);
    expect(await karmaFrames.next()).toEqual(event);

    const oversizedPrefix = Buffer.concat([
      Buffer.from(`$SRV${unitId},95,21,`),
      Buffer.alloc(17_000, 0x41),
    ]);
    const oversizedTail = Buffer.from(',tail\r\n');
    const prefixStarted = new Promise<Buffer>((resolve) => {
      device.once('data', resolve);
    });
    karma.write(oversizedPrefix);
    const prefixChunk = await prefixStarted;
    expect(prefixChunk).toEqual(oversizedPrefix.subarray(0, prefixChunk.length));
    const duringPartial = deviceFrame('06', '73', ['261103120002', '01']);
    device.write(duringPartial);
    expect(await karmaFrames.next()).toEqual(duringPartial);
    karma.write(oversizedTail);
    expect(await deviceFrames.next()).toEqual(Buffer.concat([oversizedPrefix, oversizedTail]));
    const afterPartial = parseFrame((await deviceFrames.next()).subarray(0, -2));
    expect(afterPartial?.command).toBe('02');
    expect(afterPartial?.fields.map((field) => field.toString())).toEqual(['73', '01']);

    for (const invalid of [
      { command: '04', fields: ['0593', '1234'] },
      { command: '03', fields: ['0050'] },
      { command: '45', fields: ['0177', '0052'] },
      { command: '04', fields: ['0051', 'host'] },
      { command: '46', fields: ['0049', 'host', '0051', 'backup'] },
      { command: '46', fields: ['0049', 'host,0774,30'] },
      { command: '46', fields: ['0049', 'host', '0774', '30'] },
      { command: '56', fields: ['1'] },
      { command: '01', fields: [] },
      ...[
        `01${definition}`,
        `02${definition}${definition}`,
        '10030D0296',
        `02${definition.slice(0, -1)}X`,
        '10030X',
      ].map((payload) => ({
        command: '30',
        fields: ['19', '0', '19', '301', '0', '1', '1', payload],
      })),
      {
        command: '30',
        fields: ['19', '0', '19', '301', '0', '1', '1', `02${definition}`, ''],
      },
      { command: '30', fields: globals },
    ]) {
      await expect(listener.sendCommand(unitId, invalid)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }

    for (const input of [
      {
        command: '03',
        fields: ['0177'],
        responseFields: ['0177', '#EDT#,#EID#'],
        expectedFields: ['0177', '#EDT#', '#EID#'],
      },
      {
        command: '45',
        fields: ['0177', '0774'],
        responseFields: ['0177', '"#EDT#,#EID#"', '0774', '30'],
        expectedFields: ['0177', '"#EDT#,#EID#"', '0774', '30'],
      },
      {
        command: '45',
        fields: ['0177', '0774'],
        responseFields: ['0774', '30'],
        expectedFields: ['0774', '30'],
      },
      {
        command: '03',
        fields: ['0593'],
        responseFields: ['0593', '1234'],
        expectedFields: ['0593', '1234'],
      },
      {
        command: '48',
        fields: ['VER=#VER#'],
        responseFields: ['VER=2.44'],
        expectedFields: ['VER=2.44'],
      },
      {
        command: '30',
        fields: globals,
        responseFields: globals,
        expectedFields: globals,
        recorded: true,
      },
    ]) {
      const command = { command: input.command, fields: input.fields };
      const readCommand = input.recorded
        ? listener.sendRecordedGlobals(unitId, command)
        : listener.sendCommand(unitId, command);
      const readFrame = parseFrame((await deviceFrames.next()).subarray(0, -2));
      expect(readFrame).toMatchObject({ command: input.command, checksum: 'ok' });
      expect(readFrame?.fields.map((field) => field.toString())).toEqual(input.fields);
      const parameterResponse = deviceFrame(input.command, '80', input.responseFields);
      device.write(parameterResponse);
      expect(await readCommand).toMatchObject({
        reference: readFrame?.reference,
        status: 'answered',
        resultCode: null,
        fields: input.expectedFields,
      });
      // The reply is confirmed by holita and never reaches Karma (checked by the next Karma frame).
      const replyConfirmation = parseFrame((await deviceFrames.next()).subarray(0, -2));
      expect(replyConfirmation?.command).toBe('02');
      expect(replyConfirmation?.fields.map((field) => field.toString())).toEqual(['80', '01']);
    }

    const rejectedRead = listener.sendCommand(unitId, { command: '45', fields: ['0177', '0774'] });
    const rejectedReadFrame = parseFrame((await deviceFrames.next()).subarray(0, -2));
    if (!rejectedReadFrame) {
      throw new Error('Expected a parameter read command');
    }
    const receipt = deviceFrame('02', '90', [rejectedReadFrame.reference, '01']);
    const afterReceipt = deviceFrame('02', '91', ['321', '01']);
    device.write(Buffer.concat([receipt, afterReceipt]));
    expect(await karmaFrames.next()).toEqual(afterReceipt);
    await expect(
      listener.sendCommand(unitId, { command: '05', fields: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
    device.write(deviceFrame('02', '92', [rejectedReadFrame.reference, '03']));
    expect(await rejectedRead).toMatchObject({
      reference: rejectedReadFrame.reference,
      status: 'answered',
      resultCode: '03',
      fields: [],
    });

    const locationCommand = listener.sendCommand(unitId, { command: '05', fields: [] });
    const locationFrame = parseFrame((await deviceFrames.next()).subarray(0, -2));
    expect(locationFrame).toMatchObject({ command: '05', checksum: 'ok' });
    if (!locationFrame) {
      throw new Error('Expected a location command');
    }
    const ownedConfirmation = deviceFrame('02', '81', [locationFrame.reference, '01', 'optional']);
    const ordinaryConfirmation = deviceFrame('02', '82', ['123', '01']);
    device.write(Buffer.concat([ownedConfirmation, ordinaryConfirmation]));
    expect(await locationCommand).toMatchObject({
      reference: locationFrame.reference,
      status: 'answered',
      resultCode: '01',
      fields: ['optional'],
    });
    expect(await karmaFrames.next()).toEqual(ordinaryConfirmation);

    const writeCommand = listener.sendCommand(unitId, {
      command: '46',
      fields: ['0049', 'host', '0050', '11500'],
    });
    const writeFrame = parseFrame((await deviceFrames.next()).subarray(0, -2));
    expect(writeFrame?.fields.map((field) => field.toString())).toEqual([
      '0049',
      'host',
      '0050',
      '11500',
    ]);
    device.write(deviceFrame('02', '83', [writeFrame?.reference ?? '', '01']));
    expect(await writeCommand).toMatchObject({ status: 'answered', resultCode: '01' });

    const reconnected = new Promise<{ socket: Socket; frames: SocketFrames }>((resolve) => {
      upstream.once('connection', (socket) => {
        resolve({ socket, frames: new SocketFrames(socket) });
      });
    });
    const upstreamLost = new Promise<void>((resolve) => {
      onUpstreamClose = resolve;
    });
    // Leave a fragment in the old upstream splitter; it must never reach the device.
    const incomplete = Buffer.from(`$SRV${unitId},95,84,unfinished`);
    karma.write(incomplete);
    karma.end();
    await upstreamLost;
    expect(device.destroyed).toBe(false);
    const offlineFrames = [
      deviceFrame('06', '85', ['261103120003', '01']),
      deviceFrame('06', '86', ['261103120004', '01']),
    ];
    device.write(Buffer.concat(offlineFrames));
    for (const reference of ['85', '86']) {
      const ack = parseFrame((await deviceFrames.next()).subarray(0, -2));
      expect(ack?.fields.map((field) => field.toString())).toEqual([reference, '01']);
    }
    const offlineCommand = listener.sendCommand(unitId, { command: '05', fields: [] });
    const offlineFrame = parseFrame((await deviceFrames.next()).subarray(0, -2));
    expect(offlineFrame?.command).toBe('05');
    device.write(deviceFrame('02', '87', [offlineFrame?.reference ?? '', '01']));
    expect(await offlineCommand).toMatchObject({ status: 'answered' });
    const nextKarma = await reconnected;
    for (const frame of offlineFrames) {
      expect(await nextKarma.frames.next()).toEqual(frame);
    }
    const marker = buildServerFrame(unitId, '95', '88', ['after-reconnect']);
    nextKarma.socket.write(
      Buffer.concat([buildServerFrame(unitId, '02', '89', ['85', '01']), marker]),
    );
    expect(await deviceFrames.next()).toEqual(marker);
    expect(records).toContainEqual(
      expect.objectContaining({
        connection: 1,
        from: 'server',
        partial: true,
        frame: incomplete.toString('latin1'),
      }),
    );
    expect(records.filter((entry) => 'event' in entry && entry.event === 'forwarded')).toHaveLength(
      2,
    );
    expect(records).toContainEqual({
      connection: 1,
      event: 'upstream-close',
      reason: 'upstream closed',
    });
    expect(records.some((entry) => 'from' in entry && entry.from === 'holita')).toBe(true);
  } finally {
    device.destroy();
    for (const socket of upstreamSockets) {
      socket.destroy();
    }
    await listener.stop();
    await new Promise<void>((resolve) => {
      upstream.close(() => {
        resolve();
      });
    });
  }
}, 15_000);
