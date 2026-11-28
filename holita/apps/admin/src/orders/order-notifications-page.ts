import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
  untracked,
} from '@angular/core';
import { OperatorLanguage } from '@holita/operator';
import {
  formatNumber,
  injectDisplayFormat,
  PageHeader,
  tableView,
  TablePanel,
  UrlListState,
  type ListDefinition,
  type TableColumn,
} from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { OrderNotifications } from './order-notifications';
import { OrdersApi } from './orders-api';

const definition: ListDefinition<Record<string, never>, 'PLACED_AT'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'PLACED_AT', direction: 'DESC' },
  filters: {},
};

@Component({
  selector: 'holita-order-notifications-page',
  imports: [ButtonDirective, PageHeader, TableModule, TablePanel, Tag],
  templateUrl: './order-notifications-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderNotificationsPage {
  private readonly api = inject(OrdersApi);
  protected readonly notifications = inject(OrderNotifications);
  protected readonly text = this.notifications.text;
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly format = injectDisplayFormat();
  protected readonly formatNumber = formatNumber;
  protected trackOrder(_index: number, row: { readonly orderId: string }): string {
    return row.orderId;
  }

  protected readonly url = new UrlListState(definition, () => !!this.notifications.scope());
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'number',
      label: this.text().order,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'placedAt',
      label: this.text().orderDate,
      width: '12rem',
      kind: 'date',
      className: 'app-col-secondary',
    },
    { id: 'readState', label: this.text().orderNotificationStatus, width: '8rem', kind: 'status' },
  ]);
  protected readonly list = resource({
    params: () => {
      const scope = this.notifications.scope();
      const { page, pageSize } = this.url.state();
      return scope ? { scope, offset: (page - 1) * pageSize, limit: pageSize } : undefined;
    },
    loader: ({ params: { scope, offset, limit }, abortSignal }) =>
      this.api.notifications(scope, { offset, limit }, abortSignal),
  });
  protected readonly data = computed(() => (this.list.hasValue() ? this.list.value() : null));
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.data()?.items.length ?? null,
      filtered: false,
    }),
  );
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.data()?.total ?? 0,
  }));

  constructor() {
    effect(() => {
      this.notifications.refresh();
      untracked(() => this.list.reload());
    });
    effect(() => {
      const data = this.data();
      if (data && !this.list.isLoading()) {
        this.url.correctPage(Math.ceil(data.total / this.url.state().pageSize));
      }
    });
  }
}
