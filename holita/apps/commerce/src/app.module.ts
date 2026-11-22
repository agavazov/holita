import { unwrapResolverError } from '@apollo/server/errors';
import { Module, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { CartModule } from './cart/cart.module.js';
import { CartResolver } from './cart/cart.resolver.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { CheckoutResolver } from './checkout/checkout.resolver.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { InvoicesResolver } from './invoices/invoices.resolver.js';
import { OperatorOrdersResolver } from './orders/operator-orders.resolver.js';
import { OrdersModule } from './orders/orders.module.js';
import { OrdersResolver } from './orders/orders.resolver.js';
import { CommerceResolver } from './products/commerce.resolver.js';
import { CatalogueProductResolver, StorefrontResolver } from './storefront.resolver.js';
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
import { InventoryModule } from './inventory/inventory.module.js';
import { InventoryResolver } from './inventory/inventory.resolver.js';

@Module({
  imports: [
    ProductsModule,
    InventoryModule,
    BrandsModule,
    CategoriesModule,
    OptionsModule,
    CollectionsModule,
    CharacteristicsModule,
    BadgesModule,
    TagsModule,
    CustomersModule,
    OrdersModule,
    InvoicesModule,
  ],
  providers: [
    CommerceResolver,
    InventoryResolver,
    BrandsResolver,
    CategoriesResolver,
    OptionsResolver,
    CollectionsResolver,
    CharacteristicsResolver,
    BadgesResolver,
    TagsResolver,
    CustomersResolver,
    OperatorOrdersResolver,
    InvoicesResolver,
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
    CartModule,
    CheckoutModule,
    OrdersModule,
  ],
  controllers: [BrandImagesController, ProductImagesController],
  providers: [
    StorefrontResolver,
    CatalogueProductResolver,
    CartResolver,
    CheckoutResolver,
    OrdersResolver,
    StorefrontService,
  ],
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
      context: (http: Parameters<typeof context>[0]) => ({
        ...context(http),
        cartToken: http.req.headers['x-cart-token'],
      }),
      formatError: (formatted, error) => {
        const cause: unknown = unwrapResolverError(error);
        if (!(
          cause instanceof NotFoundException || cause instanceof UnprocessableEntityException
        )) {
          return formatted;
        }
        const code = cause instanceof NotFoundException ? 'NOT_FOUND' : 'BAD_USER_INPUT';
        const response = cause.getResponse();
        const fieldErrors =
          typeof response === 'object' && 'fieldErrors' in response
            ? response.fieldErrors
            : undefined;
        return {
          ...formatted,
          extensions: { code, ...(fieldErrors ? { fieldErrors } : {}) },
        };
      },
    }),
  ],
})
export class AppModule {}
