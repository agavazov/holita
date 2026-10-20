import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink, type Params } from '@angular/router';
import { ArrowLeft } from '@primeicons/angular/arrow-left';
import { formatNumber } from '../format/format';
import { UI_LANGUAGE } from '../ui-language';

/** The single page heading: eyebrow, h1 (focus target), count, description and actions. */
@Component({
  selector: 'holita-page-header',
  imports: [RouterLink, ArrowLeft],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeader {
  readonly eyebrow = input<string | null>(null);
  readonly title = input.required<string>();
  readonly count = input<number | null>(null);
  readonly description = input<string | null>(null);
  readonly backLink = input<readonly string[] | null>(null);
  readonly backLabel = input<string | null>(null);
  readonly backQueryParams = input<Params | null>(null);
  readonly backFragment = input<string | null>(null);

  private readonly language = inject(UI_LANGUAGE);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  protected readonly countText = computed(() => {
    const count = this.count();
    return count === null ? null : formatNumber(count, this.language());
  });

  focusTitle(): void {
    this.heading().nativeElement.focus();
  }
}
