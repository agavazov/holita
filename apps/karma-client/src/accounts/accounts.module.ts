import { Module } from '@nestjs/common';
import { CarsModule } from '../cars/cars.module.js';
import { AccountsResolver } from './accounts.resolver.js';
import { AccountsService } from './accounts.service.js';

@Module({ imports: [CarsModule], providers: [AccountsResolver, AccountsService] })
export class AccountsModule {}
