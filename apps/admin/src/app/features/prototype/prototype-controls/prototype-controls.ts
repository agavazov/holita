import { Component, computed, input, output, signal } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { messages, type Language } from '../../../i18n/messages';

@Component({
  selector: 'holita-prototype-controls',
  imports: [Dialog, ButtonDirective, Message],
  templateUrl: './prototype-controls.html',
  styleUrl: './prototype-controls.scss',
})
export class PrototypeControls {
  readonly language = input.required<Language>();
  readonly busy = input(false);
  readonly failed = input(false);
  readonly resetConfirmed = output();
  readonly confirmingReset = signal(false);
  readonly text = computed(() => messages[this.language()]);
}
