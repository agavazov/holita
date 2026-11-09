import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
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
import type { ErmDeviceAction } from '../../../generated/graphql/operations';
import { DemoSession } from '../../core/auth/demo-session';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { confirmAction, confirmDialogPt } from '../../ui/confirm';
import { FormField } from '../../ui/form-field/form-field';
import { interpolate } from '../../ui/i18n/messages';
import {
  CommandDetails,
  CommandHistory,
  commandPending,
  commandPurpose,
  type CommandRequest,
} from '../fleet/commands';
import { ControlCenterApi } from './control-center-api';
import { commandError, controlCenterText } from './control-center-text';

const actions: readonly ErmDeviceAction[] = [
  'REQUEST_LOCATION',
  'READ_STATUS',
  'READ_VERSION',
  'READ_ACCESSORIES',
  'READ_EDATA_DIAGNOSTICS',
  'READ_EDATA_FAULTS',
];

@Component({
  selector: 'discocan-device-command-queue',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    ConfirmDialog,
    InputText,
    Message,
    FormField,
    CommandHistory,
    CommandDetails,
  ],
  providers: [ConfirmationService],
  templateUrl: './device-command-queue.html',
  styles: '.command-queue__actions { display: flex; flex-wrap: wrap; gap: var(--p-app-space-2); }',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class DeviceCommandQueue {
  readonly deviceId = input.required<string>();
  readonly language = input.required<Language>();
  readonly target = input.required<string>();
  readonly requestId = input<string | null>(null);
  readonly changed = output();
  protected readonly actions = actions;
  protected readonly catalog = computed(() => controlCenterText[this.language()]);
  protected readonly text = computed(() => this.catalog().queue);
  protected readonly confirmPt = computed(() =>
    confirmDialogPt(this.language(), 'erm-queue-confirm-message'),
  );
  private readonly api = inject(ControlCenterApi);
  private readonly session = inject(DemoSession);
  protected readonly canOperate = computed(() => this.session.hasRole('OPERATOR'));
  protected readonly operatorRequired = computed(() => this.catalog().branchQueue.operatorRequired);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly confirmationMessage = signal('');
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
  protected readonly requests = signal<readonly CommandRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly sending = signal<ErmDeviceAction | null>(null);
  protected readonly cancelling = signal<string | null>(null);
  private readonly loadError = signal<string | null>(null);
  private readonly actionError = signal<string | null>(null);
  protected readonly error = computed(() => this.actionError() ?? this.loadError());
  private readonly reload = signal(0);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selected = computed(
    () => this.requests().find((request) => request.id === this.selectedId()) ?? null,
  );
  private readonly watchedIds = computed(() => {
    const ids = this.requests()
      .filter(commandPending)
      .map((request) => request.id);
    const selected = this.selectedId();
    if (selected && !this.requests().some((request) => request.id === selected)) {
      ids.push(selected);
    }
    return [...new Set(ids)].sort().join(',');
  });

  constructor() {
    effect(() => {
      const requestId = this.requestId();
      if (requestId) {
        this.selectedId.set(requestId);
      }
    });
    effect((onCleanup) => {
      this.reload();
      const deviceId = this.deviceId();
      this.loading.set(true);
      const query = this.api.watchCommandRequests(deviceId, () => true);
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          if (result.error) {
            this.loadError.set(requestError(result.error, this.text().unavailable));
          } else if (result.dataState === 'complete') {
            this.loadError.set(null);
            const rows = result.data.fleetDevice.ermCommandRequests;
            this.requests.update((current) => [
              ...rows,
              ...current.filter(
                (row) => row.id === this.selectedId() && !rows.some((next) => next.id === row.id),
              ),
            ]);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.loadError.set(requestError(error, this.text().unavailable));
        },
      });
      const visible = () => {
        if (!document.hidden) {
          void query.refetch().catch(() => undefined);
        }
      };
      document.addEventListener('visibilitychange', visible);
      onCleanup(() => {
        subscription.unsubscribe();
        document.removeEventListener('visibilitychange', visible);
      });
    });
    effect((onCleanup) => {
      this.reload();
      const ids = this.watchedIds();
      if (!ids) {
        return;
      }
      const queries = ids.split(',').map((id) =>
        this.api.watchCommandRequest(id, () => {
          const request = this.requests().find((row) => row.id === id);
          return request !== undefined && !commandPending(request);
        }),
      );
      const subscriptions = queries.map((query) =>
        query.valueChanges.subscribe({
          next: (result) => {
            if (result.error) {
              this.loadError.set(requestError(result.error, this.text().unavailable));
            } else if (result.dataState === 'complete') {
              const request = result.data.ermCommandRequest;
              if (request?.deviceId === this.deviceId()) {
                this.upsert(request);
                this.loadError.set(null);
              } else {
                this.selectedId.set(null);
                this.loadError.set(this.text().unavailable);
              }
            }
          },
          error: (error: unknown) => {
            this.loadError.set(requestError(error, this.text().unavailable));
          },
        }),
      );
      const visible = () => {
        if (!document.hidden) {
          for (const query of queries) {
            void query.refetch().catch(() => undefined);
          }
        }
      };
      document.addEventListener('visibilitychange', visible);
      onCleanup(() => {
        for (const subscription of subscriptions) {
          subscription.unsubscribe();
        }
        document.removeEventListener('visibilitychange', visible);
      });
    });
  }

  private alive(): boolean {
    return !this.destroyRef.destroyed;
  }

  private upsert(request: CommandRequest): void {
    this.requests.update((rows) =>
      rows.some((row) => row.id === request.id)
        ? rows.map((row) => (row.id === request.id ? request : row))
        : [request, ...rows],
    );
  }

  protected async send(action: ErmDeviceAction): Promise<void> {
    if (!this.canOperate() || this.form.invalid || this.sending() !== null) {
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
    if (!accepted || !this.alive()) {
      return;
    }
    this.sending.set(action);
    this.actionError.set(null);
    try {
      const request = await this.api.sendCommand({
        deviceId: this.deviceId(),
        action,
        expiresInSeconds: values.expiryMinutes * 60,
        intent: values.intent.trim() || undefined,
      });
      if (!this.alive()) {
        return;
      }
      this.upsert(request);
      this.selectedId.set(request.id);
      this.changed.emit();
    } catch (error: unknown) {
      if (!this.alive()) {
        return;
      }
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
      const reason = commandError(error, this.language());
      this.actionError.set(refused ? reason : `${reason} ${this.text().uncertainSubmission}`);
    } finally {
      if (this.alive()) {
        this.sending.set(null);
        this.refresh(false);
      }
    }
  }

  protected async cancel(request: CommandRequest): Promise<void> {
    if (!this.canOperate() || request.status !== 'QUEUED' || this.cancelling() !== null) {
      return;
    }
    this.confirmationMessage.set(
      interpolate(this.text().cancelMessage, {
        action: commandPurpose(request, this.language()),
        unit: this.target(),
      }),
    );
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: this.text().cancel,
      acceptLabel: this.text().cancel,
      danger: false,
    });
    if (!accepted || !this.alive()) {
      return;
    }
    this.cancelling.set(request.id);
    this.actionError.set(null);
    try {
      const updated = await this.api.cancelCommand(this.deviceId(), request.id);
      if (!this.alive()) {
        return;
      }
      this.upsert(updated);
      this.changed.emit();
    } catch (error: unknown) {
      if (this.alive()) {
        this.actionError.set(commandError(error, this.language()));
      }
    } finally {
      if (this.alive()) {
        this.cancelling.set(null);
        this.refresh(false);
      }
    }
  }

  protected refresh(clearActionError = true): void {
    if (clearActionError) {
      this.actionError.set(null);
    }
    this.loadError.set(null);
    this.reload.update((value) => value + 1);
  }
}
