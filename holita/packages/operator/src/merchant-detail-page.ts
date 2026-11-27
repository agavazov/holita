import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import {
  EmptyState,
  FormField,
  PageHeader,
  RouteDrawer,
  TablePanel,
  tableView,
  type PageHeaderAction,
} from '@osnova/ui';
import { DemoSession, requestError } from '@osnova/ui/app';
import { OperatorLanguage } from './application';
import { OperatorApi } from './operator-api';
import { operatorStrings as strings } from './strings';
import type { OperatorMerchantsQuery } from './generated/operations';

type Merchant = OperatorMerchantsQuery['merchants'][number];

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
    RouteDrawer,
    ReactiveFormsModule,
    InputText,
    FormField,
    Message,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <osnova-page-header
      [title]="merchant()?.name ?? text().merchants"
      [backLink]="['/', language.value(), 'merchants']"
      [backLabel]="text().backToMerchants"
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
        [view]="view()"
        [total]="merchant()?.branches.length ?? null"
        [emptyTitle]="text().shopsEmpty"
        [errorText]="tableError()"
        (retry)="load()"
      >
        <p-table [value]="merchant()?.branches ?? []">
          <ng-template #header>
            <tr>
              <th>{{ text().name }}</th>
              <th>{{ text().status }}</th>
              @if (writableMerchant()) {
                <th></th>
              }
            </tr>
          </ng-template>
          <ng-template #body let-row>
            <tr>
              <td>{{ row.name }}</td>
              <td>{{ row.status === 'ACTIVE' ? text().active : text().suspended }}</td>
              @if (writableMerchant()) {
                <td>
                  <button pButton type="button" severity="secondary" (click)="toggle(row)">
                    {{ row.status === 'ACTIVE' ? text().suspend : text().reactivate }}
                  </button>
                </td>
              }
            </tr>
          </ng-template>
        </p-table>
      </osnova-table-panel>
    }
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
  readonly state = signal<MerchantDetailState>({ kind: 'loading' });
  readonly merchant = computed(() => {
    const state = this.state();
    return state.kind === 'ready' ? state.merchant : null;
  });
  readonly writableMerchant = computed(() =>
    ['ADMINISTRATOR', 'OPERATOR'].includes(this.session.user()?.role ?? '')
      ? this.merchant()
      : null,
  );
  private readonly shopStatusError = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly drawer = signal(false);
  readonly saving = signal(false);
  readonly text = computed(() => strings[this.language.value()]);
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
    effect(() => {
      this.language.value();
      untracked(() => {
        void this.load();
      });
    });
  }
  async load(): Promise<void> {
    this.state.set({ kind: 'loading' });
    this.shopStatusError.set(null);
    try {
      const id = this.route.snapshot.paramMap.get('id');
      const merchant = (await this.api.merchants(this.language.value())).find((row) => row.id === id);
      this.state.set(merchant ? { kind: 'ready', merchant } : { kind: 'missing' });
    } catch (error: unknown) {
      this.state.set({ kind: 'error', message: requestError(error, this.text().unavailable) });
    }
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
      await this.load();
    } catch (error: unknown) {
      this.createError.set(requestError(error, this.text().unavailable));
    } finally {
      this.saving.set(false);
    }
  }
  async toggle(row: Merchant['branches'][number]): Promise<void> {
    const merchant = this.writableMerchant();
    if (!merchant) {
      return;
    }
    try {
      await this.api.setBranchStatus(
        this.language.value(),
        merchant.id,
        row.id,
        row.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      );
      await this.load();
    } catch (error: unknown) {
      this.shopStatusError.set(requestError(error, this.text().unavailable));
    }
  }
}
