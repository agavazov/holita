import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { onFrame } from '../../storybook/story-config';
import { RowActions } from './row-actions/row-actions';
import { TablePanel, type TableColumn } from './table-panel/table-panel';

const columns: readonly TableColumn[] = [
  {
    id: 'identity',
    label: 'Device',
    width: '16rem',
    kind: 'identity',
    className: 'app-col-identity',
  },
  { id: 'vehicle', label: 'Vehicle', width: '12rem' },
  { id: 'status', label: 'Connection', width: '11rem', kind: 'status' },
  { id: 'date', label: 'Last report', width: '12rem', kind: 'date' },
  { id: 'problems', label: 'Problems', width: '9rem', kind: 'problems' },
  { id: 'distance', label: 'Distance, km', width: '10rem', kind: 'number', className: 'app-num' },
  { id: 'model', label: 'Model', width: '15rem', className: 'app-col-secondary' },
  {
    id: 'actions',
    label: 'Actions',
    width: '3.25rem',
    kind: 'actions',
    className: 'app-col-actions',
  },
];

const meta: Meta = {
  title: 'Design System/Tables/Responsive cells',
  decorators: [moduleMetadata({ imports: [TableModule, Tag, TablePanel, RowActions] }), onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj;

export const IdentityAndActions: Story = {
  render: () => ({
    props: {
      columns,
      rows: [
        {
          id: 'device-1',
          imei: '000123456789012',
          name: 'Aleksandar-Kristiyan Petrov-Stoyanov',
          vehicle: 'CA 1234 AB',
          model: 'Telemetry device with a long model description',
        },
      ],
      actions: [{ id: 'view', label: 'View' }],
      record: { id: 'device-1', label: '000123456789012', unavailable: [] },
      chosen: '',
    },
    template: `
      <div class="app-view">
        <discocan-table-panel #panel heading="Responsive cells" mode="local" [total]="rows.length" [view]="{kind: 'rows'}" [columns]="columns" tableMinWidth="88.25rem" [actions]="actions" (action)="chosen = 'View ' + $event.ids.join(', ')">
          <p-table class="app-responsive-table" [value]="rows" [scrollable]="true" dataKey="id" [tableStyle]="{ 'min-width': 'var(--app-table-responsive-min-width)' }">
            <ng-template #colgroup><colgroup>@for (column of columns; track column.id) { <col [style.width]="column.className === 'app-col-identity' ? 'var(--app-table-identity-width, ' + column.width + ')' : column.width" [class]="column.className ?? ''" /> }</colgroup></ng-template>
            <ng-template #header>
              <tr>
                @for (column of columns; track column.id) {
                  @if (column.kind === 'actions') {
                    <th scope="col" class="app-col-actions" pFrozenColumn alignFrozen="right"><span class="app-visually-hidden">{{ column.label }}</span></th>
                  } @else {
                    <th scope="col" [class]="column.className ?? ''">{{ column.label }}</th>
                  }
                }
              </tr>
            </ng-template>
            <ng-template #body let-row>
              <tr>
                <td class="app-col-identity">
                  <span class="app-cell-identity"><span class="app-mono" [title]="row.imei">{{ row.imei }}</span><span [title]="row.name">{{ row.name }}</span></span>
                  <div class="app-table-mobile-actions"><discocan-row-actions [actions]="actions" [record]="record" (choose)="panel.run($event.action, [record], $event.origin)" /></div>
                </td>
                <td><span class="app-plate">{{ row.vehicle }}</span></td>
                <td><span class="app-cell-status"><p-tag severity="success" value="Connected" /></span></td>
                <td><time class="app-cell-date" datetime="2026-11-06T10:34:56Z" title="2026-11-06 12:34:56 Europe/Sofia">2026-11-06 12:34</time></td>
                <td><span class="app-cell-problems"><p-tag severity="warn" value="2" /><button type="button" class="app-link" (click)="panel.run('view', [record], $event.currentTarget)">View</button></span></td>
                <td class="app-num"><span class="app-cell-number">123,456.7</span></td>
                <td class="app-col-secondary"><span class="app-cell-truncate" [title]="row.model">{{ row.model }}</span></td>
                <td class="app-col-actions" pFrozenColumn alignFrozen="right"><discocan-row-actions [actions]="actions" [record]="record" (choose)="panel.run($event.action, [record], $event.origin)" /></td>
              </tr>
            </ng-template>
          </p-table>
        </discocan-table-panel>
        @if (chosen) { <p role="status">{{ chosen }}</p> }
      </div>
    `,
  }),
};

export const MobileIdentityAndActions: Story = {
  ...IdentityAndActions,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
