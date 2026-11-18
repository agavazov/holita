import { config } from 'dotenv';
import { appendFileSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';

config({ path: '.env', quiet: true });

// Transparent StarLink relay: every device connection is forwarded byte for byte to the
// upstream server (Karma), which keeps answering ACKs and sending commands. Complete frames
// of both directions are captured passively; the relay never writes to either side itself.
const host = process.env.ERM_RELAY_HOST ?? '0.0.0.0';
const port = Number(process.env.ERM_RELAY_PORT ?? '11500');
const upstream = process.env.ERM_RELAY_UPSTREAM ?? 'in.karma.online:500';
const upstreamHost = upstream.slice(0, upstream.lastIndexOf(':'));
const upstreamPort = Number(upstream.slice(upstream.lastIndexOf(':') + 1));
const captureDirectory = resolve(process.env.ERM_RELAY_CAPTURE_DIR ?? '.references/erm-relay');
for (const [name, value] of [
  ['ERM_RELAY_PORT', port],
  ['ERM_RELAY_UPSTREAM port', upstreamPort],
] as const) {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be an integer from 1 to 65535`);
  }
}
if (upstreamHost === '') {
  throw new Error('ERM_RELAY_UPSTREAM must be host:port');
}

const firstByteTimeoutMs = 60_000;
const upstreamConnectTimeoutMs = 10_000;
const keepAliveMs = 60_000;
// Device frames can reach about 3 KB; anything longer without CR LF is captured as partial.
const maxFrameBytes = 16_384;
const framePattern = /^([^,]{0,8}?)(SLU|SRV)([0-9A-F]{6}|\d{15}),(\d{2,3}),(\d{1,9})(?=[,*])/;
// G9 byte replacement: 0x10 followed by these bytes stands for the original byte.
const escapedBytes = new Map([
  [0x10, 0x10],
  [0x01, 0x0d],
  [0x02, 0x0a],
  [0x03, 0x00],
  [0x04, 0x11],
  [0x05, 0x13],
]);

mkdirSync(captureDirectory, { recursive: true, mode: 0o700 });
let lastConnection = 0;

function log(connection: number, message: string): void {
  console.log(`${new Date().toISOString()} #${String(connection)} ${message}`);
}

function record(entry: Record<string, string | number | boolean | undefined>): void {
  const at = new Date().toISOString();
  appendFileSync(
    resolve(captureDirectory, `${at.slice(0, 10)}.jsonl`),
    `${JSON.stringify({ at, ...entry })}\n`,
    { mode: 0o600 },
  );
}

// G2: sum of the unescaped bytes from SLU/SRV up to the separator asterisk, modulo 256.
function checksumState(line: Buffer, start: number): string {
  const separator = line.lastIndexOf(0x2a);
  const given = line.subarray(separator + 1, separator + 3).toString('latin1');
  if (separator < start || !/^[0-9A-F]{2}$/.test(given)) {
    return 'absent';
  }
  let sum = 0;
  for (let index = start; index < separator; index++) {
    const byte = line.readUInt8(index);
    const next = index + 1 < separator ? line.readUInt8(index + 1) : undefined;
    if (byte === 0x10 && next !== undefined && escapedBytes.has(next)) {
      sum += escapedBytes.get(next) ?? 0;
      index++;
    } else if ((byte === 0x24 || byte === 0x2a) && next === byte) {
      sum += byte;
      index++;
    } else {
      sum += byte;
    }
  }
  return (sum % 256).toString(16).toUpperCase().padStart(2, '0') === given ? 'ok' : 'mismatch';
}

function captureFrame(connection: number, from: string, line: Buffer, partial: boolean): void {
  const frame = line.toString('latin1');
  const [, header = '', origin, unit, command, reference] = framePattern.exec(frame) ?? [];
  const checksum = origin === undefined ? undefined : checksumState(line, header.length);
  record({
    connection,
    from,
    unit,
    command,
    reference,
    checksum,
    partial: partial || undefined,
    frame,
  });
  log(
    connection,
    `${from} ${unit ?? '?'} cmd=${command ?? '?'} ref=${reference ?? '?'} checksum=${checksum ?? '?'} ${String(line.length)} bytes${partial ? ' (partial)' : ''}`,
  );
}

function frameCapture(connection: number, from: string): (chunk: Buffer) => void {
  let pending = Buffer.alloc(0);
  return (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    for (let end = pending.indexOf('\r\n'); end >= 0; end = pending.indexOf('\r\n')) {
      captureFrame(connection, from, pending.subarray(0, end), false);
      pending = pending.subarray(end + 2);
    }
    if (pending.length > maxFrameBytes) {
      captureFrame(connection, from, pending, true);
      pending = Buffer.alloc(0);
    }
  };
}

const server = net.createServer((device) => {
  const connection = ++lastConnection;
  const peer = `${device.remoteAddress ?? '?'}:${String(device.remotePort ?? '?')}`;
  const opened = Date.now();
  let target: net.Socket | undefined;
  record({ connection, event: 'open', peer });
  log(connection, `open from ${peer}`);
  const firstByteTimer = setTimeout(() => {
    record({ connection, event: 'rejected', reason: 'no data' });
    log(connection, 'rejected: no data');
    device.destroy();
  }, firstByteTimeoutMs);
  device.setKeepAlive(true, keepAliveMs);
  device.on('error', (error) => {
    log(connection, `device error: ${error.message}`);
  });
  device.on('close', () => {
    clearTimeout(firstByteTimer);
    target?.destroy();
    const seconds = Math.round((Date.now() - opened) / 1000);
    record({
      connection,
      event: 'close',
      seconds,
      deviceBytes: device.bytesRead,
      serverBytes: device.bytesWritten,
    });
    log(
      connection,
      `closed after ${String(seconds)} s, device ${String(device.bytesRead)} B, server ${String(device.bytesWritten)} B`,
    );
  });

  // StarLink frames start with the protocol header "$"; other first bytes (scanners, TLS,
  // HTTP) are never forwarded to the upstream server.
  device.once('data', (head: Buffer) => {
    clearTimeout(firstByteTimer);
    device.pause();
    if (head.readUInt8(0) !== 0x24) {
      record({
        connection,
        event: 'rejected',
        reason: 'not StarLink',
        head: head.subarray(0, 64).toString('hex'),
      });
      log(connection, `rejected: first bytes ${head.subarray(0, 16).toString('hex')}`);
      device.destroy();
      return;
    }
    const link = net.connect({ host: upstreamHost, port: upstreamPort });
    target = link;
    link.setTimeout(upstreamConnectTimeoutMs, () => {
      link.destroy(new Error('connect timeout'));
    });
    link.on('error', (error) => {
      record({ connection, event: 'upstream-error', message: error.message });
      log(connection, `upstream error: ${error.message}`);
    });
    link.on('close', () => device.destroy());
    link.once('connect', () => {
      link.setTimeout(0);
      link.setKeepAlive(true, keepAliveMs);
      record({ connection, event: 'forwarded', upstream });
      log(connection, `forwarded to ${upstream}`);
      const fromDevice = frameCapture(connection, 'device');
      fromDevice(head);
      link.write(head);
      device.on('data', fromDevice);
      device.pipe(link);
      link.pipe(device);
      link.on('data', frameCapture(connection, 'server'));
    });
  });
});

server.maxConnections = 64;
server.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
server.listen(port, host, () => {
  console.log(
    `${new Date().toISOString()} ERM relay on ${host}:${String(port)} → ${upstream}, capture ${captureDirectory}`,
  );
});
