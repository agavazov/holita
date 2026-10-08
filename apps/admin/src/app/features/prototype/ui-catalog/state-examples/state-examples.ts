import { Component, computed, type ElementRef, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { ProgressBar } from 'primeng/progressbar';
import { Message } from 'primeng/message';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { messages, type Language } from '../../../../i18n/messages';

@Component({
  selector: 'holita-state-examples',
  imports: [FormsModule, Select, Skeleton, ProgressBar, Message, ButtonDirective, Dialog],
  templateUrl: './state-examples.html',
  styleUrl: '../catalog-examples.scss',
})
export class StateExamples {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly state = signal<'ready' | 'loading' | 'empty' | 'error' | 'disabled'>('ready');
  readonly refreshFailed = signal(true);
  readonly confirming = signal(false);
  readonly notice = signal('');
  readonly options = computed(() => [
    { value: 'ready', label: this.text().catalogReady },
    { value: 'loading', label: this.text().catalogLoading },
    { value: 'empty', label: this.text().catalogEmpty },
    { value: 'error', label: this.text().catalogError },
    { value: 'disabled', label: this.text().catalogDisabled },
  ]);
  private readonly confirmationButton =
    viewChild.required<ElementRef<HTMLButtonElement>>('confirmationButton');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  changeState(value: unknown): void {
    if (
      value === 'ready' ||
      value === 'loading' ||
      value === 'empty' ||
      value === 'error' ||
      value === 'disabled'
    )
      this.state.set(value);
  }
  retryRefresh(): void {
    this.refreshFailed.set(false);
    this.notice.set(this.text().catalogRefreshSuccess);
  }
  confirm(): void {
    this.confirming.set(false);
    this.notice.set(this.text().catalogActionNotice);
  }
  focusCancel(): void {
    this.cancelButton()?.nativeElement.focus();
  }
  restoreFocus(): void {
    this.confirmationButton().nativeElement.focus();
  }
}
