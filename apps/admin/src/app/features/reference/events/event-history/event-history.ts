import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  type OnChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { TableModule } from 'primeng/table';
import { Subject, switchMap, catchError, EMPTY } from 'rxjs';
import type { AdminEventHistoryQuery } from '../../../../../generated/graphql/operations';
import { requestError } from '../../../../core/graphql/request-error';
import { messages, type Language } from '../../../../i18n/messages';
import { EventsApi } from '../events-api';
import { eventTime, formatEventTime } from '../event-time';
import { historyFieldLabel, historyOperationLabel, historyValue } from '../event-history-values';

@Component({
  selector: 'holita-event-history',
  imports: [ButtonDirective, Message, Paginator, TableModule],
  templateUrl: './event-history.html',
  styleUrl: './event-history.scss',
})
export class EventHistory implements OnChanges {
  readonly eventId = input.required<string>();
  readonly language = input.required<Language>();
  readonly revision = input(0);
  readonly text = computed(() => messages[this.language()]);
  readonly pageNumber = signal(1);
  readonly page = signal<AdminEventHistoryQuery['referenceEventHistory'] | null>(null);
  readonly expanded = signal<string[]>([]);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly operation = historyOperationLabel;
  readonly field = historyFieldLabel;
  readonly value = historyValue;
  private readonly api = inject(EventsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reads = new Subject<void>();
  constructor() {
    this.reads
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.error.set(null);
          return this.api
            .watchHistory({
              eventId: this.eventId(),
              offset: (this.pageNumber() - 1) * 20,
              limit: 20,
            })
            .valueChanges.pipe(
              catchError((error: unknown) => {
                this.loading.set(false);
                this.error.set(error);
                return EMPTY;
              }),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error) {
          const page = result.data.referenceEventHistory;
          const last = Math.max(1, Math.ceil(page.total / 20));
          if (this.pageNumber() > last && !result.loading) {
            this.pageNumber.set(last);
            this.refresh();
          } else this.page.set(page);
        }
      });
  }
  ngOnChanges(): void {
    this.pageNumber.set(1);
    this.page.set(null);
    this.expanded.set([]);
    this.refresh();
  }
  refresh(): void {
    this.reads.next();
  }
  changePage(state: PaginatorState): void {
    this.pageNumber.set((state.page ?? 0) + 1);
    this.page.set(null);
    this.expanded.set([]);
    this.refresh();
  }
  toggle(id: string): void {
    this.expanded.update((values) =>
      values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
    );
  }
  date(value: string): string {
    return `${formatEventTime(value, this.language())} ${eventTime(value).format('Z')}`;
  }
}
