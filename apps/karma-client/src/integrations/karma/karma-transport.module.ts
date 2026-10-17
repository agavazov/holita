import { Module } from '@nestjs/common';
import { KarmaTransport } from './karma-transport.js';

@Module({ providers: [KarmaTransport], exports: [KarmaTransport] })
export class KarmaTransportModule {}
