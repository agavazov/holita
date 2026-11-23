import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { PRIMARY_OUTLET, Router, RouterOutlet } from '@angular/router';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { UI_LANGUAGE, uiMessages } from '@osnova/ui';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import bg from '../i18n/bg.json';
import en from '../i18n/en.json';
import { SalesWorkspaceApi } from './sales-workspace-api';

const messages = { bg, en };

@Component({
  selector: 'holita-sales-workspace-status',
  imports: [ButtonDirective, Message, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
  template: `
    @if (access.isLoading()) {
      <p-message severity="info" [pt]="statusMessage">{{ text().salesAccessChecking }}</p-message>
    } @else if (access.error()) {
      @if (denied()) {
        <p-message severity="warn">{{ text().salesAccessDenied }}</p-message>
      } @else {
        <div class="app-stack">
          <p-message severity="error">{{ text().salesAccessUnavailable }}</p-message>
          <button pButton type="button" severity="secondary" (click)="access.reload()">
            {{ retryLabel() }}
          </button>
        </div>
      }
    } @else if (access.hasValue()) {
      @if (onMerchants()) {
        <p-message severity="success" [pt]="statusMessage">{{
          text().salesAccessGranted
        }}</p-message>
      }
      <router-outlet hidden />
    }
  `,
})
export class SalesWorkspaceStatus {
  private readonly api = inject(SalesWorkspaceApi);
  private readonly language = inject(UI_LANGUAGE);
  private readonly router = inject(Router);
  protected readonly onMerchants = computed(
    () =>
      this.router.lastSuccessfulNavigation()?.finalUrl?.root.children[PRIMARY_OUTLET]?.segments[1]
        ?.path === 'merchants',
  );
  protected readonly text = computed(() => messages[this.language()]);
  protected readonly retryLabel = computed(() => uiMessages[this.language()].retry);
  protected readonly statusMessage = { root: { role: 'status', 'aria-live': 'polite' } };
  protected readonly access = resource({
    params: this.api.scope,
    loader: ({ params, abortSignal }) => this.api.read(params, abortSignal),
  });
  protected readonly denied = computed(() => {
    const error = this.access.error();
    return (
      CombinedGraphQLErrors.is(error) &&
      error.errors.some((failure) => failure.extensions?.['code'] === 'FORBIDDEN')
    );
  });
}
