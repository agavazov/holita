import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type {
  AdminBranchesQuery,
  AdminDeviceConfigurationPageQuery,
  AdminRequestDeviceConfigurationReadMutationVariables,
  AdminRequestDeviceParameterAdditionMutationVariables,
  AdminRequestDeviceParameterIntervalUpdateMutationVariables,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { injectPageRecord } from '../../../layout/page-record';
import { drawerParam } from '../../../ui/drawer/drawer-route';
import { errorCode, fieldErrors } from '../../../ui/forms/field-errors';
import { DeviceConfigurationApi } from './device-configuration-api';
import {
  DeviceConfigurationView,
  deviceReadPending,
  type DeviceConfigurationOperation,
  type DeviceConfigurationState,
  type DeviceConfigurationTarget,
} from './device-configuration-view';
import { deviceConfigurationText } from './i18n/messages';

@Component({
  selector: 'holita-device-configuration-page',
  imports: [DeviceConfigurationView],
  providers: [DeviceConfigurationApi],
  template: `
    <holita-device-configuration-view
      [state]="state()"
      [device]="data()?.fleetDevice ?? null"
      [enabled]="data()?.fleetDeviceOperationsEnabled ?? false"
      [writesEnabled]="data()?.fleetDeviceConfigurationWritesEnabled ?? false"
      [presets]="data()?.fleetDeviceParameterPresets ?? []"
      [acceptedOperationId]="acceptedWrite()"
      [writeError]="writeFailure()"
      [writeFieldErrors]="writeFieldErrors()"
      [operations]="operations()"
      [lastSnapshot]="data()?.fleetDeviceConfigurationSnapshot ?? null"
      [targets]="targets()"
      [targetsState]="targetsState()"
      [targetsError]="targetsFailure()"
      [requesting]="requesting()"
      [refreshing]="refreshing()"
      [reconciling]="reconciling()"
      [loadError]="failure()"
      [pollError]="pollFailure()"
      [requestError]="requestFailure()"
      [backLink]="backLink()"
      (refresh)="refresh()"
      (retryTargets)="loadTargets()"
      (requestRead)="requestRead($event)"
      (requestAddition)="requestAddition($event)"
      (requestIntervalUpdate)="requestIntervalUpdate($event)"
      (writeDraftChanged)="clearWriteError()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceConfigurationPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly language = input.required<Language>();
  private readonly api = inject(DeviceConfigurationApi);
  private readonly route = inject(ActivatedRoute);
  private readonly notices = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly view = viewChild(DeviceConfigurationView);
  private readonly id = drawerParam(this.route, 'recordId')?.toLowerCase() ?? null;
  private readonly reload = new Subject<void>();
  private readonly reloadTargets = new Subject<void>();
  private targetsStarted = false;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  readonly state = signal<DeviceConfigurationState>('loading');
  readonly data = signal<AdminDeviceConfigurationPageQuery | null>(null);
  readonly operations = signal<readonly DeviceConfigurationOperation[]>([]);
  readonly targets = signal<readonly DeviceConfigurationTarget[]>([]);
  readonly targetsState = signal<'loading' | 'ready' | 'error'>('loading');
  readonly requesting = signal(false);
  readonly acceptedWrite = signal<string | null>(null);
  readonly refreshing = signal(false);
  readonly reconciling = signal(false);
  private readonly loadError = signal<unknown>(null);
  private readonly targetsError = signal<unknown>(null);
  private readonly requestError = signal<unknown>(null);
  private readonly writeError = signal<unknown>(null);
  private readonly text = computed(() => deviceConfigurationText(this.language()));
  protected readonly backLink = computed(() => [
    '/',
    this.language(),
    this.branch().id,
    'fleet',
    'devices',
  ]);
  protected readonly failure = computed(() =>
    this.loadError() ? requestError(this.loadError(), this.text().loadError) : null,
  );
  protected readonly pollFailure = computed(() =>
    this.loadError() && this.data() ? this.text().pollError : null,
  );
  protected readonly targetsFailure = computed(() =>
    this.targetsError() ? requestError(this.targetsError(), this.text().targetsError) : null,
  );
  protected readonly requestFailure = computed(() =>
    this.requestError() ? requestError(this.requestError(), this.text().requestError) : null,
  );
  protected readonly writeFailure = computed(() =>
    this.writeError() ? requestError(this.writeError(), this.text().editor.requestError) : null,
  );
  protected readonly writeFieldErrors = computed(() =>
    fieldErrors(this.writeError(), ['catalogId', 'parameterId', 'intervalSeconds']),
  );

  constructor() {
    injectPageRecord(() => this.data()?.fleetDevice.imei ?? null);
    this.destroyRef.onDestroy(() => {
      this.clearPoll();
    });
  }

  ngOnInit(): void {
    if (
      !this.id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.id)
    ) {
      this.state.set('invalid-id');
      return;
    }
    const id = this.id;
    this.api.initialize(this.branch().id, this.language());
    this.reloadTargets
      .pipe(
        switchMap(() => {
          this.targetsState.set('loading');
          this.targetsError.set(null);
          return this.api.watchTargets().valueChanges.pipe(
            catchError((error: unknown) => {
              this.failTargets(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.error) {
          this.failTargets(result.error);
        } else if (result.dataState === 'complete' && !result.loading) {
          this.targets.set(result.data.karmaCars);
          this.targetsState.set('ready');
        }
      });
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.clearPoll();
          this.refreshing.set(true);
          this.loadError.set(null);
          return this.api.watchPage(id).valueChanges.pipe(
            catchError((error: unknown) => {
              this.failPage(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.error) {
          this.failPage(result.error);
        } else if (result.dataState === 'complete' && !result.loading) {
          this.data.set(result.data);
          this.operations.set(result.data.fleetDeviceOperations);
          this.state.set('ready');
          this.refreshing.set(false);
          this.reconciling.set(false);
          if (result.data.fleetDeviceOperationsEnabled && !this.targetsStarted) {
            this.targetsStarted = true;
            this.loadTargets();
          }
          this.schedulePoll();
        }
      });
  }

  refresh(): void {
    if (!this.destroyRef.destroyed && this.id && this.state() !== 'invalid-id') {
      this.reload.next();
    }
  }

  loadTargets(): void {
    if (!this.destroyRef.destroyed) {
      this.reloadTargets.next();
    }
  }

  async requestRead(input: AdminRequestDeviceConfigurationReadMutationVariables['input']) {
    if (
      this.requesting() ||
      this.refreshing() ||
      this.reconciling() ||
      this.state() !== 'ready' ||
      !this.data()?.fleetDeviceOperationsEnabled ||
      input.deviceId !== this.id ||
      this.operations().some(deviceReadPending)
    ) {
      return;
    }
    this.requesting.set(true);
    this.requestError.set(null);
    try {
      const operation = await this.api.requestRead(input);
      if (this.destroyRef.destroyed) {
        return;
      }
      this.operations.set(
        [operation, ...this.operations().filter((previous) => previous.id !== operation.id)].slice(
          0,
          20,
        ),
      );
      this.notices.add({
        severity: 'info',
        summary: this.text().title,
        detail: this.text().requestAccepted,
      });
      this.refresh();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.requestError.set(error);
        this.reconciling.set(true);
        if (errorCode(error) === 'CONFLICT') {
          this.loadTargets();
        }
        // A lost HTTP response may still have created the durable request.
        this.refresh();
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.requesting.set(false);
      }
    }
  }

  requestAddition(
    input: AdminRequestDeviceParameterAdditionMutationVariables['input'],
  ): Promise<void> {
    return this.requestParameterChange(input, () => this.api.requestAddition(input));
  }

  requestIntervalUpdate(
    input: AdminRequestDeviceParameterIntervalUpdateMutationVariables['input'],
  ): Promise<void> {
    return this.requestParameterChange(input, () => this.api.requestIntervalUpdate(input));
  }

  canLeave(): boolean | Promise<boolean> {
    return this.view()?.canLeave() ?? true;
  }

  clearWriteError(): void {
    this.writeError.set(null);
  }

  private async requestParameterChange(
    input: AdminRequestDeviceParameterIntervalUpdateMutationVariables['input'],
    submit: () => Promise<DeviceConfigurationOperation>,
  ): Promise<void> {
    const baseline = this.data()?.fleetDeviceConfigurationSnapshot;
    if (
      this.requesting() ||
      this.refreshing() ||
      this.reconciling() ||
      this.state() !== 'ready' ||
      !this.data()?.fleetDeviceConfigurationWritesEnabled ||
      input.deviceId !== this.id ||
      !baseline ||
      baseline.id !== input.baselineOperationId ||
      baseline.karmaCarId !== input.karmaCarId ||
      baseline.karmaDeviceId !== input.expectedKarmaDeviceId ||
      this.operations().some(deviceReadPending)
    ) {
      return;
    }
    this.requesting.set(true);
    this.writeError.set(null);
    try {
      const operation = await submit();
      if (this.destroyRef.destroyed) {
        return;
      }
      this.operations.set(
        [operation, ...this.operations().filter((previous) => previous.id !== operation.id)].slice(
          0,
          20,
        ),
      );
      this.acceptedWrite.set(operation.id);
      this.notices.add({
        severity: 'info',
        summary: this.text().title,
        detail: this.text().editor.accepted,
      });
      this.refresh();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.writeError.set(error);
        this.reconciling.set(true);
        if (errorCode(error) === 'CONFLICT') {
          this.loadTargets();
        }
        this.refresh();
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.requesting.set(false);
      }
    }
  }

  private schedulePoll(): void {
    this.clearPoll();
    if (
      (this.reconciling() || this.operations().some(deviceReadPending)) &&
      !this.destroyRef.destroyed
    ) {
      this.pollTimer = setTimeout(() => {
        this.refresh();
      }, 5000);
    }
  }

  private clearPoll(): void {
    if (this.pollTimer !== undefined) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private failTargets(error: unknown): void {
    this.targetsError.set(error);
    this.targetsState.set('error');
  }

  private failPage(error: unknown): void {
    this.loadError.set(error);
    this.refreshing.set(false);
    if (!this.data()) {
      this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
    }
    this.schedulePoll();
  }
}
