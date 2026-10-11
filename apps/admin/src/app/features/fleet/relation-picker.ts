import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  type ElementRef,
  type OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Subject,
  ReplaySubject,
  catchError,
  switchMap,
  tap,
  timer,
  type Observable,
} from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Listbox } from 'primeng/listbox';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Paginator, type PaginatorState } from 'primeng/paginator';
import { messages, type Language } from '../../i18n/messages';
import { requestError } from '../../core/graphql/request-error';
export interface RelationRow {
  id: string;
  name: string;
}
export interface RelationPage {
  items: RelationRow[];
  total: number;
}
export interface RelationRequest {
  search?: string;
  offset: number;
  ids?: string[];
}
export type RelationLoader = (request: RelationRequest) => Observable<RelationPage>;

@Component({
  selector: 'holita-relation-picker',
  imports: [FormsModule, ButtonDirective, Dialog, Listbox, InputText, Message, Paginator],
  templateUrl: './relation-picker.html',
  styleUrl: './relation-picker.scss',
})
export class RelationPicker implements OnInit {
  readonly language = input.required<Language>();
  readonly label = input.required<string>();
  readonly controlId = input.required<string>();
  readonly selectedIds = input<string[]>([]);
  readonly selectedIdsChange = output<string[]>();
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly load = input.required<RelationLoader>();
  readonly text = computed(() => messages[this.language()]);
  readonly open = signal(false);
  readonly search = signal('');
  readonly offset = signal(0);
  readonly page = signal<RelationPage>({ items: [], total: 0 });
  readonly selectedRows = signal<RelationRow[]>([]);
  readonly choicesError = signal<unknown>(null);
  readonly selectedError = signal<unknown>(null);
  readonly error = computed(() => this.choicesError() ?? this.selectedError());
  readonly loading = signal(false);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly selectedLabel = computed(() =>
    this.selectedIds()
      .map((id) => {
        const row =
          this.selectedRows().find((row) => row.id === id) ??
          this.page().items.find((row) => row.id === id);
        return row ? row.name : id;
      })
      .join(', '),
  );
  private readonly searchElement = viewChild<ElementRef<HTMLInputElement>>('searchElement');
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly destroyRef = inject(DestroyRef);
  private readonly reads = new Subject<RelationRequest | null>();
  private readonly selectedReads = new ReplaySubject<string[]>(1);
  private readonly edits = new Subject<string | null>();
  constructor() {
    effect(() => {
      this.selectedReads.next([...this.selectedIds()]);
    });
    effect(() => {
      if (this.disabled() && this.open()) this.close();
    });
  }
  ngOnInit(): void {
    this.reads
      .pipe(
        switchMap((request) => {
          this.choicesError.set(null);
          this.loading.set(request !== null);
          return request === null
            ? EMPTY
            : this.load()(request).pipe(
                tap((page) => {
                  this.page.set(page);
                  this.loading.set(false);
                }),
                catchError((error: unknown) => {
                  this.choicesError.set(error);
                  this.loading.set(false);
                  return EMPTY;
                }),
              );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.selectedReads
      .pipe(
        switchMap((ids) => {
          this.selectedError.set(null);
          this.selectedRows.set([]);
          return ids.length
            ? this.load()({ ids, offset: 0 }).pipe(
                tap((page) => {
                  this.selectedRows.set(page.items);
                }),
                catchError((error: unknown) => {
                  this.selectedError.set(error);
                  return EMPTY;
                }),
              )
            : EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
    this.edits
      .pipe(
        switchMap((value) => (value === null ? EMPTY : timer(250))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.open()) {
          this.offset.set(0);
          this.fetch();
        }
      });
  }
  show(): void {
    if (this.disabled()) return;
    this.edits.next(null);
    this.search.set('');
    this.offset.set(0);
    this.page.set({ items: [], total: 0 });
    this.open.set(true);
    this.fetch();
  }
  focusSearch(): void {
    this.searchElement()?.nativeElement.focus();
  }
  close(): void {
    this.edits.next(null);
    this.open.set(false);
    this.reads.next(null);
    this.trigger()?.nativeElement.focus();
  }
  editSearch(value: unknown): void {
    if (typeof value === 'string') {
      this.search.set(value);
      this.reads.next(null);
      this.page.set({ items: [], total: 0 });
      this.edits.next(value);
    }
  }
  fetch(): void {
    const search = Array.from(this.search().replaceAll('\0', '').trim()).slice(0, 200).join('');
    this.search.set(search);
    this.reads.next({
      offset: this.offset(),
      search,
    });
  }
  retry(): void {
    this.edits.next(null);
    if (this.open()) this.fetch();
    this.selectedReads.next([...this.selectedIds()]);
  }
  changePage(event: PaginatorState): void {
    this.edits.next(null);
    this.offset.set(event.first ?? 0);
    this.fetch();
    this.focusSearch();
  }
  select(value: unknown): void {
    if (this.disabled()) return;
    const id = typeof value === 'string' ? value : undefined;
    const allowed =
      id && (this.selectedIds().includes(id) || this.page().items.some((row) => row.id === id));
    this.selectedIdsChange.emit(allowed ? [id] : []);
    this.close();
  }
  clear(): void {
    if (!this.disabled()) this.selectedIdsChange.emit([]);
  }
}
