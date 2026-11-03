import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import net, { type Socket } from 'node:net';
import { Transform, Writable } from 'node:stream';
import {
  buildServerFrame,
  FrameSplitter,
  parseFrame,
  type CapturedFrame,
  type ParsedFrame,
} from '../../starlink/index.js';
import type { CaptureRecord, SentCommand, CommandOutcome } from './capture-record.js';
import { matchesParameterResponse, type DeviceCommand } from './command.js';

export type SessionOptions = {
  upstream: string;
  upstreamHost: string;
  upstreamPort: number;
  primaryUnits?: ReadonlySet<string>;
  ackCommands?: ReadonlySet<string>;
};

export type CommandObserver = {
  sent: (connection: number, command: SentCommand) => void;
  finished: (connection: number, id: string, outcome: CommandOutcome) => void;
};

export type CommandResult = {
  id: string;
  reference: string;
  status: 'answered' | 'timeout' | 'failed';
  resultCode: string | null;
  fields: string[];
};

type PendingCommand = {
  id: string;
  reference: string;
  input: DeviceCommand;
  timer: NodeJS.Timeout;
  resolve: (result: CommandResult) => void;
};

let reference = 900_000_000;
function nextReference(): string {
  reference = reference === 999_999_999 ? 900_000_001 : reference + 1;
  return String(reference);
}

function wire(frame: CapturedFrame): Buffer {
  return frame.partial && !frame.terminated
    ? frame.raw
    : Buffer.concat([frame.raw, Buffer.from('\r\n')]);
}

export class DeviceSession {
  private readonly openedAt = new Date();
  private readonly peer: string;
  private unitId: string | undefined;
  private mode: 'mirror' | 'primary' | undefined;
  private lastFrameAt: Date | undefined;
  private readonly initialFrames = new FrameSplitter();
  private readonly deviceFrames = new FrameSplitter();
  private readonly serverFrames = new FrameSplitter();
  private readonly initial: Buffer[] = [];
  private readonly confirmed = new Set<string>();
  private readonly owned = new Set<string>();
  private serverPartial = false;
  private readonly deferred = new Array<Buffer>();
  private target: Socket | undefined;
  private ready = false;
  private pending: PendingCommand | undefined;
  private connectTimer: NodeJS.Timeout | undefined;
  private closeReason = 'device closed';
  private readonly firstFrameTimer: NodeJS.Timeout;
  private readonly writer: Writable;

  constructor(
    private readonly connection: number,
    private readonly device: Socket,
    private readonly options: SessionOptions,
    private readonly record: (entry: CaptureRecord, closeReason?: string) => void,
    private readonly commands: CommandObserver | undefined,
    private readonly onClose: () => void,
  ) {
    this.peer = `${device.remoteAddress ?? '?'}:${String(device.remotePort ?? '?')}`;
    this.record({ connection, event: 'open', peer: this.peer });
    this.writer = new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        device.write(chunk, callback);
      },
    });
    this.writer.on('error', () => {
      device.destroy();
    });
    this.writer.on('drain', () => {
      this.target?.resume();
    });
    this.firstFrameTimer = setTimeout(() => {
      this.reject('no complete frame');
    }, 60_000);
    device.setKeepAlive(true, 60_000);
    device.on('error', (error) => {
      this.closeReason = `device error: ${error.message}`;
    });
    device.on('close', () => {
      this.close();
    });
    device.on('data', this.identify);
  }

  info() {
    return this.unitId !== undefined && this.mode !== undefined && this.lastFrameAt !== undefined
      ? {
          unitId: this.unitId,
          mode: this.mode,
          peer: this.peer,
          connectedSince: this.openedAt.toISOString(),
          lastFrameAt: this.lastFrameAt.toISOString(),
        }
      : undefined;
  }

  sendCommand(input: DeviceCommand): Promise<CommandResult> {
    const unitId = this.unitId;
    if (unitId === undefined || this.mode !== 'primary') {
      throw new ConflictException('Unit is not connected in primary mode');
    }
    if (!this.ready || this.pending) {
      throw new ConflictException('Upstream is not ready or a command is already pending');
    }
    const id = randomUUID();
    const ownReference = nextReference();
    this.owned.add(ownReference);
    const result = new Promise<CommandResult>((resolve) => {
      const timer = setTimeout(() => {
        this.finish('timeout');
      }, 30_000);
      this.pending = { id, reference: ownReference, input, timer, resolve };
    });
    this.commands?.sent(this.connection, {
      id,
      unitId,
      reference: ownReference,
      ...input,
      sentAt: new Date(),
    });
    this.send(buildServerFrame(unitId, input.command, ownReference, input.fields));
    return result;
  }

  destroy(): void {
    this.device.destroy();
  }

  private readonly identify = (chunk: Buffer): void => {
    if (this.initial.length === 0 && chunk[0] !== 0x24) {
      this.reject('not StarLink', chunk.subarray(0, 64).toString('hex'));
      return;
    }
    this.initial.push(chunk);
    const frames = this.initialFrames.push(chunk);
    const first = frames[0];
    if (!first) {
      return;
    }
    const parsed = first.partial ? undefined : parseFrame(first.raw);
    clearTimeout(this.firstFrameTimer);
    // An unidentified first frame after the "$" header is still mirrored, so a parser gap never
    // cuts a device off from the upstream server.
    this.unitId = parsed?.origin === 'SLU' ? parsed.unitId : undefined;
    this.mode =
      this.unitId !== undefined && this.options.primaryUnits?.has(this.unitId.toUpperCase())
        ? 'primary'
        : 'mirror';
    this.lastFrameAt = new Date();
    this.device.pause();
    this.device.off('data', this.identify);
    const buffered = Buffer.concat(this.initial);
    this.initial.length = 0;
    this.connect(buffered);
  };

  private connect(buffered: Buffer): void {
    const link = net.connect({ host: this.options.upstreamHost, port: this.options.upstreamPort });
    this.target = link;
    this.connectTimer = setTimeout(() => link.destroy(new Error('connect timeout')), 10_000);
    link.on('error', (error) => {
      this.closeReason = `upstream error: ${error.message}`;
      this.record({ connection: this.connection, event: 'upstream-error', message: error.message });
    });
    link.on('close', () => {
      if (this.closeReason === 'device closed') {
        this.closeReason = 'upstream closed';
      }
      if (this.mode === 'primary') {
        for (const frame of this.serverFrames.flush()) {
          this.capture('server', frame);
          this.writeKarma(frame);
        }
        this.writer.end(() => {
          this.device.destroy();
        });
      } else {
        this.device.destroy();
      }
    });
    link.once('connect', () => {
      clearTimeout(this.connectTimer);
      this.ready = true;
      link.setKeepAlive(true, 60_000);
      this.record({
        connection: this.connection,
        event: 'forwarded',
        upstream: this.options.upstream,
      });
    });
    if (this.mode === 'mirror') {
      this.device.on('data', (chunk: Buffer) => {
        for (const frame of this.deviceFrames.push(chunk)) {
          this.capture('device', frame);
        }
      });
      link.on('data', (chunk: Buffer) => {
        for (const frame of this.serverFrames.push(chunk)) {
          this.capture('server', frame);
        }
      });
      this.device.unshift(buffered);
      this.device.pipe(link);
      link.pipe(this.device);
    } else {
      const toKarma = this.flow();
      toKarma.on('error', () => this.device.destroy());
      link.on('data', (chunk: Buffer) => {
        for (const frame of this.serverFrames.push(chunk)) {
          const parsed = this.capture('server', frame);
          if (!this.dropKarmaAck(frame, parsed)) {
            this.writeKarma(frame);
          }
        }
      });
      this.device.unshift(buffered);
      this.device.pipe(toKarma).pipe(link);
    }
  }

  private flow(): Transform {
    const splitter = this.deviceFrames;
    const flow = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        for (const frame of splitter.push(chunk)) {
          const parsed = this.capture('device', frame);
          if (!this.deviceFrame(frame, parsed)) {
            flow.push(wire(frame));
          }
        }
        callback();
      },
      flush: (callback) => {
        for (const frame of splitter.flush()) {
          this.capture('device', frame);
          flow.push(wire(frame));
        }
        callback();
      },
    });
    return flow;
  }

  private deviceFrame(frame: CapturedFrame, parsed: ParsedFrame | undefined): boolean {
    if (frame.partial || parsed?.origin !== 'SLU') {
      return false;
    }
    if (
      parsed.checksum === 'ok' &&
      (this.options.ackCommands ?? new Set(['06'])).has(parsed.command)
    ) {
      this.rememberConfirmed(parsed.reference);
      this.send(buildServerFrame(parsed.unitId, '02', nextReference(), [parsed.reference, '01']));
    }
    const original = parsed.fields[0]?.toString('latin1');
    if (parsed.command === '02' && original !== undefined && this.owned.has(original)) {
      if (
        this.pending?.reference === original &&
        this.pending.input.command !== '03' &&
        this.pending.input.command !== '45'
      ) {
        this.finish('answered', frame.raw, parsed);
      }
      return true;
    }
    if (this.pending && matchesParameterResponse(this.pending.input, parsed)) {
      this.finish('answered', frame.raw, parsed);
    }
    return false;
  }

  private dropKarmaAck(frame: CapturedFrame, parsed: ParsedFrame | undefined): boolean {
    return (
      !frame.partial &&
      parsed?.origin === 'SRV' &&
      parsed.command === '02' &&
      this.confirmed.has(parsed.fields[0]?.toString('latin1') ?? '')
    );
  }

  private send(raw: Buffer): void {
    this.capture('holita', { raw: raw.subarray(0, -2), partial: false });
    if (this.serverPartial) {
      this.deferred.push(raw);
    } else {
      this.writer.write(raw);
    }
  }

  private writeKarma(frame: CapturedFrame): void {
    this.serverPartial = frame.partial && !frame.terminated;
    if (!this.writer.write(wire(frame))) {
      this.target?.pause();
    }
    if (!this.serverPartial) {
      for (const raw of this.deferred.splice(0)) {
        this.writer.write(raw);
      }
    }
  }

  private capture(
    from: 'device' | 'server' | 'holita',
    frame: CapturedFrame,
  ): ParsedFrame | undefined {
    const parsed = parseFrame(frame.raw);
    if (from === 'device' && !frame.partial) {
      this.lastFrameAt = new Date();
    }
    this.record({
      connection: this.connection,
      from,
      ...(parsed && {
        unit: parsed.unitId,
        command: parsed.command,
        reference: parsed.reference,
        checksum: parsed.checksum,
      }),
      ...(frame.partial && { partial: true }),
      frame: frame.raw.toString('latin1'),
    });
    return parsed;
  }

  private finish(status: CommandResult['status'], raw?: Buffer, frame?: ParsedFrame): void {
    const pending = this.pending;
    if (!pending) {
      return;
    }
    clearTimeout(pending.timer);
    this.pending = undefined;
    const fields = frame?.fields.map((field) => field.toString('latin1')) ?? [];
    const resultCode = frame?.command === '02' ? (fields[1] ?? null) : null;
    this.commands?.finished(this.connection, pending.id, {
      status,
      ...(status === 'answered' && { answeredAt: new Date() }),
      ...(resultCode !== null && { resultCode }),
      ...(raw !== undefined && { response: raw }),
    });
    pending.resolve({
      id: pending.id,
      reference: pending.reference,
      status,
      resultCode,
      fields: frame?.command === '02' ? fields.slice(2) : fields,
    });
  }

  private rememberConfirmed(value: string): void {
    this.confirmed.add(value);
    if (this.confirmed.size > 1024) {
      const first = this.confirmed.values().next().value;
      if (first !== undefined) {
        this.confirmed.delete(first);
      }
    }
  }

  private reject(reason: string, head?: string): void {
    this.closeReason = reason;
    this.record({
      connection: this.connection,
      event: 'rejected',
      reason,
      ...(head !== undefined && { head }),
    });
    this.device.destroy();
  }

  private close(): void {
    clearTimeout(this.firstFrameTimer);
    clearTimeout(this.connectTimer);
    this.target?.destroy();
    this.writer.destroy();
    this.finish('failed');
    for (const frame of (this.mode === undefined
      ? this.initialFrames
      : this.deviceFrames
    ).flush()) {
      this.capture('device', frame);
    }
    for (const frame of this.serverFrames.flush()) {
      this.capture('server', frame);
    }
    this.record(
      {
        connection: this.connection,
        event: 'close',
        seconds: Math.round((Date.now() - this.openedAt.getTime()) / 1000),
        deviceBytes: this.device.bytesRead,
        serverBytes: this.device.bytesWritten,
      },
      this.closeReason,
    );
    this.onClose();
  }
}
