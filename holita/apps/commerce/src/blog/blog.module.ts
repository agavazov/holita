import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module.js';
import { BlogRepository } from './blog.repository.js';
import { BlogService } from './blog.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [BlogRepository, BlogService],
  exports: [BlogService],
})
export class BlogModule {}
