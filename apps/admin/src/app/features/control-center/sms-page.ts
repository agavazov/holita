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
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import type { AdminControlCenterSmsDevicesQuery } from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { interpolate } from '../../ui/i18n/messages';
import { toneSeverity } from '../../ui/tones';
import { ControlCenterApi } from './control-center-api';
import { controlCenterText } from './control-center-text';
import { smsGroups, smsMaxBytes, smsTexts, type SmsGroup } from './sms-texts';
import bg from './sms-ui.bg.json';
import en from './sms-ui.en.json';

type SmsDevice = AdminControlCenterSmsDevicesQuery['fleetDevices']['items'][number];
const smsUiText: Record<Language, typeof en> = { bg, en };

/** Prepares supported SMS texts for the current device; sending happens in the phone app. */
@Component({
  selector: 'holita-control-center-sms',
  imports: [RouterLink, Copy, Envelope, ButtonDirective, Message, Skeleton, Tag, EmptyState],
  providers: [ControlCenterApi],
  templateUrl: './sms-page.html',
  styleUrl: './control-center.css',
  styles: `
    :host {
      display: block;
    }
    .sms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
      gap: var(--p-app-stack-gap);
    }
    .sms-card {
      border-block-start: var(--p-app-space-1) solid var(--p-app-tone-info-solid);
    }
    .sms-card--route {
      border-block-start-color: var(--p-app-accent-solid);
    }
    .sms-card--karma {
      border-block-start-color: var(--p-app-tone-warn-solid);
    }
    .sms-card h3,
    .sms-card p {
      margin: 0;
    }
    .sms-card code {
      display: block;
    }
    .sms-replies {
      display: grid;
      gap: var(--p-app-space-2);
      margin: 0;
    }
    .sms-replies dt {
      font-weight: 600;
    }
    .sms-replies dd {
      margin: var(--p-app-space-1) 0 0;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmsPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  readonly deviceId = input.required<string>();
  readonly text = computed(() => controlCenterText[this.language()]);
  readonly sms = computed(() => this.text().sms);
  readonly ui = computed(() => smsUiText[this.language()]);
  private readonly api = inject(ControlCenterApi);
  private readonly notifications = inject(MessageService);
  readonly maxBytes = smsMaxBytes;
  readonly device = signal<SmsDevice | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().deviceUnavailable));
  private readonly reload = signal(0);
  readonly groups = computed(() => {
    const password = this.device()?.smsPassword;
    const texts = password ? smsTexts(password) : [];
    return password
      ? smsGroups.map((group) => ({ group, texts: texts.filter((text) => text.group === group) }))
      : [];
  });

  constructor() {
    effect((onCleanup) => {
      this.reload();
      const id = this.deviceId();
      this.loading.set(true);
      this.error.set(null);
      const subscription = this.api.watchSmsDevices(id).valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ?? null);
          if (result.dataState === 'complete' && !result.error) {
            this.device.set(
              result.data.fleetDevices.items.find((device) => device.id === id) ?? null,
            );
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
    return device.vehicle
      ? [device.vehicle.licensePlate, device.vehicle.fleetNumber].filter(Boolean).join(' · ')
      : device.imei;
  }
  format(template: string, values: Readonly<Record<string, string | number>>): string {
    return interpolate(template, values);
  }
  severity(group: SmsGroup) {
    return toneSeverity(group === 'karma' ? 'warn' : group === 'route' ? 'accent' : 'info');
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
      this.notifications.add({ severity: 'success', summary: sms.copied, life: 3000 });
    } catch {
      getSelection()?.selectAllChildren(element);
      this.notifications.add({ severity: 'info', summary: sms.selected, detail: sms.copyByHand });
    }
  }
}
