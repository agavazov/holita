import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { Tag } from 'primeng/tag';
import { toneSeverity } from '../../ui/tones';
import type {
  AdminControlCenterConfigurationChangesQuery,
  StartErmEdataChangeInput,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { confirmAction, confirmDialogPt } from '../../ui/confirm';
import { FormField } from '../../ui/form-field/form-field';
import { injectFleetFormat } from '../../ui/format/fleet-format';
import { formatDateTime } from '../../ui/format/format';
import { interpolate } from '../../ui/i18n/messages';
import { ControlCenterApi } from './control-center-api';
import { controlCenterText } from './control-center-text';

type SettingsMode = 'READ_EDATA' | 'INTERVAL' | 'ADD_DEFINITION' | 'GLOBALS' | 'PARAMETER';
type Run =
  AdminControlCenterConfigurationChangesQuery['fleetDevice']['ermConfigurationChanges'][number];
interface Step {
  name: string;
  time: string;
  outcome: string;
  payload: string | null;
}

@Component({
  selector: 'holita-device-settings',
  imports: [
    JsonPipe,
    ReactiveFormsModule,
    ButtonDirective,
    Checkbox,
    ConfirmDialog,
    InputText,
    Message,
    Select,
    Tag,
    FormField,
  ],
  providers: [ConfirmationService],
  templateUrl: './device-settings.html',
  styles: ':host { display: block; } pre { white-space: pre-wrap; overflow-wrap: anywhere; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceSettings {
  readonly deviceId = input.required<string>();
  readonly language = input.required<Language>();
  readonly target = input.required<string>();
  readonly primary = input(false);
  protected readonly text = computed(() => controlCenterText[this.language()].settings);
  protected readonly confirmPt = computed(() => confirmDialogPt(this.language()));
  private readonly api = inject(ControlCenterApi);
  private readonly confirmation = inject(ConfirmationService);
  private readonly units = injectFleetFormat();
  protected readonly form = new FormGroup({
    mode: new FormControl<SettingsMode>('READ_EDATA', { nonNullable: true }),
    parameterId: new FormControl<number | null>(null),
    intervalSeconds: new FormControl<number | null>(null),
    definitionHex: new FormControl('', { nonNullable: true }),
    globalsHex: new FormControl('', { nonNullable: true }),
    parameter: new FormControl('', { nonNullable: true }),
    value: new FormControl('', { nonNullable: true }),
    restoreAfter: new FormControl(false, { nonNullable: true }),
  });
  protected readonly mode = toSignal(this.form.controls.mode.valueChanges, {
    initialValue: this.form.controls.mode.value,
  });
  protected readonly modes = computed(() => {
    const labels = this.text().modes;
    const modes: readonly SettingsMode[] = [
      'READ_EDATA',
      'INTERVAL',
      'ADD_DEFINITION',
      'GLOBALS',
      'PARAMETER',
    ];
    return modes.map((value) => ({ value, label: labels[value] }));
  });
  protected readonly runs = signal<readonly Run[]>([]);
  protected readonly writesEnabled = signal(false);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly reload = signal(0);
  protected readonly running = computed(() =>
    this.runs().some(
      (run) => run.finishedAt === null && run.status !== 'FAILED' && run.status !== 'REFUSED',
    ),
  );

  constructor() {
    effect((onCleanup) => {
      this.reload();
      const id = this.deviceId();
      this.loading.set(true);
      const subscription = this.api
        .watchConfigurationChanges(id, () => !this.running())
        .valueChanges.subscribe({
          next: (result) => {
            this.loading.set(result.loading);
            if (result.dataState === 'complete' && !result.error) {
              this.runs.set(result.data.fleetDevice.ermConfigurationChanges);
              this.writesEnabled.set(result.data.fleetDevice.ermConfigurationWritesEnabled);
            }
            if (result.error) {
              this.error.set(requestError(result.error, this.text().unavailable));
            }
          },
          error: (error: unknown) => {
            this.loading.set(false);
            this.error.set(requestError(error, this.text().unavailable));
          },
        });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  protected async submit(): Promise<void> {
    if (!this.primary() || this.submitting() || this.running()) {
      return;
    }
    const value = this.form.getRawValue();
    if (value.mode !== 'READ_EDATA' && !this.writesEnabled()) {
      return;
    }
    const accepted = await confirmAction(this.confirmation, this.language(), {
      header: this.text().start,
      message: interpolate(this.text().confirm, {
        target: this.target(),
        operation: this.text().modes[value.mode],
      }),
      acceptLabel: this.text().start,
      danger: value.mode !== 'READ_EDATA',
    });
    if (!accepted) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    try {
      if (value.mode === 'PARAMETER') {
        await this.api.startParameterChange({
          deviceId: this.deviceId(),
          parameter: value.parameter,
          value: value.value,
          restoreAfter: value.restoreAfter,
        });
      } else {
        const input: StartErmEdataChangeInput = {
          deviceId: this.deviceId(),
          ...(value.mode === 'READ_EDATA' ? { read: true } : { restoreAfter: value.restoreAfter }),
          ...(value.mode === 'INTERVAL'
            ? { parameterId: value.parameterId, intervalSeconds: value.intervalSeconds }
            : {}),
          ...(value.mode === 'ADD_DEFINITION' ? { definitionHex: value.definitionHex } : {}),
          ...(value.mode === 'GLOBALS' ? { globalsHex: value.globalsHex } : {}),
        };
        await this.api.startEdataChange(input);
      }
      this.reload.update((value) => value + 1);
    } catch (error) {
      this.error.set(requestError(error, this.text().uncertain));
      this.reload.update((value) => value + 1);
    } finally {
      this.submitting.set(false);
    }
  }

  protected refreshHistory(): void {
    this.error.set(null);
    this.reload.update((value) => value + 1);
  }
  protected severity(status: Run['status']) {
    return toneSeverity(
      status === 'UNCERTAIN' || status === 'RESTORE_FAILED' || status === 'FAILED'
        ? 'danger'
        : status === 'MISMATCH' || status === 'REFUSED'
          ? 'warn'
          : status === 'RUNNING'
            ? 'info'
            : 'success',
    );
  }
  protected date(value: string | null): string {
    return formatDateTime(value, this.language(), this.units.preferences().timeZone, true);
  }
  protected steps(value: unknown): readonly Step[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const entries: unknown[] = value;
    return entries.flatMap((step) => {
      if (
        typeof step !== 'object' ||
        step === null ||
        !('name' in step) ||
        typeof step.name !== 'string' ||
        !('time' in step) ||
        typeof step.time !== 'string' ||
        !('outcome' in step) ||
        typeof step.outcome !== 'string'
      ) {
        return [];
      }
      return [
        {
          name: step.name,
          time: step.time,
          outcome: step.outcome,
          payload: 'payload' in step && typeof step.payload === 'string' ? step.payload : null,
        },
      ];
    });
  }
  protected stepLabel(value: string): string {
    const labels: Readonly<Record<string, string>> = this.text().steps;
    return labels[value] ?? value;
  }
}
