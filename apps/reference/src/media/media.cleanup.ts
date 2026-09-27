import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { MediaService } from './media.service.js';

@Injectable()
export class MediaCleanup implements OnApplicationBootstrap, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private work: Promise<void> | undefined;
  private readonly logger = new Logger(MediaCleanup.name);
  constructor(private readonly media: MediaService) {}
  onApplicationBootstrap() {
    this.start();
    this.timer = setInterval(() => {
      this.start();
    }, 60_000);
    this.timer.unref();
  }
  private start() {
    if (this.work) return;
    this.work = this.media
      .cleanup()
      .catch(() => {
        this.logger.warn('Media cleanup unavailable; retrying on the next interval.');
      })
      .finally(() => {
        this.work = undefined;
      });
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.work;
  }
}
