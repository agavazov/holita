import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Search } from '@primeicons/angular/search';
import { SlidersH } from '@primeicons/angular/sliders-h';
import { Times } from '@primeicons/angular/times';
import { ButtonDirective } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { interpolate, uiMessages } from '../i18n/messages';
import { maxSearchLength } from '../list/list-state';
import { UI_LANGUAGE } from '../ui-language';

export interface FilterChip {
  readonly key: string;
  readonly label: string;
}

let nextId = 0;

/** Search, segments, filter controls and applied-filter chips above a list. */
@Component({
  selector: 'holita-filter-bar',
  imports: [ButtonDirective, IconField, InputIcon, InputText, Message, Search, SlidersH, Times],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBar {
  readonly searchLabel = input.required<string>();
  readonly search = input('');
  readonly searchError = input<string | null>(null);
  readonly chips = input<readonly FilterChip[]>([]);
  readonly activeCount = input(0);
  readonly searchChange = output<string>();
  readonly removeChip = output<string>();
  readonly clearAll = output();

  protected readonly id = `filter-bar-${String(nextId++)}`;
  protected readonly maxLength = maxSearchLength;
  protected readonly open = signal(false);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => uiMessages[this.language()].filters);
  protected readonly toggleLabel = computed(() =>
    this.activeCount() > 0
      ? interpolate(this.text().toggleCount, { count: this.activeCount() })
      : this.text().toggle,
  );

  protected input(event: Event): void {
    if (event.target instanceof HTMLInputElement) this.searchChange.emit(event.target.value);
  }

  protected chipLabel(chip: FilterChip): string {
    return interpolate(this.text().removeChip, { name: chip.label });
  }
}
