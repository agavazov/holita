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
  FilterBuilder,
  PageHeader,
  TablePanel,
  UrlListState,
  codecs,
  formatDateOnly,
  injectDisplayFormat,
  tableView,
  trackById,
  uiMessages,
  type FilterCondition,
  type FilterField,
  type ListDefinition,
  type TableColumn,
} from '@osnova/ui';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import type { OperatorInvoicesQuery } from '../generated/orders-operations';
import { orderAmount } from './order-format';
import { OrdersApi } from './orders-api';

type InvoicePage = OperatorInvoicesQuery['invoices'];
type InvoiceFilters = { issueDateFrom: string | undefined; issueDateTo: string | undefined };
const definition: ListDefinition<InvoiceFilters, 'ISSUE_DATE'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'ISSUE_DATE', direction: 'DESC' },
  filters: { issueDateFrom: codecs.dateOnly(), issueDateTo: codecs.dateOnly() },
  normalizeFilter: ({ issueDateFrom, issueDateTo }) =>
    issueDateFrom && (!issueDateTo || issueDateFrom <= issueDateTo)
      ? { issueDateFrom, issueDateTo }
      : {},
};

@Component({
  selector: 'holita-invoices-page',
  imports: [FilterBuilder, Message, PageHeader, RouterLink, TableModule, TablePanel],
  templateUrl: './invoices-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesPage {
  private readonly api = inject(OrdersApi);
  private readonly format = injectDisplayFormat();
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly amount = orderAmount;
  protected readonly trackById = trackById;
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'number',
      label: this.text().invoiceNumber,
      width: '28%',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'issueDate',
      label: this.text().invoiceIssueDate,
      width: '10rem',
      kind: 'date',
      className: 'app-table-merged-column',
    },
    {
      id: 'recipient',
      label: this.text().invoiceRecipient,
      width: 'auto',
      className: 'app-table-merged-column',
    },
    { id: 'total', label: this.text().orderTotal, width: '8rem', kind: 'number' },
  ]);
  protected readonly filterFields = computed<readonly FilterField[]>(() => [
    {
      key: 'issueDate',
      label: this.text().invoiceIssueDate,
      type: 'date',
      operators: ['on', 'between'],
    },
  ]);
  protected readonly conditions = computed<readonly FilterCondition[]>(() => {
    const { issueDateFrom, issueDateTo } = this.url.state().filter;
    if (!issueDateFrom) {
      return [];
    }
    return [
      {
        id: 'issueDate',
        field: 'issueDate',
        operator: issueDateTo ? 'between' : 'on',
        values: issueDateTo ? [issueDateFrom, issueDateTo] : [issueDateFrom],
      },
    ];
  });
  protected readonly list = resource({
    params: () => {
      const scope = this.scope();
      const { page, pageSize, search, filter } = this.url.state();
      return scope
        ? {
            scope,
            variables: {
              offset: (page - 1) * pageSize,
              limit: pageSize,
              search,
              filter: filter.issueDateFrom
                ? {
                    issueDateFrom: filter.issueDateFrom,
                    issueDateTo: filter.issueDateTo ?? filter.issueDateFrom,
                  }
                : null,
            },
          }
        : undefined;
    },
    loader: ({ params }) => this.api.invoices(params.scope, params.variables),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<OrdersApi['scope']>; data: InvoicePage | undefined },
    InvoicePage | null
  >({
    source: () => ({
      scope: this.scope(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ?? (previous?.source.scope === current.scope ? previous.value : null),
  });
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.page()?.items.length ?? null,
      filtered: !!this.url.state().search || this.conditions().length > 0,
    }),
  );

  constructor() {
    effect(() => {
      if (this.list.hasValue() && !this.list.isLoading()) {
        this.url.correctPage(Math.ceil(this.list.value().total / this.url.state().pageSize));
      }
    });
  }

  protected changeConditions(conditions: readonly FilterCondition[]): void {
    const [issueDateFrom, issueDateTo] = conditions[0]?.values ?? [];
    this.url.patchFilter({ issueDateFrom, issueDateTo });
  }

  protected date(value: string): string {
    return formatDateOnly(value, this.language(), this.format.preferences().dateFormat);
  }
}
