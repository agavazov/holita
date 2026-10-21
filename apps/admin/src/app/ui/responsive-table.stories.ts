import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { TableModule } from 'primeng/table';
import { expect, userEvent, within } from 'storybook/test';
import { chooseMenuItem } from '../../storybook/interactions';
import { onFrame } from '../../storybook/story-config';
import { RowActions } from './row-actions/row-actions';

const meta: Meta = {
  title: 'Design System/Patterns/Responsive table',
  decorators: [moduleMetadata({ imports: [TableModule, RowActions] }), onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj;

export const IdentityAndActions: Story = {
  render: () => ({
    props: {
      rows: [
        {
          id: 'device-1',
          imei: '000123456789012',
          name: 'Aleksandar-Kristiyan Petrov-Stoyanov',
          vehicle: 'CA1234AB',
          model: 'Telemetry device',
        },
      ],
      actions: [{ id: 'view', label: 'View' }],
      record: { id: 'device-1', label: '000123456789012', unavailable: [] },
      chosen: '',
    },
    template: `
      <section class="app-card">
        <h1>Responsive table</h1>
        <p-table class="app-responsive-table" [value]="rows" [scrollable]="true" dataKey="id" [tableStyle]="{ 'min-width': '60rem' }">
          <ng-template #header>
            <tr>
              <th scope="col" class="app-col-identity">Device</th>
              <th scope="col">Vehicle</th>
              <th scope="col">Driver</th>
              <th scope="col">Last report</th>
              <th scope="col">Model</th>
              <th scope="col" class="app-col-actions" pFrozenColumn alignFrozen="right"><span class="app-visually-hidden">Actions</span></th>
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td class="app-col-identity">
                <span class="app-cell-stack"><span class="app-mono">{{ row.imei }}</span><span>{{ row.name }}</span></span>
                <div class="app-table-mobile-actions"><holita-row-actions [actions]="actions" [record]="record" (choose)="chosen = 'View ' + row.imei" /></div>
              </td>
              <td>{{ row.vehicle }}</td><td>{{ row.name }}</td><td>2026-10-20 12:34:56</td><td>{{ row.model }}</td>
              <td class="app-col-actions" pFrozenColumn alignFrozen="right"><holita-row-actions [actions]="actions" [record]="record" (choose)="chosen = 'View ' + row.imei" /></td>
            </tr>
          </ng-template>
        </p-table>
        @if (chosen) { <p role="status">{{ chosen }}</p> }
      </section>
    `,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const label = 'Actions for 000123456789012';
    // Only one of the two responsive placements is exposed at any viewport.
    await expect(canvas.getAllByRole('button', { name: label })).toHaveLength(1);
    await userEvent.click(canvas.getByRole('button', { name: label }));
    await chooseMenuItem(canvasElement.ownerDocument.body, 'View');
    await expect(canvas.getByRole('status')).toHaveTextContent('View 000123456789012');
  },
};

export const MobileIdentityAndActions: Story = {
  ...IdentityAndActions,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
