import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Timeline } from 'primeng/timeline';
import type { Language } from '../../../i18n/messages';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { formatNumber } from '../../../ui/format/format';
import { interpolate } from '../../../ui/i18n/messages';
import {
  commandNextStep,
  commandOutcome,
  commandPending,
  commandPurpose,
  commandReason,
  commandSeverity,
  commandState,
  commandText,
  type CommandRequest,
} from './command-presentation';

const lifecycleFields = [
  'requestedAt',
  'queuedAt',
  'submittingAt',
  'sentAt',
  'answeredAt',
  'failedAt',
  'expiredAt',
  'cancelledAt',
  'uncertainAt',
] as const;

@Component({
  selector: 'holita-command-details',
  imports: [ButtonDirective, Dialog, Message, Tag, Timeline],
  templateUrl: './command-details.html',
  styleUrl: './command-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandDetails {
  readonly request = input<CommandRequest | null>(null);
  readonly language = input.required<Language>();
  readonly target = input.required<string>();
  readonly cancelling = input(false);
  readonly canCancel = input(true);
  readonly error = input<string | null>(null);
  readonly closed = output();
  readonly cancelRequest = output<CommandRequest>();
  protected readonly format = injectFleetFormat();
  protected readonly text = computed(() => commandText[this.language()]);
  protected readonly view = computed(() => {
    const request = this.request();
    if (!request) {
      return null;
    }
    const acknowledgement = request.transportCommand?.acknowledgement;
    return {
      request,
      purpose: commandPurpose(request, this.language()),
      pending: commandPending(request),
      status: this.text().states[commandState(request)],
      severity: commandSeverity(request),
      outcome: commandOutcome(request, this.language()),
      reason: commandReason(request, this.language()),
      nextStep: commandNextStep(request, this.language()),
      expiry: interpolate(this.text().expiry, {
        seconds: formatNumber(request.displayParameters.expiresInSeconds, this.language()),
      }),
      fields: request.displayParameters.requestedFields
        .map((field) => this.text().fieldLabels[field])
        .join(', '),
      confirmation: acknowledgement
        ? interpolate(this.text().confirmation, {
            reference: acknowledgement.commandReference,
            result: acknowledgement.resultCode,
          })
        : null,
      lifecycle: lifecycleFields
        .flatMap((field) => {
          const at = request[field];
          return at ? [{ label: this.text().steps[field], at }] : [];
        })
        .sort((left, right) => Date.parse(left.at) - Date.parse(right.at)),
    };
  });

  protected visibilityChanged(visible: boolean): void {
    if (!visible) {
      this.closed.emit();
    }
  }
}
