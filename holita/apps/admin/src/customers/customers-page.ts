import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { OperatorLanguage, operatorStrings } from '@holita/operator';
import { PageHeader, TablePanel, tableView, trackById, type TableColumn } from '@osnova/ui';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import type { OperatorCustomersQuery } from '../generated/customers-operations';
import { CustomersApi } from './customers-api';

type CustomerRows = OperatorCustomersQuery['customers'];

@Component({
  selector: 'holita-customers-page',
  imports: [Message, PageHeader, RouterLink, TableModule, TablePanel],
  templateUrl: './customers-page.html',
  host: { class: 'app-view' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersPage {
  private readonly api = inject(CustomersApi);
  protected readonly language = inject(OperatorLanguage).value;
  protected readonly text = computed(() => operatorStrings[this.language()]);
  protected readonly scope = this.api.scope;
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
  protected readonly list = resource({
    params: () => this.scope() ?? undefined,
    loader: ({ params }) => this.api.list(params),
  });
  protected readonly rows = linkedSignal<
    { scope: ReturnType<CustomersApi['scope']>; data: CustomerRows | undefined },
    CustomerRows | null
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
      rows: this.rows()?.length ?? null,
      filtered: false,
    }),
  );
}
