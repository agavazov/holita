import { startOperator } from '@holita/operator';
import { MerchantDetailPage, MerchantsPage } from '@holita/operator';

void startOperator({
  name: 'sales',
  defaultPage: 'merchants',
  selectBranch: false,
  routes: [
    { path: 'merchants', component: MerchantsPage },
    { path: 'merchants/:id', component: MerchantDetailPage },
  ],
  navigation: [{ id: 'merchants', label: 'merchants', icon: 'users', path: 'merchants' }],
}).catch((error: unknown) => {
  console.error(error);
});
