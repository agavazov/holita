import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Times } from '@primeicons/angular/times';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';
import { EmptyState } from '../empty-state/empty-state';
import { formatNumber, localeOf } from '../format/format';
import { interpolate, uiMessages } from '../i18n/messages';
import { UI_LANGUAGE } from '../ui-language';
import type { TableView } from './table-view';

export interface TableNotice {
  readonly severity: 'success' | 'warn' | 'error';
  readonly text: string;
}

export interface TablePage {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

let nextId = 0;

/**
 * A list panel: heading and count, the six list states, refresh bar, notices, floating bulk bar
 * and the paginator of the standard list contract. The host projects its `p-table`.
 */
@Component({
  selector: 'holita-table-panel',
  imports: [ButtonDirective, Message, Paginator, Skeleton, EmptyState, Times],
  templateUrl: './table-panel.html',
  styleUrl: './table-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablePanel {
  readonly heading = input.required<string>();
  readonly headingLevel = input<2 | 3>(2);
  readonly total = input<number | null>(null);
  readonly view = input.required<TableView>();
  readonly errorText = input<string | null>(null);
  readonly busy = input(false);
  readonly emptyTitle = input<string | null>(null);
  readonly emptyDescription = input<string | null>(null);
  readonly notice = input<TableNotice | null>(null);
  readonly selectedCount = input(0);
  readonly selectionProgress = input<string | null>(null);
  readonly page = input<TablePage | null>(null);
  readonly pageSizes = input<readonly number[]>([10, 20, 50, 100]);
  readonly skeletonRows = input<number | null>(null);
  readonly retry = output();
  readonly clearFilters = output();
  readonly dismissNotice = output();
  readonly clearSelection = output();
  readonly pageChange = output<{ page: number; pageSize: number }>();

  protected readonly id = `table-panel-${String(nextId++)}`;
  private readonly language = inject(UI_LANGUAGE);
  private readonly headingElement = viewChild<ElementRef<HTMLElement>>('headingElement');
  protected readonly text = computed(() => uiMessages[this.language()]);
  protected readonly locale = computed(() => localeOf(this.language()));
  protected readonly totalText = computed(() => {
    const total = this.total();
    return total === null ? null : formatNumber(total, this.language());
  });
  protected readonly showTable = computed(
    () => this.view().kind === 'rows' || this.view().kind === 'rows-error',
  );
  protected readonly skeletons = computed(() => {
    const count = this.skeletonRows() ?? Math.min(this.page()?.pageSize ?? 8, 8);
    return Array.from({ length: count }, (_, index) => index);
  });
  protected readonly selectionText = computed(() =>
    interpolate(this.text().table.selected, {
      count: formatNumber(this.selectedCount(), this.language()),
    }),
  );
  protected readonly pageSizeOptions = computed(() => [...this.pageSizes()]);
  protected readonly first = computed(() => {
    const page = this.page();
    return page ? (page.page - 1) * page.pageSize : 0;
  });

  /** Moves focus to the panel heading (after bulk actions). */
  focusHeading(): void {
    this.headingElement()?.nativeElement.focus();
  }

  protected changePage(event: PaginatorState): void {
    const rows = event.rows ?? this.page()?.pageSize ?? 20;
    const page = event.page ?? Math.floor((event.first ?? 0) / rows);
    this.pageChange.emit({ page: page + 1, pageSize: rows });
  }
}
