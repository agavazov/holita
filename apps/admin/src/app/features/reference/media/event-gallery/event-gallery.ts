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
import { HttpClient, HttpErrorResponse, HttpXhrBackend } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { InputText } from 'primeng/inputtext';
import { ProgressBar } from 'primeng/progressbar';
import { TimeoutError } from 'rxjs';
import { MediaApi } from '../media-api';
import { directUpload } from '../direct-upload';
import { messages, type Language } from '../../../../i18n/messages';
import { requestError } from '../../../../core/graphql/request-error';
import type { AdminMediaDetailsFragment } from '../../../../../generated/graphql/operations';

@Component({
  selector: 'holita-event-gallery',
  imports: [ReactiveFormsModule, ButtonDirective, Dialog, Message, ProgressBar, InputText],
  templateUrl: './event-gallery.html',
  styleUrl: './event-gallery.scss',
  host: {
    '[class.embedded]': 'embedded()',
    '(window:beforeunload)': 'beforeUnload($event)',
    '(window:keydown)': 'previewKey($event)',
  },
})
export class EventGallery implements OnInit {
  readonly language = input.required<Language>();
  readonly editable = input(false);
  readonly embedded = input(false);
  readonly disabled = input(false);
  readonly text = computed(() => messages[this.language()]);
  readonly saved = signal<AdminMediaDetailsFragment[]>([]);
  readonly draft = signal<AdminMediaDetailsFragment[] | null>(null);
  readonly rows = computed(
    () =>
      this.draft()?.map((row) => this.saved().find((saved) => saved.id === row.id) ?? row) ??
      this.saved(),
  );
  readonly loading = signal(true);
  readonly pending = signal(false);
  private readonly readError = signal<unknown>(null);
  private readonly actionError = signal<unknown>(null);
  readonly error = computed(() => this.actionError() ?? this.readError());
  readonly failure = computed(() => {
    const error = this.error();
    if (error === 'invalid-file') return this.text().mediaInvalidFile;
    if (error instanceof Error && 'requestId' in error)
      return requestError(error, this.text().mediaFailed);
    if (error instanceof TimeoutError) return this.text().mediaUploadTimeout;
    if (error instanceof HttpErrorResponse)
      return error.status === 0
        ? this.text().mediaUploadConnectionLost
        : this.text().mediaUploadRejected;
    return requestError(error, this.text().mediaFailed);
  });
  readonly notice = signal('');
  readonly uploading = signal<{ name: string; percent: number; finishing: boolean } | null>(null);
  readonly editing = signal<AdminMediaDetailsFragment | null>(null);
  readonly deleting = signal<AdminMediaDetailsFragment | null>(null);
  readonly previewId = signal<string | null>(null);
  readonly preview = computed(() => this.rows().find((row) => row.id === this.previewId()));
  readonly previewIndex = computed(() =>
    this.rows().findIndex((row) => row.id === this.previewId()),
  );
  readonly broken = signal<string[]>([]);
  readonly dragging = signal<string | null>(null);
  readonly altText = new FormControl('', { nonNullable: true });
  private readonly altEvents = toSignal(this.altText.events);
  readonly altInvalid = computed(() => {
    this.altEvents();
    return this.altText.value.includes('\0') || Array.from(this.altText.value.trim()).length > 300;
  });
  readonly dirty = computed(() => {
    this.altEvents();
    return (
      !this.pending() && (this.draft() !== null || Boolean(this.editing() && this.altText.dirty))
    );
  });
  readonly busy = computed(
    () => this.pending() || this.dirty() || !!this.editing() || !!this.deleting(),
  );
  readonly locked = computed(() => this.disabled() || this.pending() || this.loading());
  private readonly api = inject(MediaApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  // A dedicated XHR client reports progress and sends only the captured capability headers.
  private readonly uploadHttp = new HttpClient(inject(HttpXhrBackend));
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly altInput = viewChild<ElementRef<HTMLInputElement>>('altInput');
  private query: ReturnType<MediaApi['watchList']> | undefined;
  private controller: AbortController | null = null;
  private trigger: Element | null = null;
  private previewTrigger: Element | null = null;
  constructor() {
    this.destroyRef.onDestroy(() => this.controller?.abort());
  }
  ngOnInit(): void {
    this.query = this.api.watchList();
    this.query.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.readError.set(result.error ?? null);
        if (result.dataState === 'complete' && !result.error)
          this.saved.set(result.data.referenceEventMedia);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.readError.set(error);
      },
    });
  }
  chooseFile(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.upload(file);
  }
  choose(): void {
    this.fileInput().nativeElement.click();
  }
  async upload(file: File): Promise<void> {
    if (!this.editable() || this.locked() || this.draft() || this.rows().length >= 10) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size < 1 ||
      file.size > 5 * 1024 * 1024 ||
      !file.name.trim() ||
      file.name.includes('\0') ||
      Array.from(file.name.trim()).length > 255
    ) {
      this.actionError.set('invalid-file');
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
    this.pending.set(true);
    this.actionError.set(null);
    this.notice.set('');
    this.uploading.set({ name: file.name, percent: 0, finishing: false });
    try {
      const target = await this.api.intent({
        originalName: file.name,
        contentType: file.type,
        byteSize: file.size,
      });
      controller.signal.throwIfAborted();
      await directUpload(this.uploadHttp, target, file, controller.signal, (percent) => {
        if (!this.destroyRef.destroyed && !controller.signal.aborted)
          this.uploading.set({ name: file.name, percent, finishing: false });
      });
      controller.signal.throwIfAborted();
      this.uploading.set({ name: file.name, percent: 100, finishing: true });
      await this.api.finalize(target.uploadId);
      if (this.destroyRef.destroyed || controller.signal.aborted) return;
      this.notice.set(this.text().mediaUploaded);
      await this.refresh();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed && !controller.signal.aborted) this.actionError.set(error);
    } finally {
      if (this.controller === controller && !this.destroyRef.destroyed) {
        this.controller = null;
        this.uploading.set(null);
        this.pending.set(false);
      }
    }
  }
  cancelUpload(): void {
    if (this.uploading()?.finishing) return;
    this.controller?.abort();
    this.controller = null;
    this.uploading.set(null);
    this.pending.set(false);
    this.notice.set(this.text().mediaCancelled);
  }
  async refresh(): Promise<void> {
    if (!this.query) return;
    this.actionError.set(null);
    try {
      const result = await this.query.refetch();
      if (this.destroyRef.destroyed) return;
      if (result.error)
        throw result.error instanceof Error ? result.error : new Error(result.error.message);
      this.readError.set(null);
      this.broken.set([]);
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.readError.set(error);
    }
  }
  imageFailed(id: string): void {
    this.broken.update((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }
  label(template: string, name: string): string {
    return template.replace('{name}', name);
  }
  move(id: string, targetId: string): void {
    if (!this.editable() || this.locked() || this.editing() || this.deleting() || id === targetId)
      return;
    const rows = this.rows(),
      row = rows.find((item) => item.id === id),
      index = rows.findIndex((item) => item.id === targetId);
    if (!row || index < 0) return;
    const next = rows.filter((item) => item.id !== id);
    next.splice(index, 0, row);
    this.draft.set(
      next.length === this.saved().length &&
        next.every((item, i) => item.id === this.saved()[i]?.id)
        ? null
        : next,
    );
    this.actionError.set(null);
    this.notice.set(this.text().mediaMoved.replace('{position}', String(index + 1)));
  }
  moveBy(id: string, direction: number): void {
    const index = this.rows().findIndex((row) => row.id === id),
      target = this.rows()[index + direction];
    if (target) this.move(id, target.id);
  }
  dragStart(event: DragEvent, id: string): void {
    if (this.locked()) {
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
  async saveOrder(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.locked()) return;
    this.pending.set(true);
    this.actionError.set(null);
    try {
      const rows = await this.api.reorder(draft.map((row) => row.id));
      if (this.destroyRef.destroyed) return;
      this.saved.set(rows);
      this.draft.set(null);
      this.notice.set(this.text().mediaOrderSaved);
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.actionError.set(error);
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
  async cancelOrder(): Promise<void> {
    if (this.locked() || !this.query) return;
    this.pending.set(true);
    try {
      const result = await this.query.refetch();
      if (result.error)
        throw result.error instanceof Error ? result.error : new Error(result.error.message);
      if (this.destroyRef.destroyed) return;
      this.draft.set(null);
      this.actionError.set(null);
      this.notice.set(this.text().mediaOrderRestored);
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.actionError.set(error);
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
  async setCover(row: AdminMediaDetailsFragment): Promise<void> {
    if (!this.editable() || this.locked() || this.draft()) return;
    this.pending.set(true);
    this.actionError.set(null);
    try {
      const rows = await this.api.cover(row.id);
      if (this.destroyRef.destroyed) return;
      this.saved.set(rows);
      this.notice.set(this.text().mediaCoverSaved);
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.actionError.set(error);
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
  editAlt(row: AdminMediaDetailsFragment): void {
    if (this.locked() || this.draft()) return;
    this.trigger = this.document.activeElement;
    this.altText.reset(row.altText ?? '');
    this.editing.set(row);
    this.actionError.set(null);
  }
  requestDelete(row: AdminMediaDetailsFragment): void {
    if (this.locked() || this.draft()) return;
    this.trigger = this.document.activeElement;
    this.deleting.set(row);
    this.actionError.set(null);
  }
  closeAction(): void {
    if (this.pending()) return;
    this.editing.set(null);
    this.deleting.set(null);
    this.actionError.set(null);
    this.restoreFocus(this.trigger);
  }
  async saveAlt(): Promise<void> {
    const row = this.editing();
    if (!row || this.locked()) return;
    if (this.altInvalid()) {
      this.altInput()?.nativeElement.focus();
      return;
    }
    this.pending.set(true);
    this.actionError.set(null);
    try {
      const updated = await this.api.update(row.id, { altText: this.altText.value.trim() || null });
      if (this.destroyRef.destroyed) return;
      this.saved.update((rows) => rows.map((item) => (item.id === row.id ? updated : item)));
      this.editing.set(null);
      this.notice.set(this.text().mediaAltSaved);
      this.restoreFocus(this.trigger);
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.actionError.set(error);
        this.altInput()?.nativeElement.focus();
      }
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
  async remove(): Promise<void> {
    const row = this.deleting();
    if (!row || this.locked()) return;
    this.pending.set(true);
    this.actionError.set(null);
    try {
      await this.api.delete(row.id);
      if (this.destroyRef.destroyed) return;
      this.saved.update((rows) => rows.filter((item) => item.id !== row.id));
      this.deleting.set(null);
      this.notice.set(this.text().mediaRemoved);
      this.heading().nativeElement.focus();
      await this.refresh();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.actionError.set(error);
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
  openPreview(row: AdminMediaDetailsFragment): void {
    if (!this.previewId()) this.previewTrigger = this.document.activeElement;
    this.previewId.set(row.id);
    if (Date.parse(row.readUrlExpiresAt) <= Date.now()) void this.refresh();
  }
  nextPreview(direction: number): void {
    const row = this.rows()[this.previewIndex() + direction];
    if (row) this.openPreview(row);
  }
  previewKey(event: KeyboardEvent): void {
    if (!this.preview()) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextPreview(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }
  closePreview(): void {
    this.previewId.set(null);
    this.restoreFocus(this.previewTrigger);
  }
  private restoreFocus(trigger: Element | null): void {
    this.document.defaultView?.requestAnimationFrame(() => {
      if (!this.destroyRef.destroyed && trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus();
    });
  }
  discardDrafts(): void {
    this.draft.set(null);
    this.editing.set(null);
    this.deleting.set(null);
  }
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) event.preventDefault();
  }
}
