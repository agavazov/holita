import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { InternalPlatformController } from './internal-platform.controller.js';
import { PlatformRepository } from './platform.repository.js';
import { PlatformResolver } from './platform.resolver.js';
import { PlatformService } from './platform.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [InternalPlatformController],
  providers: [PlatformRepository, PlatformResolver, PlatformService],
})
export class PlatformModule {}
