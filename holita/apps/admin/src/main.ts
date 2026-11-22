import { startOperator } from '@holita/operator';
import { leaveDrawer } from '@osnova/ui';
import { BrandEditor } from './brands/brand-editor';
import { BrandsPage } from './brands/brands-page';
import { CategoriesPage } from './categories/categories-page';
import { CategoryEditor } from './categories/category-editor';
import { CharacteristicGroupEditor } from './characteristics/characteristic-group-editor';
import { CharacteristicGroupsPage } from './characteristics/characteristic-groups-page';
import { CollectionEditor } from './collections/collection-editor';
import { CollectionsPage } from './collections/collections-page';
import { CustomersPage } from './customers-page';
import { OptionEditor } from './options/option-editor';
import { OptionsPage } from './options/options-page';
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
    { path: 'customers', component: CustomersPage },
  ],
  navigation: [
    { id: 'products', label: 'products', icon: 'tags', path: 'products' },
    { id: 'categories', label: 'categories', icon: 'th-large', path: 'categories' },
    { id: 'brands', label: 'brands', icon: 'folder', path: 'brands' },
    { id: 'collections', label: 'collections', icon: 'directions', path: 'collections' },
    { id: 'options', label: 'options', icon: 'cog', path: 'options' },
    {
      id: 'characteristic-groups',
      label: 'characteristicGroups',
      icon: 'id-card',
      path: 'characteristic-groups',
    },
    { id: 'customers', label: 'customers', icon: 'users', path: 'customers' },
  ],
}).catch((error: unknown) => {
  console.error(error);
});
