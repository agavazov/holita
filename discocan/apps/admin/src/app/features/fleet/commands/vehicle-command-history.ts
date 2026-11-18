import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  type OnInit,
} from '@angular/core';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { ControlCenterApi } from '../../control-center/control-center-api';
import { CommandDetails } from './command-details';
import { CommandHistory } from './command-history';
import { commandPending, commandText, type CommandRequest } from './command-presentation';

@Component({
  selector: 'discocan-vehicle-command-history',
  imports: [CommandHistory, CommandDetails],
  providers: [ControlCenterApi],
  template: `
    <discocan-command-history
      [requests]="requests()"
      [language]="language()"
      [target]="target()"
      [branchId]="branchId()"
      [deviceId]="deviceId()"
      [loading]="loading()"
      [error]="error()"
      (inspect)="selectedId.set($event.id)"
      (retry)="reload.update(increment)"
    />
    <discocan-command-details
      [request]="selected()"
      [language]="language()"
      [target]="target()"
      [canCancel]="false"
      (closed)="selectedId.set(null)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class VehicleCommandHistory implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();
  readonly deviceId = input.required<string>();
  readonly target = input.required<string>();
  private readonly api = inject(ControlCenterApi);
  protected readonly requests = signal<readonly CommandRequest[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly reload = signal(0);
  protected readonly increment = (value: number) => value + 1;
  protected readonly selectedId = linkedSignal<string | null>(() => {
    this.deviceId();
    return null;
  });
  protected readonly selected = computed(
    () => this.requests().find((request) => request.id === this.selectedId()) ?? null,
  );

  constructor() {
    effect((onCleanup) => {
      const deviceId = this.deviceId();
      this.reload();
      this.requests.set([]);
      this.loading.set(true);
      this.error.set(null);
      const query = this.api.watchCommandRequests(deviceId, () =>
        this.requests().every((request) => !commandPending(request)),
      );
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(
            result.error
              ? requestError(result.error, commandText[this.language()].unavailable)
              : null,
          );
          if (result.dataState === 'complete' && !result.error) {
            this.requests.set(result.data.fleetDevice.ermCommandRequests);
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.error.set(requestError(error, commandText[this.language()].unavailable));
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
  }

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
  }
}
