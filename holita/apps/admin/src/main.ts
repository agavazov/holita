import { startOperator } from '@holita/operator';
import { leaveDrawer } from '@osnova/ui';
import { BadgeEditor } from './badges/badge-editor';
import { BadgesPage } from './badges/badges-page';
import { BrandEditor } from './brands/brand-editor';
import { BrandsPage } from './brands/brands-page';
import { CategoriesPage } from './categories/categories-page';
import { CategoryEditor } from './categories/category-editor';
import { CharacteristicGroupEditor } from './characteristics/characteristic-group-editor';
import { CharacteristicGroupsPage } from './characteristics/characteristic-groups-page';
import { CollectionEditor } from './collections/collection-editor';
import { CollectionsPage } from './collections/collections-page';
import { CustomerAddressEditor } from './customers/customer-address-editor';
import { CustomerContactEditor } from './customers/customer-contact-editor';
import { CustomerDetail } from './customers/customer-detail';
import { CustomersPage } from './customers/customers-page';
import { DiscountEditor } from './discounts/discount-editor';
import { DiscountsPage } from './discounts/discounts-page';
import { InventoryEditor } from './inventory/inventory-editor';
import { InventoryPage } from './inventory/inventory-page';
import { OptionEditor } from './options/option-editor';
import { OptionsPage } from './options/options-page';
import { InvoiceDetail } from './orders/invoice-detail';
import { InvoiceEditor } from './orders/invoice-editor';
import { ManualOrderEditor } from './orders/manual-order-editor';
import { OrderDetail } from './orders/order-detail';
import { OrderRefundEditor } from './orders/order-refund-editor';
import { OrderStatusEditor } from './orders/order-status-editor';
import { OrdersPage } from './orders/orders-page';
import { ProductEditor } from './products/product-editor';
import { ProductsPage } from './products/products-page';

void startOperator({
  name: 'admin',
  defaultPage: 'products',
  selectBranch: true,
  routes: [
    {
      path: 'products',
      component: ProductsPage,
      children: [
        {
          path: 'new',
          component: ProductEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: ':recordId',
          component: ProductEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    {
      path: 'inventory',
      component: InventoryPage,
      children: [
        {
          path: ':recordId',
          component: InventoryEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    {
      path: 'categories',
      component: CategoriesPage,
      children: [
        {
          path: 'new',
          component: CategoryEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: ':recordId',
          component: CategoryEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    {
      path: 'brands',
      component: BrandsPage,
      children: [
        {
          path: 'new',
          component: BrandEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: ':recordId',
          component: BrandEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    {
      path: 'collections',
      component: CollectionsPage,
      children: [
        {
          path: 'new',
          component: CollectionEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: ':recordId',
          component: CollectionEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    {
      path: 'options',
      component: OptionsPage,
      children: [
        {
          path: 'new',
          component: OptionEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: ':recordId',
          component: OptionEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    {
      path: 'characteristic-groups',
      component: CharacteristicGroupsPage,
      children: [
        {
          path: 'new',
          component: CharacteristicGroupEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: ':recordId',
          component: CharacteristicGroupEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    {
      path: 'badges',
      component: BadgesPage,
      children: [
        {
          path: 'new',
          component: BadgeEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: ':recordId',
          component: BadgeEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    {
      path: 'orders',
      component: OrdersPage,
      children: [
        {
          path: 'new',
          component: ManualOrderEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    { path: 'orders/:recordId/invoice', component: InvoiceDetail },
    {
      path: 'orders/:recordId',
      component: OrderDetail,
      children: [
        {
          path: 'create-invoice',
          component: InvoiceEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: 'record-refund',
          component: OrderRefundEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: 'edit',
          component: ManualOrderEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: 'fulfillment',
          component: OrderStatusEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    {
      path: 'discounts',
      component: DiscountsPage,
      children: [
        {
          path: 'new',
          component: DiscountEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: ':recordId',
          component: DiscountEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
    { path: 'customers', component: CustomersPage },
    {
      path: 'customers/:recordId',
      component: CustomerDetail,
      children: [
        {
          path: 'contact',
          component: CustomerContactEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: 'new-address',
          component: CustomerAddressEditor,
          data: { drawer: true, mode: 'create' },
          canDeactivate: [leaveDrawer],
        },
        {
          path: ':recordId',
          component: CustomerAddressEditor,
          data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
          canDeactivate: [leaveDrawer],
        },
      ],
    },
  ],
  navigation: [
    { id: 'products', label: 'products', icon: 'box', path: 'products' },
    { id: 'inventory', label: 'inventory', icon: 'warehouse', path: 'inventory' },
    { id: 'categories', label: 'categories', icon: 'th-large', path: 'categories' },
    { id: 'brands', label: 'brands', icon: 'folder', path: 'brands' },
    { id: 'collections', label: 'collections', icon: 'clone', path: 'collections' },
    { id: 'options', label: 'options', icon: 'cog', path: 'options' },
    {
      id: 'characteristic-groups',
      label: 'characteristicGroups',
      icon: 'list-check',
      path: 'characteristic-groups',
    },
    { id: 'badges', label: 'badges', icon: 'tag', path: 'badges' },
    { id: 'orders', label: 'orders', icon: 'truck', path: 'orders' },
    { id: 'discounts', label: 'discounts', icon: 'tags', path: 'discounts' },
    { id: 'customers', label: 'customers', icon: 'users', path: 'customers' },
  ],
}).catch((error: unknown) => {
  console.error(error);
});
