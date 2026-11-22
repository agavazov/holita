import { Module } from '@nestjs/common';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { CommerceResolver } from './commerce.resolver.js';
import { DatabaseModule } from './database.module.js';
import { StorefrontResolver } from './storefront.resolver.js';
import { StorefrontService } from './storefront.service.js';
import { ShopperRepository } from './shopper.repository.js';
import { HealthController } from './health.controller.js';
import { BrandImagesController } from './brands/brand-images.controller.js';
import { BrandsModule } from './brands/brands.module.js';
import { BrandsResolver } from './brands/brands.resolver.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CategoriesResolver } from './categories/categories.resolver.js';
import { OptionsModule } from './options/options.module.js';
import { OptionsResolver } from './options/options.resolver.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [ProductsModule, BrandsModule, CategoriesModule, OptionsModule],
  providers: [CommerceResolver, BrandsResolver, CategoriesResolver, OptionsResolver],
})
class OperatorModule {}
@Module({
  imports: [DatabaseModule, ProductsModule, BrandsModule, CategoriesModule],
  controllers: [BrandImagesController],
  providers: [ShopperRepository, StorefrontResolver, StorefrontService],
})
class StorefrontModule {}
const context = ({ req }: { req: IncomingMessage }) => ({
  authorization: req.headers.authorization,
  branchId: req.headers['x-branch-id'],
});
@Module({
  controllers: [HealthController],
  imports: [
    OperatorModule,
    StorefrontModule,
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: readFileSync(new URL('./commerce.graphql', import.meta.url), 'utf8'),
      path: '/graphql',
      include: [OperatorModule],
      context,
    }),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: readFileSync(new URL('./storefront.graphql', import.meta.url), 'utf8'),
      path: '/storefront/graphql',
      include: [StorefrontModule],
      context,
    }),
  ],
})
export class AppModule {}
