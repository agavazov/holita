import { Module } from '@nestjs/common';
import { CoreClient } from '../core/core.client.js';
import { PrismaService } from '../database/prisma.service.js';
import { ProductsRepository } from './products.repository.js';
import { ProductsResolver } from './products.resolver.js';
import { ProductsService } from './products.service.js';

@Module({
  providers: [PrismaService, CoreClient, ProductsRepository, ProductsService, ProductsResolver],
})
export class ProductsModule {}
