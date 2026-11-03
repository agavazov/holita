import { Module } from '@nestjs/common';
import { ErmTelemetryClient } from './erm-telemetry.client.js';

@Module({ providers: [ErmTelemetryClient], exports: [ErmTelemetryClient] })
export class ErmTelemetryClientModule {}
