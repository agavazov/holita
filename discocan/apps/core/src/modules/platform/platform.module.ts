import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { PlatformRepository } from './platform.repository.js';
import { PlatformResolver } from './platform.resolver.js';
import { PlatformService } from './platform.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [PlatformRepository, PlatformResolver, PlatformService],
})
export class PlatformModule {}
