import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateTimePipe, FormatRelativePipe } from '../../../ui/format/format.pipes';
import { textValidator, validationMessage } from '../../../ui/forms/validators';
import { toneSeverity } from '../../../ui/tones';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import {
  type AlertRow,
  type AlertSeverityCode,
  type AlertStatusCode,
  alertStatusTones,
  severityTones,
} from './alerts-view';
import { alertsText } from './i18n/messages';

export type AlertAction = 'acknowledge' | 'resolve' | 'reopen';

/**
 * A view drawer with actions: the alert is read-only, and the footer offers the next steps of
 * its workflow (acknowledge, resolve with a remark, reopen). Presentation only: the host applies
 * the action and passes back `busy` and `saveError`.
 */
@Component({
  selector: 'holita-alert-drawer',
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    Message,
    Tag,
    Textarea,
    RouteDrawer,
    FormField,
    FormatDateTimePipe,
    FormatRelativePipe,
  ],
  templateUrl: './alert-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertDrawer {
  readonly alert = input.required<AlertRow>();
  readonly dataAsOf = input.required<string>();
  /** The action being applied, if any. */
  readonly busy = input<AlertAction | null>(null);
  readonly saveError = input<string | null>(null);
  readonly action = output<{ readonly action: AlertAction; readonly remark: string }>();
  readonly openVehicle = output<string>();
  readonly closed = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly catalog = computed(() => alertsText(this.language()));
  protected readonly text = computed(() => this.catalog().drawer);

  protected readonly remark = new FormControl('', {
    nonNullable: true,
    validators: textValidator(2000),
  });
  private readonly events = toSignal(this.remark.events);
  /** Resolving needs a remark; the message shows after a resolve attempt without one. */
  private readonly remarkMissing = signal(false);

  protected readonly subtitle = computed(() => `${this.alert().plate} · ${this.alert().detail}`);
  protected readonly dirty = computed(() => {
    this.events();
    return this.remark.dirty;
  });
  protected readonly remarkError = computed(() => {
    this.events();
    if (this.remarkMissing()) return this.text().remarkRequired;
    if (!this.remark.invalid || !this.remark.touched) return null;
    return validationMessage(this.remark.errors, this.language());
  });
  protected readonly remarkLength = computed(() => {
    this.events();
    return Array.from(this.remark.value).length;
  });

  constructor() {
    effect(() => {
      const alert = this.alert();
      untracked(() => {
        this.remarkMissing.set(false);
        this.remark.reset(alert.remark);
      });
    });
  }

  protected severitySeverity(severity: AlertSeverityCode) {
    return toneSeverity(severityTones[severity]);
  }

  protected severityLabel(severity: AlertSeverityCode): string {
    return this.catalog().severities[severity];
  }

  protected statusSeverity(status: AlertStatusCode) {
    return toneSeverity(alertStatusTones[status]);
  }

  protected statusLabel(status: AlertStatusCode): string {
    return this.catalog().statuses[status];
  }

  protected apply(action: AlertAction): void {
    if (this.busy()) return;
    this.remark.markAsTouched();
    const remark = this.remark.value.trim();
    if (action === 'resolve' && !remark) {
      this.remarkMissing.set(true);
      document.getElementById('alert-remark')?.focus();
      return;
    }
    this.remarkMissing.set(false);
    if (this.remark.invalid) return;
    this.action.emit({ action, remark });
  }

  /** Close button, Escape and backdrop: an unsaved remark is confirmed first. */
  protected async requestClose(): Promise<void> {
    if (this.busy()) return;
    if (await this.drawer().confirmLeave(this.dirty())) this.closed.emit();
  }
}
