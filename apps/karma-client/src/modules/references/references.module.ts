import { Module } from '@nestjs/common';
import { KarmaTransportModule } from '../../integrations/karma/karma-transport.module.js';
import { ReferencesResolver } from './references.resolver.js';
import { ReferencesService } from './references.service.js';

@Module({ imports: [KarmaTransportModule], providers: [ReferencesResolver, ReferencesService] })
export class ReferencesModule {}
