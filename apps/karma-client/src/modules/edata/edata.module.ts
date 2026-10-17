import { Module } from '@nestjs/common';
import { KarmaTransportModule } from '../../integrations/karma/karma-transport.module.js';
import { EdataResolver } from './edata.resolver.js';
import { EdataService } from './edata.service.js';

@Module({ imports: [KarmaTransportModule], providers: [EdataResolver, EdataService] })
export class EdataModule {}
