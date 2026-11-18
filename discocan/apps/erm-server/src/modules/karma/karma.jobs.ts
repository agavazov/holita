import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ermRole } from '../../role.js';
import { karmaEnabled } from './karma.config.js';
import { KarmaService } from './karma.service.js';

@Injectable()
export class KarmaJobs {
  constructor(private readonly karma: KarmaService) {}

  // A pass can outlast the interval while Karma is slow; ticks during a running pass are skipped.
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'karma-routing', waitForCompletion: true })
  async routing(): Promise<void> {
    if (ermRole() === 'api' && karmaEnabled()) {
      await this.karma.routeUnits(new Date());
    }
  }
}
