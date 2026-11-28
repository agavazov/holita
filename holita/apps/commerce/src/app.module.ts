import { unwrapResolverError } from '@apollo/server/errors';
import { Module, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ApolloFederationDriver, type ApolloFederationDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { BlogModule } from './blog/blog.module.js';
import { BlogResolver } from './blog/blog.resolver.js';
import { CartModule } from './cart/cart.module.js';
import { CartResolver } from './cart/cart.resolver.js';
import { CheckoutModule } from './checkout/checkout.module.js';
import { CheckoutResolver } from './checkout/checkout.resolver.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { DashboardResolver } from './dashboard/dashboard.resolver.js';
import { DiscountsModule } from './discounts/discounts.module.js';
import { DiscountsResolver } from './discounts/discounts.resolver.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { InvoicesResolver } from './invoices/invoices.resolver.js';
import { ManualMethodsModule } from './manual-methods/manual-methods.module.js';
import { ManualMethodsResolver } from './manual-methods/manual-methods.resolver.js';
import { NavigationModule } from './navigation/navigation.module.js';
import { NavigationResolver } from './navigation/navigation.resolver.js';
import { OperatorOrdersResolver } from './orders/operator-orders.resolver.js';
import { OrdersModule } from './orders/orders.module.js';
import { OrdersResolver } from './orders/orders.resolver.js';
import { PagesModule } from './pages/pages.module.js';
import { PagesResolver } from './pages/pages.resolver.js';
import { RefundsModule } from './refunds/refunds.module.js';
import { RefundsResolver } from './refunds/refunds.resolver.js';
import { ReturnsModule } from './returns/returns.module.js';
import { ReturnsResolver } from './returns/returns.resolver.js';
import { ShopperReturnsResolver } from './returns/shopper-returns.resolver.js';
import { ShopBrandingImagesController } from './shop-settings/shop-branding-images.controller.js';
import { ShopHomeImagesController } from './shop-settings/shop-home-images.controller.js';
import { ShopSettingsModule } from './shop-settings/shop-settings.module.js';
import { ShopSettingsResolver } from './shop-settings/shop-settings.resolver.js';
import { CommerceResolver } from './products/commerce.resolver.js';
import { CatalogueProductResolver, StorefrontResolver } from './storefront.resolver.js';
import { StorefrontService } from './storefront.service.js';
import { StorefrontIngress } from './storefront-ingress.js';
import { CustomersModule } from './customers/customers.module.js';
import { CustomersResolver } from './customers/customers.resolver.js';
import { ShopperAddressesResolver } from './customers/shopper-addresses.resolver.js';
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
    DashboardModule,
    DiscountsModule,
    ManualMethodsModule,
    OrdersModule,
    InvoicesModule,
    RefundsModule,
    ReturnsModule,
    PagesModule,
    BlogModule,
    NavigationModule,
    ShopSettingsModule,
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
    DashboardResolver,
    DiscountsResolver,
    ManualMethodsResolver,
    OperatorOrdersResolver,
    InvoicesResolver,
    RefundsResolver,
    ReturnsResolver,
    PagesResolver,
    BlogResolver,
    NavigationResolver,
    ShopSettingsResolver,
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
    ReturnsModule,
    PagesModule,
    BlogModule,
    NavigationModule,
    ShopSettingsModule,
  ],
  controllers: [
    BrandImagesController,
    ProductImagesController,
    ShopHomeImagesController,
    ShopBrandingImagesController,
  ],
  providers: [
    StorefrontResolver,
    CatalogueProductResolver,
    CartResolver,
    ShopperAddressesResolver,
    CheckoutResolver,
    OrdersResolver,
    ShopperReturnsResolver,
    StorefrontService,
    StorefrontIngress,
  ],
})
class StorefrontModule {}
const context = ({ req }: { req: IncomingMessage }) => ({
  authorization: req.headers.authorization,
  branchId: req.headers['x-branch-id'],
});
const formatFieldErrors: NonNullable<ApolloFederationDriverConfig['formatError']> = (
  formatted,
  error,
) => {
  const cause: unknown = unwrapResolverError(error);
  if (!(cause instanceof UnprocessableEntityException || cause instanceof NotFoundException)) {
    return formatted;
  }
  const response = cause.getResponse();
  const fieldErrors =
    typeof response === 'object' && 'fieldErrors' in response ? response.fieldErrors : undefined;
  return {
    ...formatted,
    extensions: {
      code: cause instanceof NotFoundException ? 'NOT_FOUND' : 'BAD_USER_INPUT',
      ...(fieldErrors ? { fieldErrors } : {}),
    },
  };
};

const formatOperatorError: NonNullable<ApolloFederationDriverConfig['formatError']> = (
  formatted,
  error,
) => {
  const result = formatFieldErrors(formatted, error);
  if (result === formatted) {
    return formatted;
  }
  const fields: unknown = result.extensions?.['fieldErrors'];
  if (!Array.isArray(fields)) {
    return result;
  }
  return {
    ...result,
    extensions: {
      ...result.extensions,
      // The Router's public field path contract allows only alphanumeric names.
      fieldErrors: fields.map((field: unknown) => {
        if (
          typeof field !== 'object' ||
          field === null ||
          !('path' in field) ||
          typeof field.path !== 'string'
        ) {
          return field;
        }
        return {
          ...field,
          path: field.path.replace(/\.([a-z0-9])/gu, (_, initial: string) => initial.toUpperCase()),
        };
      }),
    },
  };
};

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
      formatError: formatOperatorError,
    }),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typeDefs: readFileSync(new URL('./storefront.graphql', import.meta.url), 'utf8'),
      path: '/storefront/graphql',
      include: [StorefrontModule],
      context: (http: Parameters<typeof context>[0]) => ({
        ...context(http),
        cartToken: http.req.headers['x-cart-token'],
        emailLanguage: http.req.headers['accept-language'] === 'en' ? 'en' : 'bg',
      }),
      formatError: formatFieldErrors,
    }),
  ],
})
export class AppModule {}
