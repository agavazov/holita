import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Times } from '@primeicons/angular/times';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';
import { confirmAction, confirmDialogPt } from '../confirm';
import { EmptyState } from '../empty-state/empty-state';
import { formatNumber, localeOf } from '../format/format';
import { interpolate, uiMessages } from '../i18n/messages';
import type { ListActionBase, ListActionRequest, ListRecord } from '../list/list-actions';
import { UI_LANGUAGE } from '../ui-language';
import type { TableView } from './table-view';

export interface TablePage {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

interface PendingConfirm {
  readonly detail: string | null;
  readonly records: readonly ListRecord<string>[];
  readonly skipped: number;
}

let nextId = 0;

/**
 * A list panel: heading and count, the six list states, refresh bar, the paginator of
 * the standard list contract, and the list's actions. The host projects its `p-table`; row menus
 * and record links call `run()`, the bulk bar offers the `bulk` actions for the selection, and
 * both confirm the same way before `action` is emitted with the IDs the action applies to.
 */
@Component({
  selector: 'holita-table-panel',
  imports: [ButtonDirective, ConfirmDialog, Message, Paginator, Skeleton, EmptyState, Times],
  providers: [ConfirmationService],
  templateUrl: './table-panel.html',
  styleUrl: './table-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablePanel<A extends string = string> {
  readonly heading = input.required<string>();
  readonly headingLevel = input<2 | 3>(2);
  readonly total = input<number | null>(null);
  readonly view = input.required<TableView>();
  readonly errorText = input<string | null>(null);
  readonly busy = input(false);
  /** Query identity: a changed context retires unsubmitted confirmations. */
  readonly actionContext = input<unknown>(null);
  readonly emptyTitle = input<string | null>(null);
  readonly emptyDescription = input<string | null>(null);
  /** The list's actions, defined once for row menus and the bulk bar. */
  readonly actions = input<readonly ListActionBase<A>[]>([]);
  /** The selected rows of the shown page. */
  readonly selection = input<readonly ListRecord<A>[]>([]);
  readonly selectionProgress = input<string | null>(null);
  readonly page = input<TablePage | null>(null);
  readonly pageSizes = input<readonly number[]>([10, 20, 50, 100]);
  readonly skeletonRows = input<number | null>(null);
  readonly action = output<ListActionRequest<A>>();
  readonly retry = output();
  readonly clearFilters = output();
  readonly clearSelection = output();
  readonly pageChange = output<{ page: number; pageSize: number }>();

  protected readonly id = `table-panel-${String(nextId++)}`;
  private readonly language = inject(UI_LANGUAGE);
  private readonly confirmation = inject(ConfirmationService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private actionGeneration = 0;
  private confirmationController: AbortController | null = null;
  private readonly headingElement = viewChild<ElementRef<HTMLElement>>('headingElement');
  protected readonly text = computed(() => uiMessages[this.language()]);
  protected readonly locale = computed(() => localeOf(this.language()));
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), `${this.id}-confirm`),
  );
  protected readonly pending = signal<PendingConfirm | null>(null);
  /** No count while the first answer is loading or failed: it would describe rows not shown. */
  protected readonly totalText = computed(() => {
    const total = this.total();
    const kind = this.view().kind;
    if (total === null || kind === 'loading' || kind === 'error') {
      return null;
    }
    return formatNumber(total, this.language());
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
      count: formatNumber(this.selection().length, this.language()),
    }),
  );
  /** The bulk bar: each bulk action with the number of selected records it applies to. */
  protected readonly bulkActions = computed(() =>
    this.actions()
      .filter((action) => action.bulk)
      .map((action) => ({
        action,
        applicable: this.selection().filter((record) => !record.unavailable.includes(action.id))
          .length,
      })),
  );
  /** The configured sizes plus the current one, so the dropdown always shows the size in use. */
  protected readonly pageSizeOptions = computed(() => {
    const current = this.page()?.pageSize;
    const sizes = new Set(this.pageSizes());
    if (current) {
      sizes.add(current);
    }
    return [...sizes].sort((left, right) => left - right);
  });
  protected readonly first = computed(() => {
    const page = this.page();
    return page ? (page.page - 1) * page.pageSize : 0;
  });
  /** The footer and its paginator whenever rows are shown; none for empty or unmatched lists. */
  protected readonly showFooter = computed(() => {
    const page = this.page();
    return !!page && page.total > 0 && this.showTable();
  });
  /** Page links and first/last only when the rows do not fit on one page. */
  protected readonly multiPage = computed(() => {
    const page = this.page();
    return !!page && page.total > page.pageSize;
  });

  constructor() {
    effect(() => {
      this.actionContext();
      this.retireActions();
    });
    this.destroyRef.onDestroy(() => {
      this.retireActions();
    });
  }

  private retireActions(): void {
    this.actionGeneration++;
    this.confirmationController?.abort();
    this.confirmationController = null;
    this.pending.set(null);
  }

  private alive(): boolean {
    return !this.destroyRef.destroyed;
  }

  /** Moves focus to the panel heading (after rows or the bulk bar went away). */
  focusHeading(): void {
    this.headingElement()?.nativeElement.focus();
  }

  /**
   * Runs one of the list's actions on records (a row, or the selection from the bulk bar):
   * leaves out records it does not apply to, confirms when the action asks, then emits. Focus
   * returns to `origin` after Cancel and after a confirmed row action; a destructive or bulk
   * action moves it to the heading, because the row or the bar is about to disappear, and so
   * does any row action whose change took `origin` out of the list (e.g. under a filter).
   */
  async run(
    actionId: A,
    records: readonly ListRecord<A>[],
    origin: EventTarget | null,
    source: 'row' | 'bulk' = 'row',
  ): Promise<void> {
    if (!this.alive() || this.confirmationController !== null) {
      return;
    }
    const element = origin instanceof HTMLElement ? origin : null;
    const generation = this.actionGeneration;
    const action = this.actions().find((candidate) => candidate.id === actionId);
    if (!action) {
      return;
    }
    const applicable = records.filter((record) => !record.unavailable.includes(action.id));
    if (!applicable.length) {
      return;
    }
    if (action.confirm) {
      const accepted = await this.ask(action, applicable, records.length - applicable.length);
      if (!this.alive()) {
        return;
      }
      if (generation !== this.actionGeneration) {
        this.restoreActionFocus(null);
        return;
      }
      if (!accepted) {
        this.restoreActionFocus(element);
        return;
      }
    }
    // A refresh does not disable actions. The concrete host guards writes already in flight.
    this.action.emit({ action: action.id, ids: applicable.map((record) => record.id) });
    if (action.danger || source === 'bulk') {
      this.afterRender(() => {
        this.focusHeading();
      });
      return;
    }
    this.afterRender(() => {
      if (!element) {
        return;
      }
      if (!element.isConnected) {
        this.focusHeading();
      }
      // A row the change re-sorted is moved in the DOM, which drops its focus to the body.
      else if (
        action.confirm ||
        element.ownerDocument.activeElement === element.ownerDocument.body
      ) {
        element.focus();
      }
    });
  }

  protected changePage(event: PaginatorState): void {
    const rows = event.rows ?? this.page()?.pageSize ?? 20;
    const page = event.page ?? Math.floor((event.first ?? 0) / rows);
    this.pageChange.emit({ page: page + 1, pageSize: rows });
  }

  private restoreActionFocus(element: HTMLElement | null): void {
    this.afterRender(() => {
      if (!this.alive()) {
        return;
      }
      if (element?.isConnected && !element.matches(':disabled')) {
        element.focus();
        if (element.ownerDocument.activeElement === element) {
          return;
        }
      }
      this.focusHeading();
    });
  }

  private ask(
    action: ListActionBase<A>,
    records: readonly ListRecord<A>[],
    skipped: number,
  ): Promise<boolean> {
    const confirm = action.confirm;
    if (!confirm) {
      return Promise.resolve(true);
    }
    this.pending.set({
      detail: confirm.detail ?? null,
      records,
      skipped,
    });
    const controller = new AbortController();
    this.confirmationController = controller;
    return confirmAction(this.confirmation, this.language(), {
      header: confirm.title,
      acceptLabel: confirm.accept,
      danger: action.danger ?? false,
      signal: controller.signal,
    }).finally(() => {
      if (this.confirmationController === controller) {
        this.confirmationController = null;
        this.pending.set(null);
      }
    });
  }

  protected confirmRecordsText(count: number): string {
    return interpolate(this.text().table.confirmRecords, {
      count: formatNumber(count, this.language()),
    });
  }

  protected skippedText(skipped: number): string {
    return interpolate(this.text().table.skippedRecords, {
      count: formatNumber(skipped, this.language()),
    });
  }

  private afterRender(callback: () => void): void {
    afterNextRender(callback, { injector: this.injector });
  }
}
