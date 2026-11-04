import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Copy } from '@primeicons/angular/copy';
import { Envelope } from '@primeicons/angular/envelope';
import { MessageService } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { TableModule } from 'primeng/table';
import type { AdminControlCenterSmsDevicesQuery } from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { formatNumber } from '../../ui/format/format';
import { interpolate } from '../../ui/i18n/messages';
import { PageHeader } from '../../ui/page-header/page-header';
import { TablePanel } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { ControlCenterApi } from './control-center-api';
import { controlCenterText } from './control-center-text';
import { smsGroups, smsMaxBytes, smsTexts } from './sms-texts';

type SmsDevice = AdminControlCenterSmsDevicesQuery['fleetDevices']['items'][number];

/** What to send by SMS to which truck: SIM number, Simple SMS password and ready texts. */
@Component({
  selector: 'holita-control-center-sms',
  imports: [
    RouterLink,
    Copy,
    Envelope,
    ButtonDirective,
    Message,
    TableModule,
    PageHeader,
    TablePanel,
  ],
  providers: [ControlCenterApi],
  templateUrl: './sms-page.html',
  styleUrl: './control-center.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmsPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  readonly deviceId = input<string | null>(null);
  readonly text = computed(() => controlCenterText[this.language()]);
  readonly sms = computed(() => this.text().sms);
  private readonly api = inject(ControlCenterApi);
  private readonly notifications = inject(MessageService);
  readonly maxBytes = smsMaxBytes;
  readonly devices = signal<SmsDevice[] | null>(null);
  readonly total = signal<number | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().unavailable));
  private readonly reload = signal(0);
  readonly selectedId = signal<string | null>(null);
  /** The chosen device, else the first one with a stored password. */
  readonly selected = computed(() => {
    const devices = this.devices() ?? [];
    return (
      devices.find((device) => device.id === this.selectedId()) ??
      devices.find((device) => device.smsPassword) ??
      devices[0] ??
      null
    );
  });
  readonly groups = computed(() => {
    const password = this.selected()?.smsPassword;
    const texts = password ? smsTexts(password) : [];
    return password
      ? smsGroups.map((group) => ({ group, texts: texts.filter((text) => text.group === group) }))
      : [];
  });
  readonly partial = computed(() => {
    const shown = this.devices()?.length ?? 0;
    const total = this.total() ?? 0;
    return total > shown
      ? interpolate(this.sms().firstDevices, {
          shown: formatNumber(shown, this.language()),
          total: formatNumber(total, this.language()),
        })
      : null;
  });
  readonly view = computed(() =>
    tableView({
      loading: this.loading() && !this.devices(),
      error: this.error(),
      rows: this.devices()?.length ?? null,
      filtered: false,
    }),
  );

  constructor() {
    effect((onCleanup) => {
      this.reload();
      this.loading.set(true);
      this.error.set(null);
      const subscription = this.api.watchSmsDevices(this.deviceId()).valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error) {
            this.devices.set(result.data.fleetDevices.items);
            this.total.set(result.data.fleetDevices.total);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(error);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
      });
    });
  }

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
  }

  label(device: SmsDevice): string {
    const vehicle = device.vehicle;
    return vehicle
      ? [vehicle.licensePlate, vehicle.fleetNumber].filter(Boolean).join(' · ')
      : this.text().noTruck;
  }
  format(template: string, values: Readonly<Record<string, string | number>>): string {
    return interpolate(template, values);
  }
  editLink(device: SmsDevice): string[] {
    return ['/', this.language(), this.branchId(), 'fleet', 'devices', device.id, 'edit'];
  }
  /** RFC 5724: a phone opens its SMS app with the number and text filled in. */
  smsLink(phone: string, text: string): string {
    return `sms:${phone}?body=${encodeURIComponent(text)}`;
  }
  refresh(): void {
    this.reload.update((value) => value + 1);
  }

  async copy(text: string, element: HTMLElement): Promise<void> {
    const sms = this.sms();
    try {
      await navigator.clipboard.writeText(text);
      this.notifications.add({
        severity: 'success',
        summary: sms.copied,
        detail: text,
        life: 3000,
      });
    } catch {
      // Plain http (for example http://dev.lab:11000) has no Clipboard API: select the text instead.
      getSelection()?.selectAllChildren(element);
      this.notifications.add({ severity: 'info', summary: sms.selected, detail: sms.copyByHand });
    }
  }
}
