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
  tableView,
  trackById,
  uiMessages,
  type ListDefinition,
  type TableColumn,
} from '@osnova/ui';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import type { OperatorCustomersQuery } from '../generated/customers-operations';
import { CustomersApi } from './customers-api';

type CustomerPage = OperatorCustomersQuery['customers'];
const definition: ListDefinition<Record<string, never>, 'NAME'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'NAME', direction: 'ASC' },
  filters: {},
};

@Component({
  selector: 'holita-customers-page',
  imports: [FilterBuilder, Message, PageHeader, RouterLink, TableModule, TablePanel],
  templateUrl: './customers-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersPage {
  private readonly api = inject(CustomersApi);
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly trackById = trackById;
  protected readonly tableMinWidth = '27rem';
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'name',
      label: this.text().name,
      width: '45%',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'email',
      label: this.text().email,
      width: 'auto',
      className: 'app-table-merged-column',
    },
  ]);
  private readonly params = computed(() => {
    const scope = this.scope();
    const { search, page, pageSize } = this.url.state();
    return scope
      ? { scope, variables: { offset: (page - 1) * pageSize, limit: pageSize, search } }
      : undefined;
  });
  protected readonly list = resource({
    params: this.params,
    loader: ({ params }) => this.api.list(params.scope, params.variables),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<CustomersApi['scope']>; data: CustomerPage | undefined },
    CustomerPage | null
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
  protected readonly detailQuery = computed(() => {
    const { search, page, pageSize } = this.url.state();
    return {
      customersSearch: search || null,
      customersPage: page > 1 ? page : null,
      customersPageSize: pageSize !== definition.defaultPageSize ? pageSize : null,
    };
  });
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.page()?.items.length ?? null,
      filtered: !!this.url.state().search,
    }),
  );

  constructor() {
    effect(() => {
      if (this.list.hasValue() && !this.list.isLoading()) {
        this.url.correctPage(Math.ceil(this.list.value().total / this.url.state().pageSize));
      }
    });
  }
}
