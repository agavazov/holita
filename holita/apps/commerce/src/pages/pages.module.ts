import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { PagesRepository } from './pages.repository.js';
import { PagesService } from './pages.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [PagesRepository, PagesService],
  exports: [PagesService],
})
export class PagesModule {}
