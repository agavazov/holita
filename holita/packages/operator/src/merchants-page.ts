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
import { RouterLink } from '@angular/router';
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
  selector: 'holita-merchants-page',
  imports: [
    PageHeader,
    TablePanel,
    TableModule,
    ButtonDirective,
    RouterLink,
    RouteDrawer,
    ReactiveFormsModule,
    InputText,
    FormField,
    Message,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <osnova-page-header [title]="text().merchants" [actions]="actions()" (action)="open()" />
    <osnova-table-panel
      [heading]="text().merchants"
      [view]="view()"
      [total]="rows()?.length ?? null"
      [errorText]="error()"
      (retry)="load()"
    >
      <p-table [value]="rows() ?? []">
        <ng-template #header
          ><tr>
            <th>{{ text().name }}</th>
            <th>{{ text().status }}</th>
            <th>{{ text().shops }}</th>
            @if (canWrite()) {
              <th></th>
            }</tr
        ></ng-template>
        <ng-template #body let-row
          ><tr>
            <td>
              <a [routerLink]="['/', language.value(), 'merchants', row.id]">{{ row.name }}</a>
            </td>
            <td>{{ row.status === 'ACTIVE' ? text().active : text().suspended }}</td>
            <td>{{ row.branchCount }}</td>
            @if (canWrite()) {
              <td>
                <button pButton type="button" severity="secondary" (click)="toggle(row)">
                  {{ row.status === 'ACTIVE' ? text().suspend : text().reactivate }}
                </button>
              </td>
            }
          </tr></ng-template
        >
      </p-table>
    </osnova-table-panel>
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
          @if (error(); as message) {
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
  readonly rows = signal<Merchant[] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly drawer = signal(false);
  readonly text = computed(() => strings[this.language.value()]);
  readonly actions = computed<readonly PageHeaderAction[]>(() =>
    this.canWrite() ? [{ id: 'create', label: this.text().createMerchant, primary: true }] : [],
  );
  readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.rows()?.length ?? null,
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
      this.rows.set(await this.api.merchants(this.language.value()));
      this.error.set(null);
    } catch (error: unknown) {
      this.error.set(requestError(error, this.text().unavailable));
    } finally {
      this.loading.set(false);
    }
  }
  open(): void {
    this.form.reset();
    this.error.set(null);
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
      await this.load();
    } catch (error: unknown) {
      this.error.set(requestError(error, this.text().unavailable));
    } finally {
      this.saving.set(false);
    }
  }
  async toggle(row: Merchant): Promise<void> {
    try {
      await this.api.setMerchantStatus(
        this.language.value(),
        row.id,
        row.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
      );
      await this.load();
    } catch (error: unknown) {
      this.error.set(requestError(error, this.text().unavailable));
    }
  }
}
