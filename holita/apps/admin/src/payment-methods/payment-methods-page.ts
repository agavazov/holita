import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import {
  FilterBuilder,
  PageHeader,
  RowActions,
  TablePanel,
  UrlListState,
  listRecord,
  tableView,
  toneSeverity,
  trackById,
  uiMessages,
  type DrawerHost,
  type ListAction,
  type ListActionRequest,
  type ListDefinition,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { DemoSession } from '@osnova/ui/app';
import { MessageService } from 'primeng/api';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import type { OperatorPaymentMethodsQuery } from '../generated/payment-methods-operations';
import { PaymentMethodsApi } from './payment-methods-api';

type PaymentMethodAction = 'edit';
type PaymentMethodListPage = OperatorPaymentMethodsQuery['paymentMethods'];
type PaymentMethodRow = PaymentMethodListPage['items'][number];
const definition: ListDefinition<Record<string, never>, 'SORT_ORDER'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'SORT_ORDER', direction: 'ASC' },
  filters: {},
};

@Component({
  selector: 'holita-payment-methods-page',
  imports: [
    FilterBuilder,
    Message,
    PageHeader,
    RouterOutlet,
    RowActions,
    TableModule,
    TablePanel,
    Tag,
  ],
  templateUrl: './payment-methods-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodsPage {
  private readonly api = inject(PaymentMethodsApi);
  protected readonly language = inject(OperatorLanguage).value;
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  protected readonly scope = this.api.scope;
  protected readonly url = new UrlListState(definition, () => !!this.scope());
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly shared = computed(() => uiMessages[this.language()]);
  protected readonly canWrite = computed(() => this.session.hasRole('OPERATOR') && !!this.scope());
  protected readonly tableMinWidth = '23rem';
  protected readonly trackById = trackById;
  protected readonly tone = toneSeverity;
  protected readonly headerActions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'create', label: this.text().newPaymentMethod, primary: true }] : [],
  );
  protected readonly actions = computed<
    readonly ListAction<PaymentMethodAction, PaymentMethodRow>[]
  >(() => (this.canWrite() ? [{ id: 'edit', label: this.text().edit }] : []));
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    {
      id: 'label',
      label: this.text().methodLabel,
      width: 'auto',
      kind: 'identity',
      className: 'app-col-identity',
    },
    {
      id: 'enabled',
      label: this.text().status,
      width: '8rem',
      kind: 'status',
      className: 'app-table-merged-column',
    },
    {
      id: 'sortOrder',
      label: this.text().categorySortOrder,
      width: '8rem',
      kind: 'number',
      className: 'app-table-merged-column',
    },
    ...(this.canWrite()
      ? [
          {
            id: 'actions',
            label: this.shared().pageHeader.actions,
            width: '3.25rem',
            kind: 'actions' as const,
            className: 'app-col-actions',
          },
        ]
      : []),
  ]);
  protected readonly params = computed(() => {
    const scope = this.scope();
    const { page, pageSize, search } = this.url.state();
    return scope
      ? { scope, variables: { offset: (page - 1) * pageSize, limit: pageSize, search } }
      : undefined;
  });
  protected readonly list = resource({
    params: this.params,
    loader: ({ params }) => this.api.list(params.scope, params.variables),
  });
  protected readonly page = linkedSignal<
    { scope: ReturnType<PaymentMethodsApi['scope']>; data: PaymentMethodListPage | undefined },
    PaymentMethodListPage | null
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
      rows: this.page()?.items.length ?? null,
      filtered: !!this.url.state().search,
    }),
  );
  protected readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  protected readonly drawerHost: DrawerHost = {
    saved: ({ message }) => {
      this.messages.add({ severity: 'success', summary: message });
      this.list.reload();
    },
  };

  constructor() {
    effect(() => {
      const data = this.list.hasValue() && !this.list.isLoading() ? this.list.value() : null;
      if (data) {
        this.url.correctPage(Math.ceil(data.total / this.url.state().pageSize));
      }
    });
  }

  protected record(method: PaymentMethodRow) {
    return listRecord(this.actions(), method, method.id, method.label);
  }

  protected open(id: string): void {
    this.url.cancelPending();
    void this.router.navigate([id], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  protected run(request: ListActionRequest<PaymentMethodAction>): void {
    const id = request.ids[0];
    if (id && this.canWrite()) {
      this.open(id);
    }
  }
}
