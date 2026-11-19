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

@Component({
  selector: 'holita-merchant-detail',
  imports: [
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
      [backLabel]="text().merchants"
      [actions]="actions()"
      (action)="drawer.set(true)"
    />
    <osnova-table-panel
      [heading]="text().shops"
      [view]="view()"
      [total]="merchant()?.branches?.length ?? null"
      [errorText]="error()"
      (retry)="load()"
    >
      <p-table [value]="merchant()?.branches ?? []"
        ><ng-template #header
          ><tr>
            <th>{{ text().name }}</th>
            <th>{{ text().status }}</th>
            @if (canWrite()) {
              <th></th>
            }</tr></ng-template
        ><ng-template #body let-row
          ><tr>
            <td>{{ row.name }}</td>
            <td>{{ row.status === 'ACTIVE' ? text().active : text().suspended }}</td>
            @if (canWrite()) {
              <td>
                <button pButton type="button" severity="secondary" (click)="toggle(row)">
                  {{ row.status === 'ACTIVE' ? text().suspend : text().reactivate }}
                </button>
              </td>
            }
          </tr></ng-template
        ></p-table
      >
    </osnova-table-panel>
    @if (drawer()) {
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
          @if (error(); as message) {
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
  readonly canWrite = computed(() =>
    ['ADMINISTRATOR', 'OPERATOR'].includes(this.session.user()?.role ?? ''),
  );
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OperatorApi);
  readonly merchant = signal<Merchant | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly drawer = signal(false);
  readonly saving = signal(false);
  readonly text = computed(() => strings[this.language.value()]);
  readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.merchant()?.branches.length ?? null,
      filtered: false,
    }),
  );
  readonly actions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'create', label: this.text().createShop, primary: true }] : [],
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
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id');
      this.merchant.set(
        (await this.api.merchants(this.language.value())).find((row) => row.id === id) ?? null,
      );
      this.error.set(null);
    } catch (error: unknown) {
      this.error.set(requestError(error, this.text().unavailable));
    } finally {
      this.loading.set(false);
    }
  }
  async create(): Promise<void> {
    this.form.markAllAsTouched();
    const merchant = this.merchant();
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
      this.error.set(requestError(error, this.text().unavailable));
    } finally {
      this.saving.set(false);
    }
  }
  async toggle(row: Merchant['branches'][number]): Promise<void> {
    const merchant = this.merchant();
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
      this.error.set(requestError(error, this.text().unavailable));
    }
  }
}
