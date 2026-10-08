import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type ElementRef,
  type OnInit,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Dialog } from 'primeng/dialog';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SessionsApi } from '../sessions-api';
import { messages, type Language } from '../../../../i18n/messages';
import { requestError } from '../../../../core/graphql/request-error';
import { eventTime, formatEventTime } from '../../events/event-time';
import type { AdminSessionDetailsFragment } from '../../../../../generated/graphql/operations';
@Component({
  selector: 'holita-session-program',
  imports: [RouterLink, ButtonDirective, Message, Dialog, ConfirmDialog],
  providers: [ConfirmationService],
  templateUrl: './session-program.html',
  styleUrl: './session-program.scss',
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class SessionProgram implements OnInit {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly saved = signal<AdminSessionDetailsFragment[]>([]);
  readonly draft = signal<AdminSessionDetailsFragment[] | null>(null);
  readonly rows = computed(() => this.draft() ?? this.saved());
  readonly dirty = computed(() => this.draft() !== null);
  readonly loading = signal(true);
  readonly pending = signal(false);
  readonly error = signal<unknown>(null);
  readonly writeError = signal<unknown>(null);
  readonly failure = computed(() =>
    requestError(this.error() ?? this.writeError(), this.text().networkError),
  );
  readonly deleting = signal<AdminSessionDetailsFragment | null>(null);
  readonly notice = signal('');
  readonly dragging = signal<string | null>(null);
  private readonly api = inject(SessionsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);
  private readonly document = inject(DOCUMENT);
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private query: ReturnType<SessionsApi['watchList']> | undefined;
  private leaveDecision: Promise<boolean> | undefined;
  private deleteTrigger: Element | null = null;
  ngOnInit(): void {
    this.query = this.api.watchList();
    this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.error.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error)
          this.saved.set(result.data.referenceSessions);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(error);
      },
    });
  }
  date(value: string): string {
    return `${formatEventTime(value, this.language())} ${eventTime(value).format('Z')}`;
  }
  actionLabel(key: 'sessionMoveUp' | 'sessionMoveDown' | 'sessionDrag', name: string): string {
    return this.text()[key].replace('{name}', name);
  }
  move(id: string, targetId: string): void {
    if (this.pending() || this.loading() || this.deleting() || id === targetId) return;
    const rows = this.rows(),
      from = rows.findIndex((row) => row.id === id),
      to = rows.findIndex((row) => row.id === targetId),
      row = rows[from];
    if (!row || to < 0) return;
    const next = rows.filter((item) => item.id !== id);
    next.splice(to, 0, row);
    this.draft.set(
      next.length === this.saved().length &&
        next.every((item, index) => item.id === this.saved()[index]?.id)
        ? null
        : next,
    );
    this.writeError.set(null);
    this.notice.set(
      this.text()
        .sessionMoved.replace('{name}', row.title)
        .replace('{position}', String(to + 1)),
    );
  }
  moveBy(id: string, delta: number): void {
    const index = this.rows().findIndex((row) => row.id === id),
      target = this.rows()[index + delta];
    if (target) this.move(id, target.id);
  }
  dragStart(event: DragEvent, id: string): void {
    if (this.pending() || this.loading() || this.deleting()) {
      event.preventDefault();
      return;
    }
    this.dragging.set(id);
    event.dataTransfer?.setData('text/plain', id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  dragOver(event: DragEvent): void {
    if (this.dragging()) event.preventDefault();
  }
  drop(event: DragEvent, id: string): void {
    event.preventDefault();
    const dragged = this.dragging();
    this.dragging.set(null);
    if (dragged) this.move(dragged, id);
  }
  retry(): void {
    void this.query?.refetch().catch((error: unknown) => {
      if (!this.destroyRef.destroyed) this.error.set(error);
    });
  }
  async saveOrder(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.pending() || this.loading()) return;
    this.pending.set(true);
    this.writeError.set(null);
    this.notice.set('');
    try {
      const rows = await this.api.reorder(draft.map((row) => row.id));
      if (this.destroyRef.destroyed) return;
      this.saved.set(rows);
      this.draft.set(null);
      this.notice.set(this.text().sessionOrderSaved);
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.writeError.set(error);
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
  async cancelOrder(): Promise<void> {
    if (this.pending() || this.loading() || !this.query) return;
    this.pending.set(true);
    try {
      const result = await this.query.refetch();
      if (result.error)
        throw result.error instanceof Error ? result.error : new Error(result.error.message);
      if (this.destroyRef.destroyed) return;
      this.draft.set(null);
      this.writeError.set(null);
      this.notice.set(this.text().sessionOrderRestored);
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.error.set(error);
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
  requestDelete(row: AdminSessionDetailsFragment): void {
    if (this.dirty() || this.pending() || this.loading()) return;
    this.deleteTrigger = this.document.activeElement;
    this.deleting.set(row);
    this.writeError.set(null);
  }
  cancelDelete(): void {
    if (this.pending()) return;
    this.deleting.set(null);
    this.writeError.set(null);
    this.document.defaultView?.requestAnimationFrame(() => {
      if (this.deleteTrigger instanceof HTMLElement && this.deleteTrigger.isConnected)
        this.deleteTrigger.focus();
    });
  }
  async remove(): Promise<void> {
    const row = this.deleting();
    if (!row || this.pending()) return;
    this.pending.set(true);
    this.writeError.set(null);
    this.notice.set('');
    try {
      await this.api.delete(row.id);
      if (this.destroyRef.destroyed) return;
      this.saved.update((rows) => rows.filter((item) => item.id !== row.id));
      this.deleting.set(null);
      this.notice.set(this.text().sessionDeleted);
      this.heading().nativeElement.focus();
      this.retry();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.writeError.set(error);
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
  canLeave(): boolean | Promise<boolean> {
    if (!this.dirty() || this.pending()) return true;
    if (!this.leaveDecision)
      this.leaveDecision = new Promise<boolean>((resolve) => {
        const settle = (leave: boolean) => {
          this.leaveDecision = undefined;
          if (leave) this.draft.set(null);
          resolve(leave);
        };
        this.confirmation.confirm({
          header: this.text().unsavedTitle,
          message: this.text().unsavedDescription,
          rejectButtonProps: {
            label: this.text().keepEditing,
            severity: 'secondary',
            outlined: true,
          },
          acceptButtonProps: { label: this.text().discardChanges, severity: 'danger' },
          accept: () => {
            settle(true);
          },
          reject: () => {
            settle(false);
          },
        });
      });
    return this.leaveDecision;
  }
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty() && !this.pending()) event.preventDefault();
  }
}
