import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TablePanel, UI_LANGUAGE, tableView, type TableColumn, type TablePage } from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import {
  offerLabel,
  offerPrice,
  offerStatusLabel,
  offerStatusSeverity,
  offerStrings,
  quoteKinds,
} from './offer';
import { OffersApi } from './offers-api';

@Component({
  selector: 'holita-lead-offers',
  imports: [TablePanel, TableModule, ButtonDirective, RouterLink, Tag],
  templateUrl: './lead-offers.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeadOffers {
  readonly leadId = input.required<string>();
  readonly add = output();
  private readonly api = inject(OffersApi);
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => offerStrings[this.language()]);
  protected readonly label = offerLabel;
  protected readonly price = offerPrice;
  protected readonly statusLabel = offerStatusLabel;
  protected readonly statusSeverity = offerStatusSeverity;
  protected readonly quoteKinds = quoteKinds;
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    { id: 'recipient', label: this.text().recipientName, width: 'auto', kind: 'identity' },
    { id: 'status', label: this.text().status, width: '8rem', kind: 'status' },
  ]);
  protected readonly page = linkedSignal({
    source: this.leadId,
    computation: () => ({ page: 1, pageSize: 20 }),
  });
  protected readonly list = resource({
    params: () => {
      const scope = this.api.scope();
      const { page, pageSize } = this.page();
      const leadId = this.leadId();
      return scope
        ? { scope, variables: { leadId, offset: (page - 1) * pageSize, limit: pageSize } }
        : undefined;
    },
    loader: ({ params, abortSignal }) => this.api.list(params.scope, params.variables, abortSignal),
  });
  protected readonly result = computed(() => (this.list.hasValue() ? this.list.value() : null));
  protected readonly pagination = computed(() => ({
    ...this.page(),
    total: this.result()?.total ?? 0,
  }));
  protected readonly view = computed(() =>
    tableView({
      loading: this.list.isLoading(),
      error: this.list.error(),
      rows: this.result()?.items.length ?? null,
      filtered: false,
    }),
  );

  refresh(): void {
    this.list.reload();
  }

  protected selectPage(page: Pick<TablePage, 'page' | 'pageSize'>): void {
    this.page.set(page);
  }
}
