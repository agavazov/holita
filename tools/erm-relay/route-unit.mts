import { appendFileSync, mkdirSync } from 'node:fs';
import net, { type Socket } from 'node:net';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { inflateContainer } from './starlink-container.mjs';

// Moves one StarLink unit's primary server (parameters 0049/0050) between Karma and discocan.
// The unit reaches this tool through a configuration-server session (command 98, queued through
// Karma) or, when its primary server is already discocan, through its next ordinary connection.
// The tool reads 0049-0052 (45), writes 0049/0050 (46), reads them back and writes the previous
// values again when the result differs. It confirms the 45 replies and sends no other command.
const { values: options } = parseArgs({
  options: {
    unit: { type: 'string' },
    to: { type: 'string' },
    discocan: { type: 'string' },
    karma: { type: 'string', default: 'in.karma.online:500' },
    port: { type: 'string', default: '11500' },
    'wait-minutes': { type: 'string', default: '140' },
  },
});
const unit = options.unit ?? '';
const port = Number(options.port);
const waitMinutes = Number(options['wait-minutes']);
if (!/^([0-9A-F]{6}|\d{15})$/.test(unit) || (options.to !== 'discocan' && options.to !== 'karma')) {
  throw new Error('Usage: --unit <6-hex or 15-digit ID> --to discocan|karma --discocan <host:port>');
}
if (!Number.isInteger(port) || port < 1 || port > 65535 || !(waitMinutes > 0)) {
  throw new Error('--port must be 1-65535 and --wait-minutes positive');
}
function server(value: string | undefined): { host: string; port: string } {
  const match = /^([A-Za-z0-9.-]+):(\d{1,5})$/.exec(value ?? '');
  if (!match?.[1] || !match[2] || Number(match[2]) < 1 || Number(match[2]) > 65535) {
    throw new Error('--discocan and --karma must be host:port');
  }
  return { host: match[1], port: match[2] };
}
const discocan = server(options.discocan);
const karma = server(options.karma);
const [from, to] = options.to === 'discocan' ? [karma, discocan] : [discocan, karma];
const captureDirectory = resolve(process.env.ERM_RELAY_CAPTURE_DIR ?? '.references/erm-relay');
mkdirSync(captureDirectory, { recursive: true, mode: 0o700 });

function record(entry: Record<string, unknown>): void {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  console.log(line);
  appendFileSync(
    resolve(captureDirectory, `route-unit-${new Date().toISOString().slice(0, 10)}.jsonl`),
    `${line}\n`,
    { mode: 0o600 },
  );
}

// G2 checksum and G9 byte replacement, as in apps/erm-server/src/starlink/protocol.ts.
const escapedBytes = new Map([
  [0x10, 0x10],
  [0x01, 0x0d],
  [0x02, 0x0a],
  [0x03, 0x00],
  [0x04, 0x11],
  [0x05, 0x13],
]);
const binaryEscapes = new Map([...escapedBytes].map(([encoded, decoded]) => [decoded, encoded]));
function checksum(body: Buffer): string {
  return (body.reduce((sum, byte) => sum + byte, 0) % 256)
    .toString(16)
    .toUpperCase()
    .padStart(2, '0');
}
function serverFrame(command: string, reference: string, fields: string[]): Buffer {
  const body = Buffer.from([`SRV${unit}`, command, reference, ...fields].join(','), 'latin1');
  const encoded: number[] = [];
  for (const byte of body) {
    const replacement = binaryEscapes.get(byte);
    if (replacement !== undefined) {
      encoded.push(0x10, replacement);
    } else {
      encoded.push(...(byte === 0x24 || byte === 0x2a ? [byte, byte] : [byte]));
    }
  }
  return Buffer.concat([
    Buffer.from('$'),
    Buffer.from(encoded),
    Buffer.from(`*${checksum(body)}\r\n`),
  ]);
}
function deviceFrame(
  raw: Buffer,
): { command: string; reference: string; fields: string[] } | undefined {
  const decoded: number[] = [];
  let end = -1;
  for (let index = 1; index < raw.length; index++) {
    const byte = raw.readUInt8(index);
    const next = raw[index + 1];
    const replacement = byte === 0x10 && next !== undefined ? escapedBytes.get(next) : undefined;
    if (replacement !== undefined || ((byte === 0x24 || byte === 0x2a) && next === byte)) {
      decoded.push(replacement ?? byte);
      index++;
    } else if (byte === 0x2a) {
      end = index;
      break;
    } else {
      decoded.push(byte);
    }
  }
  const body = Buffer.from(decoded);
  const text = body.toString('latin1');
  if (raw[0] !== 0x24 || end < 0 || raw.subarray(end + 1, end + 3).toString() !== checksum(body)) {
    return undefined;
  }
  if (!text.startsWith(`SLU${unit},`)) {
    return undefined;
  }
  // Quoted values (45 responses) may contain commas.
  const fields: string[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index <= text.length; index++) {
    if (text[index] === '"') {
      quoted = !quoted;
    } else if (index === text.length || (text[index] === ',' && !quoted)) {
      fields.push(text.slice(start, index));
      start = index + 1;
    }
  }
  const [, command, frameReference, ...rest] = fields;
  return command && frameReference
    ? {
        command,
        reference: frameReference,
        fields: rest.map((field) => field.replace(/^"(.*)"$/, '$1')),
      }
    : undefined;
}

let reference = 900_000_100;
let active: Socket | undefined;
let finished = false;
type Outcome = 'MOVED' | 'NOT_MOVED' | 'UNCERTAIN' | 'NO_SESSION';
const exitCodes: Record<Outcome, number> = { MOVED: 0, NOT_MOVED: 2, UNCERTAIN: 3, NO_SESSION: 4 };

function finish(outcome: Outcome, socket?: Socket): void {
  if (finished) {
    return;
  }
  finished = true;
  record({ event: 'finish', outcome });
  listener.close();
  // A unit resends a reply sent just before the session closed to its primary server; Karma read
  // CB5636XP's new 0049/0050 from such a resent 45 reply and wrote its own values back.
  setTimeout(() => socket?.end(), 2000);
  setTimeout(() => {
    socket?.destroy();
    process.exit(exitCodes[outcome]);
  }, 3000);
}

const listener = net.createServer((socket) => {
  const connection = `${String(Date.now())}-${String(socket.remotePort)}`;
  record({
    connection,
    event: 'open',
    peer: `${String(socket.remoteAddress)}:${String(socket.remotePort)}`,
  });
  let step: 'wait' | 'read' | 'write' | 'verify' | 'restore' | 'reverify' | 'done' = 'wait';
  let pending = '';
  let timer: NodeJS.Timeout | undefined;
  let wrote = false;
  let retried = false;
  const backup = new Map<string, string>();
  let buffered = Buffer.alloc(0);

  const send = (command: string, fields: string[], next: typeof step): void => {
    step = next;
    pending = String(++reference);
    const frame = serverFrame(command, pending, fields);
    record({ connection, from: 'discocan', frame: frame.subarray(0, -2).toString('latin1') });
    socket.write(frame);
    clearTimeout(timer);
    timer = setTimeout(timeout, 30_000);
  };
  const read = (next: typeof step) => {
    send('45', ['0049', '0050', '0051', '0052'], next);
  };
  const write = (target: typeof to, next: typeof step) => {
    wrote = true;
    send('46', ['0049', target.host, '0050', target.port], next);
  };
  const close = (outcome: Outcome) => {
    step = 'done';
    clearTimeout(timer);
    finish(outcome, socket);
  };
  const restore = (reason: string) => {
    record({ connection, event: 'ALERT', reason });
    write(from, 'restore');
  };
  function timeout(): void {
    record({ connection, event: 'timeout', step });
    if (active !== socket) {
      socket.destroy();
    } else if (step === 'read' && !retried) {
      retried = true;
      read('read');
    } else if (step === 'write' || step === 'restore') {
      read(step === 'write' ? 'verify' : 'reverify');
    } else {
      close(wrote ? 'UNCERTAIN' : 'NOT_MOVED');
    }
  }

  // A unit in a configuration session may wait for the server, so a silent connection gets one
  // harmless read; connections that never answer as the unit are closed without ending the tool.
  const probe = setTimeout(() => {
    if (step === 'wait') {
      read('read');
    }
  }, 5000);
  socket.on('data', (chunk: Buffer) => {
    buffered = Buffer.concat([buffered, chunk]);
    for (;;) {
      // CB5636XP sent E0 00 pairs before its 46 result and then about 1.8 KB/s of them until the
      // session closed, so bytes outside a frame are dropped.
      const start = buffered.indexOf('$');
      if (start !== 0 && buffered.length > 0) {
        record({ connection, event: 'skipped', bytes: start < 0 ? buffered.length : start });
        buffered = start < 0 ? Buffer.alloc(0) : buffered.subarray(start);
      }
      const end = buffered.indexOf('\r\n');
      if (end < 0) {
        break;
      }
      const line = buffered.subarray(0, end);
      buffered = buffered.subarray(end + 2);
      record({ connection, from: 'device', frame: line.toString('latin1') });
      // CB6711TE answered inside compressed $SLC containers while it was driving.
      const inner = inflateContainer(line);
      for (const raw of inner ?? [line]) {
        if (inner) {
          record({ connection, from: 'device-inner', frame: raw.toString('latin1') });
        }
        const frame = deviceFrame(raw);
        if (!frame || step === 'done' || (active !== undefined && active !== socket)) {
          continue;
        }
        active = socket;
        if (frame.command === '45') {
          const confirmation = serverFrame('02', String(++reference), [frame.reference, '01']);
          record({
            connection,
            from: 'discocan',
            frame: confirmation.subarray(0, -2).toString('latin1'),
          });
          socket.write(confirmation);
        }
        const values = new Map<string, string>();
        for (let index = 0; frame.command === '45' && index + 1 < frame.fields.length; index += 2) {
          values.set(String(Number(frame.fields[index])), frame.fields[index + 1] ?? '');
        }
        const holds = (target: typeof to) =>
          values.get('49') === target.host && values.get('50') === target.port;
        const backupKept = ['51', '52'].every(
          (number) => values.get(number) === backup.get(number),
        );
        if (step === 'wait') {
          read('read');
        } else if (frame.command === '45' && step === 'read') {
          record({ connection, event: 'current', values: Object.fromEntries(values) });
          for (const number of ['51', '52']) {
            backup.set(number, values.get(number) ?? '');
          }
          if (holds(from)) {
            write(to, 'write');
          } else if (holds(to)) {
            close('MOVED');
          } else {
            record({ connection, event: 'unexpected primary server, nothing written' });
            close('NOT_MOVED');
          }
        } else if (frame.command === '02' && frame.fields[0] === pending) {
          record({ connection, event: 'set result', step, result: frame.fields.slice(1) });
          if (step === 'write' && frame.fields.slice(1, 4).join(',') !== '20,2,0') {
            restore(`46 answered ${frame.fields.slice(1).join(',')}`);
          } else if (step === 'write' || step === 'restore') {
            read(step === 'write' ? 'verify' : 'reverify');
          }
        } else if (frame.command === '45' && (step === 'verify' || step === 'reverify')) {
          record({ connection, event: 'read back', values: Object.fromEntries(values) });
          if (step === 'verify' && holds(to) && backupKept) {
            close('MOVED');
          } else if (step === 'verify' && !holds(from)) {
            restore('read back differs from both servers or the backup changed');
          } else {
            close(holds(from) ? 'NOT_MOVED' : 'UNCERTAIN');
          }
        }
      }
    }
    if (buffered.length > 16_384) {
      socket.destroy();
    }
  });
  socket.on('error', (error) => {
    record({ connection, event: 'socket error', message: error.message });
  });
  socket.on('close', () => {
    clearTimeout(probe);
    clearTimeout(timer);
    record({ connection, event: 'close', step });
    if (active === socket && step !== 'done') {
      finish(wrote ? 'UNCERTAIN' : 'NOT_MOVED');
    }
  });
});

listener.on('error', (error) => {
  record({ event: 'listener error', message: error.message });
  finish('NO_SESSION');
});
listener.listen(port, '0.0.0.0', () => {
  record({ event: 'listening', port, unit, from, to, waitMinutes });
});
setTimeout(() => {
  finish('NO_SESSION');
}, waitMinutes * 60_000);
