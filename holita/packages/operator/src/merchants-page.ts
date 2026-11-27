import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import {
  FormField,
  PageHeader,
  RouteDrawer,
  TablePanel,
  UrlListState,
  confirmAction,
  confirmDialogPt,
  tableView,
  type ListDefinition,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { DemoSession, requestError } from '@osnova/ui/app';
import { OperatorLanguage } from './application';
import { OperatorApi } from './operator-api';
import { operatorStrings as strings } from './strings';
import type { OperatorMerchantsQuery } from './generated/operations';

type MerchantPage = OperatorMerchantsQuery['merchants'];
type Merchant = MerchantPage['items'][number];

const definition: ListDefinition<Record<string, never>, 'NAME'> = {
  pageSizes: [10, 20, 50, 100],
  defaultPageSize: 20,
  sorts: [],
  defaultSort: { field: 'NAME', direction: 'ASC' },
  filters: {},
};

@Component({
  selector: 'holita-merchants-page',
  imports: [
    PageHeader,
    TablePanel,
    TableModule,
    ButtonDirective,
    ConfirmDialog,
    RouterLink,
    RouteDrawer,
    ReactiveFormsModule,
    InputText,
    FormField,
    Message,
  ],
  providers: [ConfirmationService],
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <osnova-page-header
      [title]="text().merchants"
      [moduleInfo]="text().merchantsInfo"
      [actions]="actions()"
      (action)="open()"
    />
    <osnova-table-panel
      [heading]="text().merchants"
      [columns]="columns()"
      [view]="view()"
      [total]="page()?.total ?? null"
      [errorText]="error()"
      [actionFeedback]="statusError()"
      [busy]="list.isLoading()"
      [page]="pagination()"
      [pageSizes]="pageSizes"
      (pageChange)="url.setPage($event)"
      (retry)="load()"
    >
      <p-table class="app-responsive-table" [value]="page()?.items ?? []" dataKey="id">
        <ng-template #colgroup>
          <colgroup>
            @for (column of columns(); track column.id) {
              <col [class]="column.className ?? ''" [style.width]="column.width" />
            }
          </colgroup>
        </ng-template>
        <ng-template #header>
          <tr>
            @for (column of columns(); track column.id) {
              <th scope="col" [class]="column.className ?? ''">{{ column.label }}</th>
            }
          </tr>
        </ng-template>
        <ng-template #body let-row
          ><tr>
            <td>
              <a
                class="app-link app-cell-truncate"
                [routerLink]="['/', language.value(), 'merchants', row.id]"
                queryParamsHandling="preserve"
                [title]="row.name"
                >{{ row.name }}</a
              >
              <span class="app-table-mobile-meta">{{ text().shops }} · {{ row.branchCount }}</span>
            </td>
            <td>{{ row.status === 'ACTIVE' ? text().active : text().suspended }}</td>
            <td class="app-num app-table-merged-column">{{ row.branchCount }}</td>
            @if (canWrite()) {
              <td>
                <button
                  #statusButton
                  pButton
                  type="button"
                  severity="secondary"
                  [disabled]="statusDisabled()"
                  (click)="toggle(row, statusButton)"
                >
                  {{ row.status === 'ACTIVE' ? text().suspend : text().reactivate }}
                </button>
              </td>
            }
          </tr></ng-template
        >
      </p-table>
    </osnova-table-panel>
    <p-confirmdialog
      appendTo="body"
      [pt]="suspendDialogPt()"
      [style]="{ width: 'min(28rem, calc(100vw - var(--p-app-space-8)))' }"
    >
      <ng-template #message>
        <div id="suspend-merchant-message" class="app-stack">
          <strong style="overflow-wrap: anywhere">{{ suspensionName() }}</strong>
          <p>{{ text().suspendMerchantEffect }}</p>
        </div>
      </ng-template>
    </p-confirmdialog>
    @if (drawer()) {
      <osnova-route-drawer
        [title]="text().createMerchant"
        [closeLink]="null"
        [saving]="saving()"
        [dirty]="form.dirty"
        (closeRequest)="drawer.set(false)"
      >
        <form [formGroup]="form" (ngSubmit)="create()" class="app-form-section">
          <osnova-form-field controlId="merchant-name" [label]="text().name" [required]="true"
            ><input pInputText id="merchant-name" formControlName="name"
          /></osnova-form-field>
          <osnova-form-field
            controlId="merchant-admin-name"
            [label]="text().adminName"
            [required]="true"
            ><input pInputText id="merchant-admin-name" formControlName="adminName"
          /></osnova-form-field>
          <osnova-form-field
            controlId="merchant-admin-email"
            [label]="text().email"
            [required]="true"
            ><input pInputText id="merchant-admin-email" type="email" formControlName="adminEmail"
          /></osnova-form-field>
          <osnova-form-field
            controlId="merchant-password"
            [label]="text().password"
            [required]="true"
            ><input pInputText id="merchant-password" type="password" formControlName="password"
          /></osnova-form-field>
          @if (createError(); as message) {
            <p-message severity="error">{{ message }}</p-message>
          }
          <button pButton type="submit" [disabled]="saving()">{{ text().save }}</button>
        </form>
      </osnova-route-drawer>
    }
  `,
})
export class MerchantsPage {
  readonly language = inject(OperatorLanguage);
  private readonly session = inject(DemoSession);
  readonly canWrite = computed(() =>
    ['ADMINISTRATOR', 'OPERATOR'].includes(this.session.user()?.role ?? ''),
  );
  private readonly api = inject(OperatorApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly injector = inject(Injector);
  private readonly table = viewChild(TablePanel);
  private confirmationController: AbortController | null = null;
  readonly url = new UrlListState(definition, () => !!this.api.scope());
  readonly pageSizes = definition.pageSizes;
  private readonly revision = signal(0);
  private readonly pageRequest = computed(() => {
    const scope = this.api.scope();
    const { page, pageSize } = this.url.state();
    return scope
      ? { scope, variables: { offset: (page - 1) * pageSize, limit: pageSize } }
      : undefined;
  });
  readonly list = resource({
    params: () => {
      const request = this.pageRequest();
      return request ? { ...request, revision: this.revision() } : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.api.merchants(params.scope, params.variables, abortSignal),
  });
  readonly page = linkedSignal<
    { request: ReturnType<MerchantsPage['pageRequest']>; data: MerchantPage | undefined },
    MerchantPage | null
  >({
    source: () => ({
      request: this.pageRequest(),
      data: this.list.hasValue() ? this.list.value() : undefined,
    }),
    computation: (current, previous) =>
      current.data ??
      (previous && previous.source.request === current.request ? previous.value : null),
  });
  readonly pagination = computed(() => ({
    page: this.url.state().page,
    pageSize: this.url.state().pageSize,
    total: this.page()?.total ?? 0,
  }));
  readonly createError = signal<string | null>(null);
  readonly statusError = linkedSignal({
    source: this.pageRequest,
    computation: (): string | null => null,
  });
  private readonly statusPending = signal(false);
  readonly statusDisabled = computed(() => this.statusPending() || this.list.isLoading());
  readonly suspensionName = signal<string | null>(null);
  readonly suspendDialogPt = computed(() =>
    confirmDialogPt(this.language.value(), 'suspend-merchant-message'),
  );
  readonly error = computed(() => {
    const error = this.list.error();
    return error ? requestError(error, this.text().unavailable) : null;
  });
  readonly saving = signal(false);
  readonly drawer = signal(false);
  readonly text = computed(() => strings[this.language.value()]);
  readonly columns = computed<readonly TableColumn[]>(() => {
    const text = this.text();
    const columns: TableColumn[] = [
      { id: 'name', label: text.name, width: 'auto', kind: 'identity' },
      { id: 'status', label: text.status, width: '6rem', kind: 'status' },
      {
        id: 'shops',
        label: text.shops,
        width: '6rem',
        kind: 'number',
        className: 'app-table-merged-column',
      },
    ];
    if (this.canWrite()) {
      columns.push({ id: 'actions', label: '', width: '7rem', kind: 'actions' });
    }
    return columns;
  });
  readonly actions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'create', label: this.text().createMerchant, primary: true }] : [],
  );
  readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.error(),
      rows: this.page()?.items.length ?? null,
      filtered: false,
    }),
  );
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [(control) => Validators.required(control), Validators.maxLength(200)],
    }),
    adminName: new FormControl('', {
      nonNullable: true,
      validators: [(control) => Validators.required(control), Validators.maxLength(200)],
    }),
    adminEmail: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        (control) => Validators.email(control),
      ],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        Validators.minLength(12),
        Validators.maxLength(128),
      ],
    }),
  });
  constructor() {
    effect((onCleanup) => {
      this.pageRequest();
      onCleanup(() => this.confirmationController?.abort());
    });
    effect(() => {
      if (this.list.hasValue() && !this.list.isLoading()) {
        this.url.correctPage(Math.ceil(this.list.value().total / this.url.state().pageSize));
      }
    });
  }
  load(): void {
    this.statusError.set(null);
    this.revision.update((value) => value + 1);
  }
  open(): void {
    this.form.reset();
    this.createError.set(null);
    this.drawer.set(true);
  }
  async create(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    try {
      await this.api.createMerchant(this.language.value(), this.form.getRawValue());
      this.drawer.set(false);
      this.load();
    } catch (error: unknown) {
      this.createError.set(requestError(error, this.text().unavailable));
    } finally {
      this.saving.set(false);
    }
  }
  async toggle(row: Merchant, trigger: HTMLButtonElement): Promise<void> {
    const request = this.pageRequest();
    if (!request || !this.canWrite() || this.statusDisabled() || this.suspensionName() !== null) {
      return;
    }
    const { id: tenantId, name, status } = row;
    const language = request.scope.language;
    try {
      if (status === 'ACTIVE') {
        const sameName = this.page()?.items.some(
          (item) => item.id !== tenantId && item.name === name,
        );
        this.suspensionName.set(sameName ? `${name} · ${tenantId}` : name);
        const controller = new AbortController();
        this.confirmationController = controller;
        const accepted = await confirmAction(this.confirmation, language, {
          header: this.text().suspendMerchantTitle,
          acceptLabel: this.text().suspend,
          danger: true,
          signal: controller.signal,
        });
        this.confirmationController = null;
        if (controller.signal.aborted || this.pageRequest() !== request) {
          return;
        }
        afterNextRender(
          () => {
            if (!accepted && trigger.isConnected) {
              trigger.focus();
            } else {
              this.table()?.focusHeading();
            }
          },
          { injector: this.injector },
        );
        if (!accepted) {
          return;
        }
      }
      this.statusPending.set(true);
      await this.api.setMerchantStatus(
        language,
        tenantId,
        status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      );
      this.load();
    } catch (error: unknown) {
      this.statusError.set(requestError(error, this.text().unavailable));
    } finally {
      this.statusPending.set(false);
      this.suspensionName.set(null);
    }
  }
}
