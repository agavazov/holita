import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { RecoveryRepository } from './recovery.repository.js';
import { RecoveryService } from './recovery.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [RecoveryRepository, RecoveryService],
})
export class RecoveryModule {}
