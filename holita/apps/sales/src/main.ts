import { MerchantDetailPage, MerchantsPage, startOperator } from '@holita/operator';
import { SalesWorkspaceStatus } from './workspace/sales-workspace-status';

void startOperator({
  name: 'sales',
  defaultPage: 'merchants',
  selectBranch: false,
  workspaceStatus: SalesWorkspaceStatus,
  routes: [
    { path: 'merchants', component: MerchantsPage },
    { path: 'merchants/:id', component: MerchantDetailPage },
  ],
  navigation: [{ id: 'merchants', label: 'merchants', icon: 'users', path: 'merchants' }],
}).catch((error: unknown) => {
  console.error(error);
});
