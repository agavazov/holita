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
  const listener = new DeviceListener(
    {
      host: '127.0.0.1',
      port: 0,
      upstreamHost: '127.0.0.1',
      upstreamPort,
      upstream: `127.0.0.1:${String(upstreamPort)}`,
    },
    (entry) => records.push(entry),
  );
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
      const outgoing = Buffer.concat([
        Buffer.from('$SLU862129080366630,06,1,'),
        Buffer.alloc(128 * 1024, 0xa5),
        Buffer.from('\r\n'),
      ]);
      device.write(outgoing.subarray(0, 1));
      const target = await accepted;
      const receivedDevice = readBytes(target, outgoing.length);
      device.write(outgoing.subarray(1));
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
    for (const head of ['GET / HTTP/1.1\r\n', '\u0016\u0003\u0001']) {
      const device = await connect();
      const deviceClosed = closed(device);
      device.write(head);
      await deviceClosed;
      expect(upstreamConnections).toBe(2);
    }
    await new Promise<void>((resolve, reject) =>
      upstream.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }),
    );
    upstreamClosed = true;
    const device = await connect();
    const deviceClosed = closed(device);
    device.write('$');
    await deviceClosed;
    expect(records.some((entry) => 'event' in entry && entry.event === 'upstream-error')).toBe(
      true,
    );
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
