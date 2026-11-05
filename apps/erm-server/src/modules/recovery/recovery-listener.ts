import net, { type Socket } from 'node:net';
import {
  binaryUnitId,
  buildServerFrame,
  FrameSplitter,
  inflateContainer,
  parseFrame,
} from '../../starlink/index.js';

export interface RecoveryResult {
  unitId: string | null;
  peer: string;
  startedAt: Date;
  finishedAt: Date;
  outcome: 'ALREADY_HOLITA' | 'NEEDS_OPERATOR';
  reason: string;
  primaryHost: string | null;
  primaryPort: string | null;
}

// This listener has no upstream and can emit only a parameter read and its reply confirmation.
export class RecoveryListener {
  readonly server: net.Server;
  private readonly sessions = new Map<Socket, () => void>();
  private reference = 900_000_100;

  constructor(private readonly record: (result: RecoveryResult) => void) {
    this.server = net.createServer((socket) => {
      this.accept(socket);
    });
    this.server.maxConnections = 64;
  }

  private accept(socket: Socket): void {
    const startedAt = new Date();
    const peer = `${socket.remoteAddress ?? 'unknown'}:${String(socket.remotePort ?? 0)}`;
    const splitter = new FrameSplitter();
    let unitId: string | null = null;
    let pending: string | null = null;
    let finished = false;
    let closeTimer: NodeJS.Timeout | undefined;
    let destroyTimer: NodeJS.Timeout | undefined;
    const finish = (
      outcome: RecoveryResult['outcome'],
      reason: string,
      primaryHost: string | null = null,
      primaryPort: string | null = null,
    ) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timeout);
      this.record({
        unitId,
        peer,
        startedAt,
        finishedAt: new Date(),
        outcome,
        reason,
        primaryHost,
        primaryPort,
      });
      // Let the confirmation arrive before closing, so the reply is not resent to Karma.
      closeTimer = setTimeout(() => socket.end(), 2000);
      destroyTimer = setTimeout(() => socket.destroy(), 3000);
    };
    const timeout = setTimeout(() => {
      finish(
        'NEEDS_OPERATOR',
        pending === null
          ? 'Unit did not identify its configuration session.'
          : 'The routing read timed out.',
      );
    }, 30_000);
    this.sessions.set(socket, () => {
      finish('NEEDS_OPERATOR', 'Recovery listener stopped before the read completed.');
      socket.destroy();
    });
    socket.on('data', (chunk: Buffer) => {
      if (finished) {
        return;
      }
      for (const capture of splitter.push(chunk)) {
        if (capture.partial) {
          finish('NEEDS_OPERATOR', 'The configuration session returned an incomplete frame.');
          return;
        }
        const start = capture.raw.indexOf('$');
        if (start < 0) {
          continue;
        }
        const raw = capture.raw.subarray(start);
        const binaryId = binaryUnitId(raw);
        for (const inner of inflateContainer(raw) ?? [raw]) {
          const frame = parseFrame(inner);
          if (frame?.origin !== 'SLU' || frame.checksum !== 'ok') {
            continue;
          }
          if (unitId !== null && unitId !== frame.unitId) {
            finish('NEEDS_OPERATOR', 'The configuration session changed unit identity.');
            return;
          }
          unitId = frame.unitId;
          if (frame.command === '45') {
            socket.write(
              buildServerFrame(unitId, '02', this.nextReference(), [frame.reference, '01']),
            );
          }
          if (pending === null) {
            pending = this.nextReference();
            socket.write(buildServerFrame(unitId, '45', pending, ['0049', '0050']));
          } else if (frame.command === '45') {
            const values = new Map<string, string>();
            for (let index = 0; index + 1 < frame.fields.length; index += 2) {
              const parameter = frame.fields[index]?.toString('latin1') ?? '';
              const value =
                frame.fields[index + 1]?.toString('latin1').replace(/^"(.*)"$/, '$1') ?? '';
              values.set(String(Number(parameter)), value);
            }
            const primaryHost = values.get('49') ?? null;
            const primaryPort = values.get('50') ?? null;
            const alreadyHolita = primaryHost === '65.108.137.165' && primaryPort === '11500';
            finish(
              alreadyHolita ? 'ALREADY_HOLITA' : 'NEEDS_OPERATOR',
              alreadyHolita
                ? 'Primary routing already points to holita; nothing was written.'
                : 'Primary routing differs from holita or the routing read was incomplete; nothing was written.',
              primaryHost,
              primaryPort,
            );
            return;
          } else if (
            frame.command === '02' &&
            frame.fields[0]?.toString('latin1') === pending &&
            frame.fields[1]?.toString('latin1') !== '01'
          ) {
            finish(
              'NEEDS_OPERATOR',
              `The unit rejected the routing read (${frame.fields
                .slice(1)
                .map((field) => field.toString('latin1'))
                .join(',')}).`,
            );
            return;
          }
        }
        if (unitId === null && binaryId !== undefined) {
          unitId = binaryId;
          pending = this.nextReference();
          socket.write(buildServerFrame(unitId, '45', pending, ['0049', '0050']));
        }
      }
    });
    socket.on('error', () => {
      finish('NEEDS_OPERATOR', 'The configuration connection failed.');
    });
    socket.on('close', () => {
      finish('NEEDS_OPERATOR', 'The unit disconnected before the routing read completed.');
      clearTimeout(closeTimer);
      clearTimeout(destroyTimer);
      this.sessions.delete(socket);
    });
  }

  private nextReference(): string {
    return String(++this.reference);
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(11510, '0.0.0.0', () => {
        this.server.off('error', reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    const closed = new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    for (const stop of this.sessions.values()) {
      stop();
    }
    await closed;
  }
}
