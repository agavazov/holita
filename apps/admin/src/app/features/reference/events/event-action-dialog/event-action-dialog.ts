import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { messages, type Language } from '../../../../i18n/messages';
import { requestError } from '../../../../core/graphql/request-error';
import { EventsApi, type EventActionTarget } from '../events-api';

@Component({
  selector: 'holita-event-action-dialog',
  imports: [ButtonDirective, Dialog, Message],
  templateUrl: './event-action-dialog.html',
})
export class EventActionDialog {
  readonly target = input.required<EventActionTarget>();
  readonly language = input.required<Language>();
  readonly completed = output();
  readonly cancelled = output();
  readonly text = computed(() => messages[this.language()]);
  readonly pending = signal(false);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().networkError));
  readonly label = computed(() => {
    switch (this.target().action) {
      case 'publish':
        return this.text().eventPublish;
      case 'archive':
        return this.text().eventArchive;
      case 'trash':
        return this.text().eventTrash;
      case 'restore':
        return this.text().eventRestore;
    }
  });
  private readonly api = inject(EventsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly trigger = this.document.activeElement;
  cancel(): void {
    if (this.pending()) return;
    this.cancelled.emit();
    this.document.defaultView?.requestAnimationFrame(() => {
      if (this.trigger instanceof HTMLElement && this.trigger.isConnected) this.trigger.focus();
    });
  }
  async submit(): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      await this.api.applyAction(this.target());
      if (!this.destroyRef.destroyed) this.completed.emit();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) this.error.set(error);
    } finally {
      if (!this.destroyRef.destroyed) this.pending.set(false);
    }
  }
}
