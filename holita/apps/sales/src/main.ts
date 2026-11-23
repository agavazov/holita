import { MerchantDetailPage, MerchantsPage, startOperator } from '@holita/operator';
import { leaveDrawer } from '@osnova/ui';
import { LeadDetailPage } from './leads/lead-detail-page';
import { LeadEditor } from './leads/lead-editor';
import { LeadsPage } from './leads/leads-page';
import { SalesWorkspaceStatus } from './workspace/sales-workspace-status';

void startOperator({
  name: 'sales',
  defaultPage: 'merchants',
  selectBranch: false,
  routes: [
    {
      path: '',
      component: SalesWorkspaceStatus,
      children: [
        { path: 'merchants', component: MerchantsPage },
        { path: 'merchants/:id', component: MerchantDetailPage },
        {
          path: 'leads',
          children: [
            {
              path: '',
              component: LeadsPage,
              children: [
                {
                  path: 'new',
                  component: LeadEditor,
                  data: { drawer: true, mode: 'create' },
                  canDeactivate: [leaveDrawer],
                },
              ],
            },
            {
              path: ':recordId',
              component: LeadDetailPage,
              children: [
                {
                  path: 'edit',
                  component: LeadEditor,
                  data: { drawer: true, mode: 'edit', recordParam: 'recordId' },
                  canDeactivate: [leaveDrawer],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  navigation: [
    { id: 'merchants', label: 'merchants', icon: 'users', path: 'merchants' },
    { id: 'leads', label: 'leads', icon: 'id-card', path: 'leads' },
  ],
}).catch((error: unknown) => {
  console.error(error);
});
