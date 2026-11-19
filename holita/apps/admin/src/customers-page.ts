import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { PageHeader, TablePanel, tableView } from '@osnova/ui';
import { DemoSession, requestError } from '@osnova/ui/app';
import {
  OperatorApi,
  OperatorLanguage,
  operatorStrings as strings,
  type OperatorCustomersQuery,
} from '@holita/operator';

@Component({
  selector: 'holita-customers-page',
  imports: [PageHeader, TablePanel, TableModule, Message],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <osnova-page-header [title]="text().customers" />
    @if (!session.branchId()) {
      <p-message severity="info">{{ text().noShop }}</p-message>
    }
    <osnova-table-panel
      [heading]="text().customers"
      [view]="view()"
      [total]="rows()?.length ?? null"
      [errorText]="error()"
      (retry)="load()"
      ><p-table [value]="rows() ?? []"
        ><ng-template #header
          ><tr>
            <th>{{ text().name }}</th>
            <th>{{ text().email }}</th>
          </tr></ng-template
        ><ng-template #body let-row
          ><tr>
            <td>{{ row.name }}</td>
            <td>{{ row.email }}</td>
          </tr></ng-template
        ></p-table
      ></osnova-table-panel
    >
  `,
})
export class CustomersPage {
  readonly language = inject(OperatorLanguage);
  readonly session = inject(DemoSession);
  private readonly api = inject(OperatorApi);
  readonly rows = signal<OperatorCustomersQuery['customers'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly text = computed(() => strings[this.language.value()]);
  readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.rows()?.length ?? null,
      filtered: false,
    }),
  );
  constructor() {
    effect(() => {
      this.language.value();
      this.session.branchId();
      untracked(() => {
        void this.load();
      });
    });
  }
  async load(): Promise<void> {
    const branch = this.session.branchId();
    if (!branch) {
      this.rows.set(null);
      this.loading.set(false);
      return;
    }
    const token = this.session.current()?.token;
    this.loading.set(true);
    try {
      const rows = await this.api.customers(this.language.value(), branch);
      if (this.session.branchId() === branch && this.session.current()?.token === token) {
        this.rows.set(rows);
        this.error.set(null);
      }
    } catch (error: unknown) {
      if (this.session.branchId() === branch) {
        this.error.set(requestError(error, this.text().unavailable));
      }
    } finally {
      if (this.session.branchId() === branch) {
        this.loading.set(false);
      }
    }
  }
}
