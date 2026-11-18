import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import net, { type Socket } from 'node:net';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { inflateContainer } from './starlink-container.mjs';

// Runs a script of StarLink commands in one configuration-server session (command 98 queued through
// Karma, pointing at --port) and records every frame. Each script line is "<command>,<fields...>";
// lines starting with "//" are comments. Reads are always allowed. Parameter writes (04/46), eData
// messages (30) and tracking (22) need --allow-writes. Routing 0049-0054 and the gateway's protected
// lock, SIM and authentication parameters are never written. Replies to the script are confirmed, so the unit does not
// resend them to its primary server; events are not, so the unit still delivers them to that server.
// Frames inside $SLC containers are handled like plain ones. Frames may hold secrets, so they go only
// to the capture file.
const { values: options } = parseArgs({
  options: {
    unit: { type: 'string' },
    script: { type: 'string' },
    port: { type: 'string', default: '11501' },
    'wait-minutes': { type: 'string', default: '90' },
    'reply-seconds': { type: 'string', default: '12' },
    'allow-writes': { type: 'boolean', default: false },
  },
});
const unit = options.unit ?? '';
const port = Number(options.port);
const waitMinutes = Number(options['wait-minutes']);
const replySeconds = Number(options['reply-seconds']);
if (!/^([0-9A-F]{6}|\d{15})$/.test(unit) || !options.script) {
  throw new Error(
    'Usage: --unit <6-hex or 15-digit ID> --script <file> [--port 11501] [--allow-writes]',
  );
}
if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535 ||
  !(waitMinutes > 0) ||
  !(replySeconds > 0)
) {
  throw new Error('--port must be 1-65535 and --wait-minutes and --reply-seconds positive');
}

const readCommands = new Set([
  '03',
  '05',
  '07',
  '08',
  '10',
  '12',
  '16',
  '19',
  '23',
  '27',
  '36',
  '43',
  '45',
  '48',
  '49',
  '51',
  '53',
  '56',
  '60',
  '61',
  '64',
]);
const writeCommands = new Set(['04', '22', '30', '46']);
const lockedParameters = new Set([49, 50, 51, 52, 53, 54, 59, 60, 61, 187, 524, 525, 593]);
const steps = readFileSync(options.script, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('//'))
  .map((line) => {
    const [command = '', ...fields] = line.split(',');
    const writes = writeCommands.has(command) && options['allow-writes'];
    // "56,1" erases the accessory list, so 56 only reads it.
    const locked =
      ((command === '04' || command === '46') &&
        fields.some((field, index) => index % 2 === 0 && lockedParameters.has(Number(field)))) ||
      (command === '56' && fields.length > 0);
    if ((!readCommands.has(command) && !writes) || locked) {
      throw new Error(`Command not allowed: ${line}`);
    }
    return { command, fields };
  });
const captureDirectory = resolve(process.env.ERM_RELAY_CAPTURE_DIR ?? '.references/erm-relay');
mkdirSync(captureDirectory, { recursive: true, mode: 0o700 });

function record(entry: Record<string, unknown>): void {
  appendFileSync(
    resolve(captureDirectory, `lab-session-${new Date().toISOString().slice(0, 10)}.jsonl`),
    `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
    { mode: 0o600 },
  );
}

// G2 checksum and G9 byte replacement, as in route-unit.mts.
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
  const [, command, frameReference, ...fields] = text.split(',');
  return command && frameReference ? { command, reference: frameReference, fields } : undefined;
}

let reference = 900_100_000;
let active: Socket | undefined;
let finished = false;
type Outcome = 'DONE' | 'INCOMPLETE' | 'NO_SESSION';
const exitCodes: Record<Outcome, number> = { DONE: 0, INCOMPLETE: 3, NO_SESSION: 4 };

function finish(outcome: Outcome, socket?: Socket): void {
  if (finished) {
    return;
  }
  finished = true;
  record({ event: 'finish', outcome });
  console.log(`${new Date().toISOString()} finish ${outcome}`);
  listener.close();
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
  let buffered = Buffer.alloc(0);
  let index = -1;
  let pending: { reference: string; command: string; sentAt: number } | undefined;
  let timer: NodeJS.Timeout | undefined;

  const next = (): void => {
    clearTimeout(timer);
    index++;
    const step = steps[index];
    if (!step) {
      pending = undefined;
      finish('DONE', socket);
      return;
    }
    pending = { reference: String(++reference), command: step.command, sentAt: Date.now() };
    const frame = serverFrame(step.command, pending.reference, step.fields);
    record({
      connection,
      step: index,
      from: 'discocan',
      frame: frame.subarray(0, -2).toString('latin1'),
    });
    socket.write(frame);
    timer = setTimeout(() => {
      record({ connection, step: index, event: 'timeout' });
      console.log(`step ${String(index)} ${step.command}: no reply in ${String(replySeconds)} s`);
      next();
    }, replySeconds * 1000);
  };
  // A unit in a configuration session may wait for the server, so a silent connection gets one
  // harmless read; the script starts only when the unit answers, and other connections are closed.
  const probe = setTimeout(() => {
    if (index < 0) {
      const frame = serverFrame('48', String(++reference), ['#VER#']);
      record({ connection, event: 'probe', frame: frame.subarray(0, -2).toString('latin1') });
      socket.write(frame);
      timer = setTimeout(() => {
        if (active !== socket) {
          socket.destroy();
        }
      }, 30_000);
    }
  }, 5000);

  socket.on('data', (chunk: Buffer) => {
    buffered = Buffer.concat([buffered, chunk]);
    for (;;) {
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
      const inner = inflateContainer(line);
      for (const raw of inner ?? [line]) {
        if (inner) {
          record({ connection, from: 'device-inner', frame: raw.toString('latin1') });
        }
        const frame = deviceFrame(raw);
        if (!frame || finished || (active !== undefined && active !== socket)) {
          continue;
        }
        if (active === undefined) {
          active = socket;
          clearTimeout(probe);
        }
        const answers =
          pending &&
          ((frame.command === '02' && frame.fields[0] === pending.reference) ||
            frame.command === pending.command);
        if (frame.command !== '02' && (answers || (index < 0 && frame.command === '48'))) {
          const confirmation = serverFrame('02', String(++reference), [frame.reference, '01']);
          record({
            connection,
            from: 'discocan',
            frame: confirmation.subarray(0, -2).toString('latin1'),
          });
          socket.write(confirmation);
        }
        if (index < 0) {
          next();
        } else if (pending && answers) {
          const result = frame.command === '02' ? ` result ${frame.fields.slice(1).join(',')}` : '';
          console.log(
            `step ${String(index)} ${pending.command}: ${frame.command} after ${String(Date.now() - pending.sentAt)} ms${result}`,
          );
          next();
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
    record({ connection, event: 'close', step: index });
    if (active === socket && !finished) {
      console.log(`${new Date().toISOString()} session closed at step ${String(index)}`);
      finish('INCOMPLETE');
    } else if (active === undefined) {
      record({ connection, event: 'not the unit' });
    }
  });
});

listener.on('error', (error) => {
  record({ event: 'listener error', message: error.message });
  finish('NO_SESSION');
});
listener.listen(port, '0.0.0.0', () => {
  record({ event: 'listening', port, unit, steps: steps.length });
  console.log(
    `${new Date().toISOString()} listening on ${String(port)} for ${unit}, ${String(steps.length)} steps`,
  );
});
setTimeout(() => {
  finish('NO_SESSION');
}, waitMinutes * 60_000);
