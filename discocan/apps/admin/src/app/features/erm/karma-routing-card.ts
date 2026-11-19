import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { confirmAction, confirmDialogPt, interpolate, toneSeverity } from '@osnova/ui';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import type {
  AdminControlCenterReturnAttemptFragment,
  AdminErmRoutingFragment,
  AdminErmSessionEvidenceFragment,
  ErmKarmaReturnStatus,
} from '../../../generated/graphql/operations';
import type { Language } from '../../i18n/messages';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { ErmDeviceApi } from './erm-device-api';
import { ermText } from './erm-text';

function returnToDiscoCanError(error: unknown, language: Language): string {
  const text = ermText[language].routing;
  const code = CombinedGraphQLErrors.is(error) ? error.errors[0]?.extensions?.['code'] : null;
  switch (code) {
    case 'FORBIDDEN':
      return text.returnEngineer;
    case 'UNAUTHENTICATED':
      return text.returnSession;
    case 'CONFLICT':
      return text.returnConflict;
    case 'SERVICE_UNAVAILABLE':
      return text.returnUnavailable;
    default:
      return text.returnUnconfirmed;
  }
}

@Component({
  selector: 'discocan-karma-routing-card',
  imports: [ButtonDirective, ConfirmDialog, Message, Tag],
  providers: [ConfirmationService, ErmDeviceApi],
  templateUrl: './karma-routing-card.html',
  styleUrl: '../control-center/control-center.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-card', role: 'region', '[attr.aria-label]': 'text().title' },
})
export class KarmaRoutingCard {
  readonly deviceId = input.required<string>();
  readonly language = input.required<Language>();
  readonly unitName = input.required<string>();
  readonly canConfigure = input.required<boolean>();
  readonly observedRouting = input.required<AdminErmRoutingFragment['ermRouting']>();
  readonly sessionEvidence = input<AdminErmSessionEvidenceFragment['erm']>();
  readonly recorded = output<AdminControlCenterReturnAttemptFragment>();
  readonly refreshRequested = output();

  protected readonly text = computed(() => ermText[this.language()].routing);
  protected readonly routing = this.observedRouting;
  protected readonly fmt = injectFleetFormat();
  protected readonly toneSeverity = toneSeverity;
  private readonly api = inject(ErmDeviceApi);
  private readonly destroy = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);
  private readonly notifications = inject(MessageService);
  protected readonly returning = signal(false);
  protected readonly returnFailure = signal<string | null>(null);
  protected readonly confirmationMessage = signal('');
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'erm-return-confirm-message'),
  );
  readonly returnDisabledReason = computed(() => {
    const route = this.routing();
    const text = this.text();
    if (!this.canConfigure()) {
      return text.returnEngineer;
    }
    if (this.returning()) {
      return text.returnSubmitting;
    }
    if (route.latestReturnAttempt?.pending) {
      return text.returnPending;
    }
    if (route.state !== 'KARMA_BACKUP') {
      return text.returnBackupRequired;
    }
    return route.parked === true
      ? null
      : route.parked === false
        ? text.returnNotParked
        : text.returnParkingUnknown;
  });
  readonly recovery = computed(() => {
    const attempt = this.routing().latestReturnAttempt;
    return attempt ? attempt.recovery : (this.sessionEvidence()?.recovery ?? null);
  });
  returnSeverity(value: ErmKarmaReturnStatus) {
    return toneSeverity(
      value === 'RETURNED'
        ? 'success'
        : value === 'FAILED'
          ? 'danger'
          : value === 'UNCERTAIN' || value === 'NEEDS_OPERATOR'
            ? 'warn'
            : 'info',
    );
  }
  private alive(): boolean {
    return !this.destroy.destroyed;
  }

  async returnToDiscoCan(): Promise<void> {
    if (this.returnDisabledReason()) {
      return;
    }
    const text = this.text();
    const language = this.language();
    const deviceId = this.deviceId();
    this.confirmationMessage.set(interpolate(text.returnConfirm, { unit: this.unitName() }));
    const accepted = await confirmAction(this.confirmation, language, {
      header: text.returnConfirmTitle,
      acceptLabel: text.returnButton,
      danger: false,
    });
    if (!accepted || !this.alive() || this.returnDisabledReason()) {
      return;
    }
    this.returning.set(true);
    this.returnFailure.set(null);
    try {
      const attempt = await this.api.returnToDiscoCan(deviceId);
      if (this.alive()) {
        this.recorded.emit(attempt);
        this.notifications.add({
          severity: attempt.status === 'UNCERTAIN' || attempt.status === 'FAILED' ? 'warn' : 'info',
          summary: text.returnRecorded,
          detail: text.returnStates[attempt.status],
        });
      }
    } catch (error: unknown) {
      if (this.alive()) {
        this.returnFailure.set(returnToDiscoCanError(error, language));
      }
    } finally {
      if (this.alive()) {
        this.returning.set(false);
        this.refreshRequested.emit();
      }
    }
  }
}
