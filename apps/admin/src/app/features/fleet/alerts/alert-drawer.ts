import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  type ElementRef,
  inject,
  Injector,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { FleetRecordLinks } from '../fleet-record-links';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { RouteDrawer, type RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { FormField } from '../../../ui/form-field/form-field';
import { FormatDateTimePipe, FormatRelativePipe } from '../../../ui/format/format.pipes';
import { textValidator, validationMessage } from '../../../ui/forms/validators';
import { lockWhileSaving } from '../../../ui/forms/saving';
import { uiMessages } from '../../../ui/i18n/messages';
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
 * its workflow (acknowledge, resolve, reopen). Remarks are optional. The host applies
 * the action and passes back `busy` and `saveError`.
 */
@Component({
  selector: 'holita-alert-drawer',
  imports: [
    RouterLink,
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
  readonly recordLinks = input<FleetRecordLinks | null>(null);
  readonly alert = input<AlertRow | null>(null);
  readonly dataAsOf = input.required<string>();
  /** The action being applied, if any. */
  readonly busy = input<AlertAction | null>(null);
  readonly saveError = input<string | null>(null);
  readonly state = input<RouteDrawerState>('ready');
  readonly loadError = input<string | null>(null);
  readonly closeLink = input<readonly unknown[] | null>(null);
  readonly fieldError = input<string | null>(null);
  readonly clockError = input<string | null>(null);
  readonly action = output<{ readonly action: AlertAction; readonly remark: string }>();
  readonly openVehicle = output<string>();
  readonly closed = output();
  readonly retry = output();
  readonly retryClock = output();

  private readonly language = inject(UI_LANGUAGE);
  private readonly injector = inject(Injector);
  private readonly drawer = viewChild.required(RouteDrawer);
  private readonly remarkElement = viewChild<ElementRef<HTMLTextAreaElement>>('remarkElement');
  private readonly catalog = computed(() => alertsText(this.language()));
  protected readonly text = computed(() => this.catalog().drawer);
  protected readonly clockRetry = computed(() => uiMessages[this.language()].retry);

  protected readonly remark = new FormControl('', {
    nonNullable: true,
    validators: textValidator(1000),
  });
  private readonly events = toSignal(this.remark.events);

  protected readonly title = computed(() => this.alert()?.kind ?? this.text().title);
  protected readonly subtitle = computed(() => {
    const alert = this.alert();
    return alert ? `${alert.plate} · ${alert.detail}` : null;
  });
  protected readonly dirty = computed(() => {
    this.events();
    return this.remark.dirty;
  });
  protected readonly remarkError = computed(() => {
    this.events();
    if (this.fieldError()) {
      return this.fieldError();
    }
    if (!this.remark.invalid || !this.remark.touched) {
      return null;
    }
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
        this.remark.reset(alert?.remark ?? '');
      });
    });
    effect(() => {
      if (this.fieldError()) {
        afterNextRender(
          () => {
            const input = this.remarkElement()?.nativeElement;
            if (input?.isConnected) {
              input.focus();
            }
          },
          { injector: this.injector },
        );
      }
    });
    lockWhileSaving(
      this.remark,
      () => this.busy() !== null,
      () => {
        this.drawer().keepFocusInside();
      },
    );
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
    if (this.busy() || this.state() !== 'ready' || !this.alert()) {
      return;
    }
    this.remark.markAsTouched();
    const remark = this.remark.value.trim();
    if (this.remark.invalid) {
      document.getElementById('alert-remark')?.focus();
      return;
    }
    this.action.emit({ action, remark });
  }

  /** Close button, Escape and backdrop: an unsaved remark is confirmed first. */
  protected async requestClose(): Promise<void> {
    if (await this.canLeave()) {
      this.closed.emit();
    }
  }

  protected close(): void {
    this.drawer().close();
  }
  markSaved(): void {
    this.remark.markAsPristine();
  }

  canLeave(): Promise<boolean> | boolean {
    return this.busy() ? false : this.drawer().confirmLeave(this.dirty());
  }

  protected async requestVehicle(): Promise<void> {
    if (await this.canLeave()) {
      this.remark.markAsPristine();
      const alert = this.alert();
      if (alert) {
        this.openVehicle.emit(alert.vehicleId);
      }
    }
  }
}
