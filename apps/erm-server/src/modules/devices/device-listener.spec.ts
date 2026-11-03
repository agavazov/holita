import { expect, it } from '@jest/globals';
import { once } from 'node:events';
import net, { type Socket } from 'node:net';
import type { CaptureRecord } from './capture-record.js';
import { DeviceListener } from './device-listener.js';

function portOf(server: net.Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a TCP listener.');
  }
  return address.port;
}

function readBytes(socket: Socket, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      received += chunk.length;
      if (received >= length) {
        socket.off('data', onData);
        socket.off('error', reject);
        resolve(Buffer.concat(chunks));
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
  });
}

function closed(socket: Socket): Promise<void> {
  return new Promise((resolve) =>
    socket.once('close', () => {
      resolve();
    }),
  );
}

it('mirrors exact bytes, rejects non-StarLink traffic and closes failed upstream connections', async () => {
  const upstreamSockets = new Set<Socket>();
  const clients = new Set<Socket>();
  let upstreamConnections = 0;
  const upstream = net.createServer((socket) => {
    upstreamConnections++;
    upstreamSockets.add(socket);
    socket.on('error', () => undefined);
    socket.on('close', () => upstreamSockets.delete(socket));
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const upstreamPort = portOf(upstream);
  const records: CaptureRecord[] = [];
  const closeReasons = new Map<number, string>();
  let onUpstreamError: (() => void) | undefined;
  const options = {
    host: '127.0.0.1',
    port: 0,
    upstreamHost: '127.0.0.1',
    upstreamPort,
    upstream: `127.0.0.1:${String(upstreamPort)}`,
    reconnectDelayMs: 25,
  };
  const listener = new DeviceListener(options, (entry, reason) => {
    records.push(entry);
    if ('event' in entry && entry.event === 'upstream-error') {
      onUpstreamError?.();
    }
    if (reason !== undefined) {
      closeReasons.set(entry.connection, reason);
    }
  });
  await listener.start();
  const connect = async () => {
    const socket = net.connect({ host: '127.0.0.1', port: portOf(listener.server) });
    clients.add(socket);
    socket.on('error', () => undefined);
    await once(socket, 'connect');
    return socket;
  };
  let upstreamClosed = false;
  try {
    // Exercise both close directions; payloads exceed the capture bound and TCP's read chunks.
    for (const closer of ['device', 'upstream']) {
      const device = await connect();
      const accepted = new Promise<Socket>((resolve) => upstream.once('connection', resolve));
      const first = Buffer.from('$SLU862129080366630,01,1*00\r\n');
      const outgoing = Buffer.concat([first, Buffer.alloc(128 * 1024, 0xa5), Buffer.from('\r\n')]);
      device.write(first);
      const target = await accepted;
      const receivedDevice = readBytes(target, outgoing.length);
      device.write(outgoing.subarray(first.length));
      expect(await receivedDevice).toEqual(outgoing);

      const incoming = Buffer.concat([
        Buffer.from('$SRV862129080366630,02,1,'),
        Buffer.from(Array.from({ length: 256 }, (_, byte) => byte)),
        Buffer.alloc(96 * 1024, 0x5a),
        Buffer.from('\r\n'),
      ]);
      const receivedServer = readBytes(device, incoming.length);
      target.write(incoming);
      expect(await receivedServer).toEqual(incoming);
      const deviceClosed = closed(device);
      const targetClosed = closed(target);
      (closer === 'device' ? device : target).end();
      await Promise.all([deviceClosed, targetClosed]);
    }
    expect(upstreamConnections).toBe(2);
    const firstDevice = await connect();
    const firstAccepted = new Promise<Socket>((resolve) => upstream.once('connection', resolve));
    firstDevice.write('$SLUabc123,01,1*00\r\n');
    const firstTarget = await firstAccepted;
    firstTarget.resume();
    const firstDeviceClosed = closed(firstDevice);
    const firstTargetClosed = closed(firstTarget);
    const newerDevice = await connect();
    const newerAccepted = new Promise<Socket>((resolve) => upstream.once('connection', resolve));
    newerDevice.write('$SLUABC123,01,2*00\r\n');
    const newerTarget = await newerAccepted;
    newerTarget.resume();
    await Promise.all([firstDeviceClosed, firstTargetClosed]);
    expect([...closeReasons.values()]).toContain('replaced by a newer connection');
    expect(listener.listUnits()).toEqual([
      expect.objectContaining({ unitId: 'ABC123', mode: 'mirror' }),
    ]);
    const newerDeviceClosed = closed(newerDevice);
    const newerTargetClosed = closed(newerTarget);
    newerDevice.end();
    await Promise.all([newerDeviceClosed, newerTargetClosed]);
    expect(upstreamConnections).toBe(4);
    for (const head of ['GET / HTTP/1.1\r\n', '\u0016\u0003\u0001']) {
      const device = await connect();
      const deviceClosed = closed(device);
      device.write(head);
      await deviceClosed;
      expect(upstreamConnections).toBe(4);
    }
    // The configured address refuses connections; other sessions cached the live loopback IP.
    options.upstreamHost = '127.0.0.2';
    const returningDevice = await connect();
    const first = Buffer.from('$SLU862129080366630,01,1*00\r\n');
    const held = Buffer.concat([first, Buffer.alloc(32 * 1024, 0xa5), Buffer.from('\r\n')]);
    const later = Buffer.from('$SLU862129080366630,06,2,after-retry*00\r\n');
    const refused = new Promise<void>((resolve) => {
      onUpstreamError = resolve;
    });
    const retried = new Promise<{ socket: Socket; received: Promise<Buffer> }>((resolve) => {
      upstream.once('connection', (socket) => {
        resolve({ socket, received: readBytes(socket, held.length + later.length) });
      });
    });
    returningDevice.write(held);
    await refused;
    onUpstreamError = undefined;
    expect(returningDevice.destroyed).toBe(false);
    const recovered = await retried;
    returningDevice.write(later);
    expect(await recovered.received).toEqual(Buffer.concat([held, later]));
    const returningClosed = closed(returningDevice);
    const recoveredClosed = closed(recovered.socket);
    recovered.socket.end();
    await Promise.all([returningClosed, recoveredClosed]);
    options.upstreamHost = '127.0.0.1';
    await new Promise<void>((resolve, reject) => {
      upstream.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    upstreamClosed = true;

    const failuresStart = records.length;
    const device = await connect();
    const deviceClosed = closed(device);
    device.write('$SLU862129080366630,01,1*00\r\n');
    await deviceClosed;
    // The client can see the close before the gateway records it.
    const failed = records.findLast((entry) => 'event' in entry && entry.event === 'open');
    while (failed && !closeReasons.has(failed.connection)) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(
      records
        .slice(failuresStart)
        .filter((entry) => 'event' in entry && entry.event === 'upstream-error'),
    ).toHaveLength(3);
    expect(closeReasons.get(failed?.connection ?? 0)).toMatch(/^upstream error: .*ECONNREFUSED/);
    expect(records.some((entry) => 'from' in entry && entry.partial)).toBe(true);
  } finally {
    for (const socket of [...clients, ...upstreamSockets]) {
      socket.destroy();
    }
    await listener.stop();
    if (!upstreamClosed) {
      await new Promise<void>((resolve) =>
        upstream.close(() => {
          resolve();
        }),
      );
    }
  }
}, 20_000);
