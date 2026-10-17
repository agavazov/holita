import { Module } from '@nestjs/common';
import { KarmaTransportModule } from '../../integrations/karma/karma-transport.module.js';
import { AccountsResolver } from './accounts.resolver.js';
import { AccountsService } from './accounts.service.js';

@Module({ imports: [KarmaTransportModule], providers: [AccountsResolver, AccountsService] })
export class AccountsModule {}
