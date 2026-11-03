import { NotFoundException } from '@nestjs/common';
import net from 'node:net';
import type { CaptureRecord } from './capture-record.js';
import { validateCommand } from './command.js';
import {
  DeviceSession,
  type CommandObserver,
  type CommandResult,
  type SessionOptions,
} from './device-session.js';

type ListenerOptions = SessionOptions & { host: string; port: number };

export class DeviceListener {
  readonly server: net.Server;
  private readonly sessions = new Set<DeviceSession>();
  private lastConnection = 0;

  constructor(
    private readonly options: ListenerOptions,
    record: (entry: CaptureRecord, closeReason?: string) => void,
    commands?: CommandObserver,
  ) {
    this.server = net.createServer((device) => {
      const session = new DeviceSession(
        ++this.lastConnection,
        device,
        options,
        record,
        commands,
        () => {
          this.sessions.delete(session);
        },
      );
      this.sessions.add(session);
    });
    this.server.maxConnections = 64;
  }

  listUnits() {
    return [...this.sessions].flatMap((session) => {
      const info = session.info();
      return info ? [info] : [];
    });
  }

  async sendCommand(unitId: string, body: unknown): Promise<CommandResult> {
    const command = validateCommand(body);
    const session = [...this.sessions].find(
      (candidate) => candidate.info()?.unitId.toUpperCase() === unitId.toUpperCase(),
    );
    if (!session) {
      throw new NotFoundException('Unit is not connected');
    }
    return session.sendCommand(command);
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
    for (const session of this.sessions) {
      session.destroy();
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
}
