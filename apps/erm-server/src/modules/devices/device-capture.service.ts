import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, open } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { CaptureRecord, CommandOutcome, SentCommand } from './capture-record.js';
import { deviceConfig } from './config.js';
import { DevicesRepository } from './devices.repository.js';

type ConnectionCapture = { id: string; unitSeen: boolean; queue: Promise<void> };

@Injectable()
export class DeviceCaptureService {
  readonly config = deviceConfig();
  private readonly logger = new Logger(DeviceCaptureService.name);
  private readonly connections = new Map<number, ConnectionCapture>();
  private readonly pending = new Set<Promise<void>>();
  private captureQueue = Promise.resolve();

  constructor(private readonly repository: DevicesRepository) {}

  async initialize(): Promise<void> {
    await mkdir(this.config.captureDirectory, { recursive: true, mode: 0o700 });
    await chmod(this.config.captureDirectory, 0o700);
    const closed = await this.repository.closeLeftOpen();
    this.logger.log(`Closed ${String(closed)} connections left open by a previous process.`);
  }

  record(entry: CaptureRecord, closeReason?: string): void {
    const at = new Date();
    const timestamp = at.toISOString();
    const line = `${JSON.stringify({ at: timestamp, ...entry })}\n`;
    this.captureQueue = this.captureQueue
      .then(async () => {
        const file = await open(
          resolve(this.config.captureDirectory, `${timestamp.slice(0, 10)}.jsonl`),
          'a',
          0o600,
        );
        try {
          await file.chmod(0o600);
          await file.writeFile(line);
        } finally {
          await file.close();
        }
      })
      .catch(() => {
        this.logger.error('JSON Lines capture failed; forwarding continues.');
      });

    if ('event' in entry && entry.event === 'open') {
      const state: ConnectionCapture = {
        id: randomUUID(),
        unitSeen: false,
        queue: Promise.resolve(),
      };
      this.connections.set(entry.connection, state);
      this.enqueue(state, () =>
        this.repository.open(state.id, entry.peer, this.config.upstream, at),
      );
      return;
    }
    const state = this.connections.get(entry.connection);
    if (!state) {
      return;
    }
    if ('from' in entry) {
      const firstDeviceUnit =
        entry.from === 'device' && entry.unit !== undefined && !state.unitSeen;
      if (firstDeviceUnit) {
        state.unitSeen = true;
      }
      this.enqueue(state, () =>
        this.repository.frame(state.id, at, entry, firstDeviceUnit, this.config.eventStructure),
      );
    } else if (entry.event === 'forwarded') {
      this.enqueue(state, () => this.repository.forwarded(state.id, at));
    } else if (entry.event === 'upstream-close') {
      this.enqueue(state, () => this.repository.upstreamClose(state.id, at, entry.reason));
    } else if (entry.event === 'close') {
      this.enqueue(state, () =>
        this.repository.close(
          state.id,
          at,
          closeReason ?? 'closed',
          entry.deviceBytes,
          entry.serverBytes,
        ),
      );
      this.connections.delete(entry.connection);
    }
  }

  commandSent(connection: number, command: SentCommand): void {
    const state = this.connections.get(connection);
    if (state) {
      this.enqueue(state, () => this.repository.commandSent(state.id, command));
    }
  }

  commandFinished(connection: number, id: string, outcome: CommandOutcome): void {
    const state = this.connections.get(connection);
    if (state) {
      this.enqueue(state, () => this.repository.commandFinished(id, outcome));
    }
  }

  async drain(): Promise<void> {
    await Promise.all([this.captureQueue, ...this.pending]);
  }

  private enqueue(state: ConnectionCapture, write: () => Promise<void>): void {
    state.queue = state.queue.then(write).catch((error: unknown) => {
      this.logger.error(
        `Database capture failed (${error instanceof Error ? error.name : 'unknown error'}); forwarding continues.`,
      );
    });
    const pending = state.queue;
    this.pending.add(pending);
    void pending.then(() => this.pending.delete(pending));
  }
}
