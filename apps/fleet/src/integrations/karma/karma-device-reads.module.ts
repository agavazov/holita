import { Module } from '@nestjs/common';
import { KarmaDeviceReadsClient } from './karma-device-reads.client.js';

@Module({ providers: [KarmaDeviceReadsClient], exports: [KarmaDeviceReadsClient] })
export class KarmaDeviceReadsModule {}
