import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { uiMessages } from '../ui/i18n/messages';
import { UI_LANGUAGE } from '../ui/ui-language';

/** Neutral page geometry while Branch preferences load, without a temporary page title. */
@Component({
  selector: 'discocan-page-loading',
  template: `
    <div class="app-page-loading" role="status" aria-busy="true" [attr.aria-label]="text().loading">
      <div class="app-page-loading__heading" aria-hidden="true"></div>
      <div class="app-page-loading__line" aria-hidden="true"></div>
      <div class="app-page-loading__panel" aria-hidden="true"></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageLoading {
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => uiMessages[this.language()]);
}
