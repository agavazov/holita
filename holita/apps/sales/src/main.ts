import { MerchantDetailPage, MerchantsPage, startOperator } from '@holita/operator';
import { leaveDrawer } from '@osnova/ui';
import { ContactEditor } from './contacts/contact-editor';
import { ContactsPage } from './contacts/contacts-page';
import { LeadDetailPage } from './leads/lead-detail-page';
import { LeadEditor } from './leads/lead-editor';
import { LeadNoteEditor } from './leads/lead-note-editor';
import { LeadTaskEditor } from './leads/lead-task-editor';
import { LeadsPage } from './leads/leads-page';
import { SalesWorkspaceStatus } from './workspace/sales-workspace-status';

void startOperator({
  name: 'sales',
  defaultPage: 'merchants',
  selectBranch: false,
  retainRouteContext: true,
  routes: [
    {
      path: '',
      component: SalesWorkspaceStatus,
      children: [
        { path: 'merchants', component: MerchantsPage },
        { path: 'merchants/:id', component: MerchantDetailPage },
      ],
    },
    {
      path: 'leads',
      component: SalesWorkspaceStatus,
      data: { requireSalesAccess: true },
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
                {
                  path: 'contacts/new',
                  component: ContactEditor,
                  data: { drawer: true, mode: 'create', contactEditor: true },
                  canDeactivate: [leaveDrawer],
                },
                {
                  path: 'contacts/:recordId/edit',
                  component: ContactEditor,
                  data: {
                    drawer: true,
                    mode: 'edit',
                    recordParam: 'recordId',
                    contactEditor: true,
                  },
                  canDeactivate: [leaveDrawer],
                },
                {
                  path: 'notes/new',
                  component: LeadNoteEditor,
                  data: { drawer: true, mode: 'create', noteEditor: true },
                  canDeactivate: [leaveDrawer],
                },
                {
                  path: 'notes/:recordId/edit',
                  component: LeadNoteEditor,
                  data: { drawer: true, mode: 'edit', recordParam: 'recordId', noteEditor: true },
                  canDeactivate: [leaveDrawer],
                },
                {
                  path: 'tasks/new',
                  component: LeadTaskEditor,
                  data: { drawer: true, mode: 'create', taskEditor: true },
                  canDeactivate: [leaveDrawer],
                },
                {
                  path: 'tasks/:recordId/edit',
                  component: LeadTaskEditor,
                  data: { drawer: true, mode: 'edit', recordParam: 'recordId', taskEditor: true },
                  canDeactivate: [leaveDrawer],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      path: 'contacts',
      component: SalesWorkspaceStatus,
      data: { requireSalesAccess: true },
      children: [{ path: '', component: ContactsPage }],
    },
  ],
  navigation: [
    { id: 'merchants', label: 'merchants', icon: 'users', path: 'merchants' },
    { id: 'leads', label: 'leads', icon: 'id-card', path: 'leads' },
    { id: 'contacts', label: 'contacts', icon: 'envelope', path: 'contacts' },
  ],
}).catch((error: unknown) => {
  console.error(error);
});
