import { startOperator } from '@holita/operator';
import { leaveDrawer } from '@osnova/ui';
import { BrandEditor } from './brands/brand-editor';
import { BrandsPage } from './brands/brands-page';
import { CustomersPage } from './customers-page';
import { ProductsPage } from './products-page';

void startOperator({
  name: 'admin',
  defaultPage: 'products',
  selectBranch: true,
  routes: [
    { path: 'products', component: ProductsPage },
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
    { id: 'brands', label: 'brands', icon: 'folder', path: 'brands' },
    { id: 'customers', label: 'customers', icon: 'users', path: 'customers' },
  ],
}).catch((error: unknown) => {
  console.error(error);
});
