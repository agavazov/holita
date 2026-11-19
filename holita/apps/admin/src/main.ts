import { startOperator } from '@holita/operator';
import { CustomersPage } from './customers-page';
import { ProductsPage } from './products-page';

void startOperator({
  name: 'admin',
  defaultPage: 'products',
  selectBranch: true,
  routes: [
    { path: 'products', component: ProductsPage },
    { path: 'customers', component: CustomersPage },
  ],
  navigation: [
    { id: 'products', label: 'products', icon: 'tags', path: 'products' },
    { id: 'customers', label: 'customers', icon: 'users', path: 'customers' },
  ],
}).catch((error: unknown) => {
  console.error(error);
});
