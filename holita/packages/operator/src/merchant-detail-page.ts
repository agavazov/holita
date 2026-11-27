import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import {
  EmptyState,
  FormField,
  PageHeader,
  RouteDrawer,
  TablePanel,
  confirmAction,
  confirmDialogPt,
  tableView,
  type PageHeaderAction,
  type TableColumn,
} from '@osnova/ui';
import { DemoSession, requestError } from '@osnova/ui/app';
import { OperatorLanguage } from './application';
import { OperatorApi } from './operator-api';
import { operatorStrings as strings } from './strings';
import type { OperatorMerchantQuery } from './generated/operations';

type Merchant = NonNullable<OperatorMerchantQuery['merchant']>;

type MerchantDetailState =
  | { kind: 'loading' | 'missing' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; merchant: Merchant };

@Component({
  selector: 'holita-merchant-detail',
  imports: [
    EmptyState,
    PageHeader,
    TablePanel,
    TableModule,
    ButtonDirective,
    ConfirmDialog,
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
      [title]="merchant()?.name ?? text().merchants"
      [backLink]="['/', language.value(), 'merchants']"
      [backQueryParams]="backQueryParams()"
      [backLabel]="text().backToMerchants"
      [moduleInfo]="text().merchantDetailsInfo"
      [actions]="actions()"
      (action)="openCreate()"
    />
    @if (state().kind === 'missing') {
      <section class="app-card">
        <osnova-empty-state kind="not-found" [title]="text().merchantNotFound" />
      </section>
    } @else {
      <osnova-table-panel
        [heading]="text().shops"
        [columns]="columns()"
        [view]="view()"
        [total]="merchant()?.branches.length ?? null"
        [emptyTitle]="text().shopsEmpty"
        [errorText]="tableError()"
        (retry)="load()"
      >
        <p-table [value]="merchant()?.branches ?? []" dataKey="id">
          <ng-template #colgroup>
            <colgroup>
              @for (column of columns(); track column.id) {
                <col [style.width]="column.width" />
              }
            </colgroup>
          </ng-template>
          <ng-template #header>
            <tr>
              @for (column of columns(); track column.id) {
                <th scope="col">{{ column.label }}</th>
              }
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td>{{ row.name }}</td>
              <td>{{ row.status === 'ACTIVE' ? text().active : text().suspended }}</td>
              @if (writableMerchant()) {
                <td>
                  <button
                    #statusButton
                    pButton
                    type="button"
                    severity="secondary"
                    [disabled]="statusPending()"
                    (click)="toggle(row, statusButton)"
                  >
                    {{ row.status === 'ACTIVE' ? text().suspend : text().reactivate }}
                  </button>
                </td>
              }
            </tr>
          </ng-template>
        </p-table>
      </osnova-table-panel>
    }
    <p-confirmdialog
      appendTo="body"
      [pt]="suspendDialogPt()"
      [style]="{ width: 'min(28rem, calc(100vw - var(--p-app-space-8)))' }"
    >
      <ng-template #message>
        <div id="suspend-shop-message" class="app-stack">
          <strong style="overflow-wrap: anywhere">{{ suspensionName() }}</strong>
          <p>{{ text().suspendShopEffect }}</p>
        </div>
      </ng-template>
    </p-confirmdialog>
    @if (drawer() && writableMerchant()) {
      <osnova-route-drawer
        [title]="text().createShop"
        [closeLink]="null"
        [saving]="saving()"
        [dirty]="form.dirty"
        (closeRequest)="drawer.set(false)"
      >
        <form [formGroup]="form" (ngSubmit)="create()" class="app-form-section">
          <osnova-form-field controlId="shop-name" [label]="text().name" [required]="true"
            ><input pInputText id="shop-name" formControlName="name"
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
export class MerchantDetailPage {
  readonly language = inject(OperatorLanguage);
  private readonly session = inject(DemoSession);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OperatorApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly injector = inject(Injector);
  private readonly table = viewChild(TablePanel);
  private confirmationController: AbortController | null = null;
  private readonly tenantId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    {
      requireSync: true,
    },
  );
  readonly backQueryParams = toSignal(this.route.queryParams, { requireSync: true });
  private readonly revision = signal(0);
  private readonly record = resource({
    params: () => {
      const scope = this.api.scope();
      const tenantId = this.tenantId();
      return scope && tenantId ? { scope, tenantId, revision: this.revision() } : undefined;
    },
    loader: ({ params, abortSignal }) =>
      this.api.merchant(params.scope, params.tenantId, abortSignal),
  });
  readonly state = computed<MerchantDetailState>(() => {
    const error = this.record.error();
    if (error) {
      return { kind: 'error', message: requestError(error, this.text().unavailable) };
    }
    if (this.record.isLoading() || !this.record.hasValue()) {
      return { kind: 'loading' };
    }
    const merchant = this.record.value();
    return merchant ? { kind: 'ready', merchant } : { kind: 'missing' };
  });
  readonly merchant = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.merchant : null;
  });
  private readonly canWrite = computed(() =>
    ['ADMINISTRATOR', 'OPERATOR'].includes(this.session.user()?.role ?? ''),
  );
  readonly writableMerchant = computed(() => (this.canWrite() ? this.merchant() : null));
  private readonly shopStatusError = signal<string | null>(null);
  readonly statusPending = signal(false);
  readonly suspensionName = signal<string | null>(null);
  readonly suspendDialogPt = computed(() =>
    confirmDialogPt(this.language.value(), 'suspend-shop-message'),
  );
  readonly createError = signal<string | null>(null);
  readonly drawer = signal(false);
  readonly saving = signal(false);
  readonly text = computed(() => strings[this.language.value()]);
  readonly columns = computed<readonly TableColumn[]>(() => {
    const text = this.text();
    const columns: TableColumn[] = [
      { id: 'name', label: text.name, width: 'auto', kind: 'identity' },
      { id: 'status', label: text.status, width: '6rem', kind: 'status' },
    ];
    if (this.canWrite()) {
      columns.push({ id: 'actions', label: '', width: '7rem', kind: 'actions' });
    }
    return columns;
  });
  readonly tableError = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : this.shopStatusError();
  });
  readonly view = computed(() =>
    tableView({
      loading: this.state().kind === 'loading',
      error: this.tableError(),
      rows: this.merchant()?.branches.length ?? null,
      filtered: false,
    }),
  );
  readonly actions = computed<readonly PageHeaderAction[]>(() =>
    this.writableMerchant() ? [{ id: 'create', label: this.text().createShop, primary: true }] : [],
  );
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [(control) => Validators.required(control), Validators.maxLength(200)],
    }),
  });
  constructor() {
    effect((onCleanup) => {
      this.api.scope();
      this.tenantId();
      onCleanup(() => this.confirmationController?.abort());
    });
  }
  load(): void {
    this.shopStatusError.set(null);
    this.revision.update((value) => value + 1);
  }
  openCreate(): void {
    this.createError.set(null);
    this.drawer.set(true);
  }
  async create(): Promise<void> {
    this.form.markAllAsTouched();
    const merchant = this.writableMerchant();
    if (this.form.invalid || !merchant) {
      return;
    }
    this.saving.set(true);
    try {
      await this.api.createBranch(
        this.language.value(),
        merchant.id,
        this.form.controls.name.value,
      );
      this.drawer.set(false);
      this.form.reset();
      this.load();
    } catch (error: unknown) {
      this.createError.set(requestError(error, this.text().unavailable));
    } finally {
      this.saving.set(false);
    }
  }
  async toggle(row: Merchant['branches'][number], trigger: HTMLButtonElement): Promise<void> {
    const scope = this.api.scope();
    const merchant = this.writableMerchant();
    if (!scope || !merchant || this.statusPending() || this.suspensionName() !== null) {
      return;
    }
    const tenantId = merchant.id;
    const { id: branchId, name, status } = row;
    const language = scope.language;
    try {
      if (status === 'ACTIVE') {
        const sameName = merchant.branches.some(
          (shop) => shop.id !== branchId && shop.name === name,
        );
        this.suspensionName.set(sameName ? `${name} · ${branchId}` : name);
        const controller = new AbortController();
        this.confirmationController = controller;
        const accepted = await confirmAction(this.confirmation, language, {
          header: this.text().suspendShopTitle,
          acceptLabel: this.text().suspend,
          danger: true,
          signal: controller.signal,
        });
        this.confirmationController = null;
        if (
          controller.signal.aborted ||
          this.api.scope() !== scope ||
          this.writableMerchant()?.id !== tenantId
        ) {
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
      await this.api.setBranchStatus(
        language,
        tenantId,
        branchId,
        status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      );
      this.load();
    } catch (error: unknown) {
      this.shopStatusError.set(requestError(error, this.text().unavailable));
    } finally {
      this.statusPending.set(false);
      this.suspensionName.set(null);
    }
  }
}
