import { startOperator } from '@holita/operator';
import { leaveDrawer } from '@osnova/ui';
import { BrandEditor } from './brands/brand-editor';
import { BrandsPage } from './brands/brands-page';
import { CategoriesPage } from './categories/categories-page';
import { CategoryEditor } from './categories/category-editor';
import { CustomersPage } from './customers-page';
import { ProductsPage } from './products-page';

void startOperator({
  name: 'admin',
  defaultPage: 'products',
  selectBranch: true,
  routes: [
    { path: 'products', component: ProductsPage },
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
    { path: 'customers', component: CustomersPage },
  ],
  navigation: [
    { id: 'products', label: 'products', icon: 'tags', path: 'products' },
    { id: 'categories', label: 'categories', icon: 'folder', path: 'categories' },
    { id: 'brands', label: 'brands', icon: 'folder', path: 'brands' },
    { id: 'customers', label: 'customers', icon: 'users', path: 'customers' },
  ],
}).catch((error: unknown) => {
  console.error(error);
});
