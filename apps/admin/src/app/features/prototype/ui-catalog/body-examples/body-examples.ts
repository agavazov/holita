import { Component, computed, input, signal } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { messages, type Language } from '../../../../i18n/messages';

@Component({
  selector: 'holita-body-examples',
  imports: [ButtonDirective, Message, Tag],
  templateUrl: './body-examples.html',
  styleUrl: '../catalog-examples.scss',
})
export class BodyExamples {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly notice = signal(false);
  readonly expanded = signal(false);
  toggleDetails(): void {
    this.expanded.update((value) => !value);
  }
  readonly headingSizes = [1, 2, 3, 4, 5, 6];
}
