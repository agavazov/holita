import { Module } from '@nestjs/common';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { CommerceResolver } from './products/commerce.resolver.js';
import { StorefrontResolver } from './storefront.resolver.js';
import { StorefrontService } from './storefront.service.js';
import { CustomersModule } from './customers/customers.module.js';
import { CustomersResolver } from './customers/customers.resolver.js';
import { ProductImagesController } from './products/product-images.controller.js';
import { HealthController } from './health.controller.js';
import { BrandImagesController } from './brands/brand-images.controller.js';
import { BrandsModule } from './brands/brands.module.js';
import { BrandsResolver } from './brands/brands.resolver.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CategoriesResolver } from './categories/categories.resolver.js';
import { CollectionsModule } from './collections/collections.module.js';
import { CollectionsResolver } from './collections/collections.resolver.js';
import { OptionsModule } from './options/options.module.js';
import { OptionsResolver } from './options/options.resolver.js';
import { CharacteristicsModule } from './characteristics/characteristics.module.js';
import { CharacteristicsResolver } from './characteristics/characteristics.resolver.js';
import { BadgesModule } from './badges/badges.module.js';
import { BadgesResolver } from './badges/badges.resolver.js';
import { TagsModule } from './tags/tags.module.js';
import { TagsResolver } from './tags/tags.resolver.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [
    ProductsModule,
    BrandsModule,
    CategoriesModule,
    OptionsModule,
    CollectionsModule,
    CharacteristicsModule,
    BadgesModule,
    TagsModule,
    CustomersModule,
  ],
  providers: [
    CommerceResolver,
    BrandsResolver,
    CategoriesResolver,
    OptionsResolver,
    CollectionsResolver,
    CharacteristicsResolver,
    BadgesResolver,
    TagsResolver,
    CustomersResolver,
  ],
})
class OperatorModule {}
@Module({
  imports: [
    ProductsModule,
    BrandsModule,
    CategoriesModule,
    CollectionsModule,
    CharacteristicsModule,
    CustomersModule,
  ],
  controllers: [BrandImagesController, ProductImagesController],
  providers: [StorefrontResolver, StorefrontService],
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
