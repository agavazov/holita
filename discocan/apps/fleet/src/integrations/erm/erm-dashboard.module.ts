import { Module } from '@nestjs/common';
import { ErmDashboardClient } from './erm-dashboard.client.js';

@Module({ providers: [ErmDashboardClient], exports: [ErmDashboardClient] })
export class ErmDashboardClientModule {}
