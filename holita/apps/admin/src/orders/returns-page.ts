import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  injectDisplayFormat,
  PageHeader,
  TablePanel,
  tableView,
  trackById,
  UrlListState,
  type ListDefinition,
  type TableColumn,
} from '@osnova/ui';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { OperatorOrderReturnsQuery } from '../generated/orders-operations';
import { OrdersApi } from './orders-api';
import { returnStatusSeverity, returnStatusText } from './return-format';

const definition: ListDefinition<Record<string, never>, 'REQUESTED_AT'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'REQUESTED_AT', direction: 'DESC' },
  filters: {},
};

type ReturnPage = OperatorOrderReturnsQuery['orderReturns'];

@Component({
  selector: 'holita-returns-page',
  imports: [Message, PageHeader, RouterLink, TableModule, TablePanel, Tag],
  templateUrl: './returns-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReturnsPage {
  private readonly api = inject(OrdersApi);
  protected readonly scope = this.api.scope;
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly format = injectDisplayFormat();
  protected readonly statusText = returnStatusText;
  protected readonly statusSeverity = returnStatusSeverity;
  protected readonly trackById = trackById;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'order',
      label: this.text().order,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'date',
      label: this.text().returnRequestedAt,
      width: '12rem',
      kind: 'date',
      className: 'app-table-merged-column',
    },
    { id: 'status', label: this.text().status, width: '9rem', kind: 'status' },
  ]);
  protected readonly list = resource({
    params: () => {
      const scope = this.scope();
      const { page, pageSize } = this.url.state();
      return scope ? { scope, offset: (page - 1) * pageSize, limit: pageSize } : undefined;
    },
    loader: ({ params: { scope, offset, limit }, abortSignal }) =>
      this.api.returns(scope, { offset, limit }, abortSignal),
  });
  protected readonly data = linkedSignal<
    { scope: ReturnType<OrdersApi['scope']>; data: ReturnPage | undefined },
    ReturnPage | null
  >({
    source: () => ({
      scope: this.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? previous.value : null),
  });
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
      if (this.list.hasValue() && !this.list.isLoading()) {
        this.url.correctPage(Math.ceil(this.list.value().total / this.url.state().pageSize));
      }
    });
  }
}
