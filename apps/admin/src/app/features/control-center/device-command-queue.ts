import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import type {
  AdminControlCenterCommandRequestsQuery,
  ErmCommandRequestStatus,
  ErmDeviceAction,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { confirmAction, confirmDialogPt } from '../../ui/confirm';
import { FormField } from '../../ui/form-field/form-field';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { formatDateTime } from '../../ui/format/format';
import { interpolate } from '../../ui/i18n/messages';
import { toneSeverity } from '../../ui/tones';
import { ControlCenterApi } from './control-center-api';
import { controlCenterText } from './control-center-text';

type Request = AdminControlCenterCommandRequestsQuery['fleetDevice']['ermCommandRequests'][number];
const actions: readonly ErmDeviceAction[] = [
  'REQUEST_LOCATION',
  'READ_STATUS',
  'READ_VERSION',
  'READ_ACCESSORIES',
  'READ_EDATA_DIAGNOSTICS',
  'READ_EDATA_FAULTS',
];

@Component({
  selector: 'holita-device-command-queue',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    Message,
    Tag,
    FormField,
  ],
  providers: [ConfirmationService],
  templateUrl: './device-command-queue.html',
  styles:
    ':host { display: block; } .command-queue__actions { display: flex; flex-wrap: wrap; gap: var(--p-app-space-2); } pre { white-space: pre-wrap; overflow-wrap: anywhere; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceCommandQueue {
  readonly deviceId = input.required<string>();
  readonly language = input.required<Language>();
  readonly target = input.required<string>();
  readonly changed = output();
  protected readonly actions = actions;
  protected readonly catalog = computed(() => controlCenterText[this.language()]);
  protected readonly text = computed(() => this.catalog().queue);
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'erm-queue-confirm-message'),
  );
  private readonly api = inject(ControlCenterApi);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly confirmationMessage = signal('');
  private readonly units = injectFleetFormat();
  protected readonly form = new FormGroup({
    intent: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    expiryMinutes: new FormControl(120, {
      nonNullable: true,
      validators: [
        (control) => Validators.required(control),
        Validators.min(1),
        Validators.max(1440),
        Validators.pattern(/^\d+$/),
      ],
    }),
  });
  protected readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });
  protected readonly requests = signal<readonly Request[]>([]);
  protected readonly loading = signal(true);
  protected readonly sending = signal<ErmDeviceAction | null>(null);
  protected readonly cancelling = signal<string | null>(null);
  private readonly loadError = signal<string | null>(null);
  private readonly actionError = signal<string | null>(null);
  protected readonly error = computed(() => this.actionError() ?? this.loadError());
  private readonly reload = signal(0);
  private readonly pending = computed(() =>
    this.requests().some(
      (request) => request.status === 'QUEUED' || request.status === 'SUBMITTING',
    ),
  );

  constructor() {
    effect((onCleanup) => {
      this.reload();
      const deviceId = this.deviceId();
      this.loading.set(true);
      const subscription = this.api
        .watchCommandRequests(deviceId, () => !this.pending())
        .valueChanges.subscribe({
          next: (result) => {
            this.loading.set(result.loading);
            if (result.error) {
              this.loadError.set(requestError(result.error, this.text().unavailable));
            } else if (result.dataState === 'complete') {
              this.loadError.set(null);
              this.requests.set(result.data.fleetDevice.ermCommandRequests);
            }
          },
          error: (error: unknown) => {
            this.loading.set(false);
            this.loadError.set(requestError(error, this.text().unavailable));
          },
        });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  protected async send(action: ErmDeviceAction): Promise<void> {
    if (this.form.invalid || this.sending() !== null) {
      return;
    }
    const values = this.form.getRawValue();
    this.confirmationMessage.set(
      interpolate(this.text().confirmMessage, {
        action: this.catalog().actions[action],
        unit: this.target(),
        minutes: values.expiryMinutes,
      }),
    );
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: this.text().confirmHeader,
      acceptLabel: this.text().enqueue,
      danger: false,
    });
    if (!accepted) {
      return;
    }
    this.sending.set(action);
    this.actionError.set(null);
    try {
      await this.api.sendCommand({
        deviceId: this.deviceId(),
        action,
        expiresInSeconds: values.expiryMinutes * 60,
        intent: values.intent.trim() || undefined,
      });
      this.changed.emit();
    } catch (error: unknown) {
      const refused =
        CombinedGraphQLErrors.is(error) &&
        error.errors.every((failure) => {
          const code = failure.extensions?.['code'];
          return (
            typeof code === 'string' &&
            [
              'BAD_USER_INPUT',
              'GRAPHQL_VALIDATION_FAILED',
              'UNAUTHENTICATED',
              'FORBIDDEN',
              'NOT_FOUND',
              'CONFLICT',
            ].includes(code)
          );
        });
      const reason = requestError(error, this.text().unavailable);
      this.actionError.set(refused ? reason : `${reason} ${this.text().uncertainSubmission}`);
    } finally {
      this.sending.set(null);
      this.refresh(false);
    }
  }

  protected async cancel(request: Request): Promise<void> {
    this.confirmationMessage.set(
      interpolate(this.text().cancelMessage, {
        action: this.catalog().actions[request.action],
        unit: this.target(),
      }),
    );
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: this.text().cancel,
      acceptLabel: this.text().cancel,
      danger: false,
    });
    if (!accepted) {
      return;
    }
    this.cancelling.set(request.id);
    this.actionError.set(null);
    try {
      await this.api.cancelCommand(this.deviceId(), request.id);
      this.changed.emit();
    } catch (error: unknown) {
      this.actionError.set(requestError(error, this.text().unavailable));
    } finally {
      this.cancelling.set(null);
      this.refresh(false);
    }
  }

  protected refresh(clearActionError = true): void {
    if (clearActionError) {
      this.actionError.set(null);
    }
    this.loadError.set(null);
    this.reload.update((value) => value + 1);
  }
  protected date(value: string | null): string {
    return formatDateTime(value, this.language(), this.units.preferences().timeZone, true);
  }
  protected severity(status: ErmCommandRequestStatus) {
    return toneSeverity(
      status === 'ANSWERED'
        ? 'success'
        : status === 'FAILED'
          ? 'danger'
          : status === 'UNCERTAIN' || status === 'EXPIRED'
            ? 'warn'
            : status === 'CANCELLED'
              ? 'neutral'
              : 'info',
    );
  }
}
