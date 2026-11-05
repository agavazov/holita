import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { RecoveryListener } from './recovery-listener.js';
import { RecoveryRepository } from './recovery.repository.js';

@Injectable()
export class RecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecoveryService.name);
  private readonly pending = new Set<Promise<unknown>>();
  private readonly listener: RecoveryListener;

  constructor(repository: RecoveryRepository) {
    this.listener = new RecoveryListener((result) => {
      const write = repository.record(result).catch(() => {
        this.logger.error('Recovery outcome could not be stored; operator review is required.');
      });
      this.pending.add(write);
      void write.then(() => this.pending.delete(write));
    });
    this.listener.server.on('error', () => {
      this.logger.error('Recovery listener failed.');
    });
  }

  async onModuleInit(): Promise<void> {
    await this.listener.start();
    this.logger.log('Read-only recovery listener on 0.0.0.0:11510.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.listener.stop();
    await Promise.all(this.pending);
  }
}
