import net, { type Socket } from 'node:net';
import { FrameSplitter, parseFrame } from '../../starlink/index.js';
import type { CaptureRecord } from './capture-record.js';

type ListenerOptions = {
  host: string;
  port: number;
  upstream: string;
  upstreamHost: string;
  upstreamPort: number;
};

export class DeviceListener {
  readonly server: net.Server;
  private readonly sockets = new Set<Socket>();
  private lastConnection = 0;

  constructor(
    private readonly options: ListenerOptions,
    private readonly record: (entry: CaptureRecord, closeReason?: string) => void,
  ) {
    this.server = net.createServer((device) => {
      this.accept(device);
    });
    this.server.maxConnections = 64;
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.options.port, this.options.host, () => {
        this.server.off('error', reject);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private accept(device: Socket): void {
    this.sockets.add(device);
    const connection = ++this.lastConnection;
    const opened = Date.now();
    const peer = `${device.remoteAddress ?? '?'}:${String(device.remotePort ?? '?')}`;
    const deviceFrames = new FrameSplitter();
    const serverFrames = new FrameSplitter();
    let target: Socket | undefined;
    let connectTimer: NodeJS.Timeout | undefined;
    let closeReason = 'device closed';
    const capture = (from: 'device' | 'server', raw: Buffer, partial: boolean) => {
      const parsed = parseFrame(raw);
      this.record({
        connection,
        from,
        ...(parsed && {
          unit: parsed.unitId,
          command: parsed.command,
          reference: parsed.reference,
          checksum: parsed.checksum,
        }),
        ...(partial && { partial: true }),
        frame: raw.toString('latin1'),
      });
    };
    this.record({ connection, event: 'open', peer });
    const firstByteTimer = setTimeout(() => {
      closeReason = 'no data';
      this.record({ connection, event: 'rejected', reason: closeReason });
      device.destroy();
    }, 60_000);
    device.setKeepAlive(true, 60_000);
    device.on('error', (error) => {
      closeReason = `device error: ${error.message}`;
    });
    device.on('close', () => {
      clearTimeout(firstByteTimer);
      clearTimeout(connectTimer);
      target?.destroy();
      this.sockets.delete(device);
      for (const frame of deviceFrames.flush()) {
        capture('device', frame.raw, frame.partial);
      }
      for (const frame of serverFrames.flush()) {
        capture('server', frame.raw, frame.partial);
      }
      this.record(
        {
          connection,
          event: 'close',
          seconds: Math.round((Date.now() - opened) / 1000),
          deviceBytes: device.bytesRead,
          serverBytes: device.bytesWritten,
        },
        closeReason,
      );
    });

    device.once('data', (head: Buffer) => {
      clearTimeout(firstByteTimer);
      device.pause();
      if (head[0] !== 0x24) {
        closeReason = 'not StarLink';
        this.record({
          connection,
          event: 'rejected',
          reason: closeReason,
          head: head.subarray(0, 64).toString('hex'),
        });
        device.destroy();
        return;
      }
      const link = net.connect({
        host: this.options.upstreamHost,
        port: this.options.upstreamPort,
      });
      target = link;
      connectTimer = setTimeout(() => link.destroy(new Error('connect timeout')), 10_000);
      link.on('error', (error) => {
        closeReason = `upstream error: ${error.message}`;
        this.record({ connection, event: 'upstream-error', message: error.message });
      });
      link.on('close', () => {
        clearTimeout(connectTimer);
        if (closeReason === 'device closed') {
          closeReason = 'upstream closed';
        }
        device.destroy();
      });
      link.once('connect', () => {
        clearTimeout(connectTimer);
        link.setKeepAlive(true, 60_000);
        this.record({ connection, event: 'forwarded', upstream: this.options.upstream });
        device.on('data', (chunk: Buffer) => {
          for (const frame of deviceFrames.push(chunk)) {
            capture('device', frame.raw, frame.partial);
          }
        });
        link.on('data', (chunk: Buffer) => {
          for (const frame of serverFrames.push(chunk)) {
            capture('server', frame.raw, frame.partial);
          }
        });
        device.unshift(head);
        device.pipe(link);
        link.pipe(device);
      });
    });
  }
}
