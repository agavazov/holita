import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { EMPTY, Subject, catchError, startWith, switchMap, type Subscription } from 'rxjs';
import type {
  AdminRequestDeviceRulesReadMutationVariables,
  AdminRequestDeviceRuleChangeMutationVariables,
  AdminBranchesQuery,
  AdminDeviceConfigurationPageQuery,
  AdminRequestDeviceConfigurationReadMutationVariables,
  AdminRequestDeviceParameterAdditionMutationVariables,
  AdminRequestDeviceParameterIntervalUpdateMutationVariables,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { errorCode } from '../../../ui/forms/field-errors';
import { fleetFieldErrors } from '../field-errors';
import { DeviceManagementView } from '../../karma-client/device-management/device-management-view';
import { KarmaEdataApi } from '../../karma-client/edata/karma-edata-api';
import { DeviceConfigurationApi } from './device-configuration-api';
import {
  deviceReadPending,
  type DeviceConfigurationOperation,
  type DeviceConfigurationState,
  type DeviceConfigurationTarget,
  type DeviceParameterMeasurements,
} from './device-configuration-types';
import { deviceConfigurationText } from './i18n/messages';

@Component({
  selector: 'holita-device-configuration-page',
  imports: [DeviceManagementView],
  providers: [DeviceConfigurationApi, KarmaEdataApi],
  template: `
    <holita-device-management-view
      [car]="car()"
      [language]="language()"
      [state]="state()"
      [branchId]="branch().id"
      [enabled]="data()?.fleetDeviceOperationsEnabled ?? false"
      [writesEnabled]="data()?.fleetDeviceConfigurationWritesEnabled ?? false"
      [presets]="data()?.fleetDeviceParameterPresets ?? []"
      [acceptedOperationId]="acceptedWrite()"
      [writeError]="writeFailure()"
      [writeFieldErrors]="writeFieldErrors()"
      [operations]="operations()"
      [lastSnapshot]="data()?.fleetDeviceConfigurationSnapshot ?? null"
      [lastRulesSnapshot]="data()?.fleetDeviceRulesSnapshot ?? null"
      [requesting]="requesting()"
      [refreshing]="refreshing()"
      [reconciling]="reconciling()"
      [readSequence]="readSequence()"
      [loadError]="failure()"
      [pollError]="pollFailure()"
      [requestError]="requestFailure()"
      [measurements]="measurements()"
      (refresh)="refresh()"
      (requestConfiguration)="requestConfiguration($event)"
      (requestRead)="requestRead($event)"
      (requestRulesRead)="requestRulesRead($event)"
      (requestRuleChange)="requestRuleChange($event)"
      (requestAddition)="requestAddition($event)"
      (requestIntervalUpdate)="requestIntervalUpdate($event)"
      (writeDraftChanged)="clearWriteError()"
      (requestMeasurements)="readMeasurements($event)"
      (refreshMeasurements)="refreshMeasurements()"
      (closeMeasurements)="closeMeasurements()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceConfigurationPage implements OnInit {
  readonly branch = input.required<AdminBranchesQuery['branches'][number]>();
  readonly car = input.required<DeviceConfigurationTarget>();
  readonly language = input.required<Language>();
  readonly targetRefresh = output();
  private readonly api = inject(DeviceConfigurationApi);
  private readonly edata = inject(KarmaEdataApi);
  private readonly notices = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly view = viewChild(DeviceManagementView);
  private readonly reload = new Subject<void>();
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  readonly state = signal<DeviceConfigurationState>('loading');
  readonly data = signal<AdminDeviceConfigurationPageQuery | null>(null);
  readonly operations = signal<readonly DeviceConfigurationOperation[]>([]);
  readonly requesting = signal(false);
  readonly acceptedWrite = signal<string | null>(null);
  readonly readSequence = signal<'parameters' | 'rules' | null>(null);
  readonly measurements = signal<DeviceParameterMeasurements | null>(null);
  private measurementSubscription: Subscription | undefined;
  private sequenceOperation: {
    id: string;
    input: AdminRequestDeviceConfigurationReadMutationVariables['input'];
  } | null = null;
  readonly refreshing = signal(false);
  readonly reconciling = signal(false);
  private readonly loadError = signal<unknown>(null);
  private readonly requestError = signal<unknown>(null);
  private readonly writeError = signal<unknown>(null);
  private readonly text = computed(() => deviceConfigurationText(this.language()));
  protected readonly failure = computed(() =>
    this.loadError() ? requestError(this.loadError(), this.text().loadError) : null,
  );
  protected readonly pollFailure = computed(() =>
    this.loadError() && this.data() ? this.text().pollError : null,
  );
  protected readonly requestFailure = computed(() =>
    this.requestError() ? requestError(this.requestError(), this.text().requestError) : null,
  );
  protected readonly writeFailure = computed(() =>
    this.writeError() ? requestError(this.writeError(), this.text().editor.requestError) : null,
  );
  protected readonly writeFieldErrors = computed(() =>
    fleetFieldErrors(
      this.writeError(),
      ['catalogId', 'parameterId', 'intervalSeconds'],
      this.language(),
    ),
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearPoll();
      this.measurementSubscription?.unsubscribe();
    });
  }

  ngOnInit(): void {
    const target = {
      karmaCarId: this.car().id,
      expectedKarmaDeviceId: this.car().deviceId,
    };
    this.api.initialize(this.branch().id, this.language());
    this.edata.initialize(this.language());
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.clearPoll();
          this.refreshing.set(true);
          this.loadError.set(null);
          return this.api.watchPage(target).valueChanges.pipe(
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
          this.schedulePoll();
          void this.continueReadSequence();
        }
      });
  }

  refresh(): void {
    if (!this.destroyRef.destroyed) {
      this.reload.next();
    }
  }

  readMeasurements(parameterId: number): void {
    this.measurementSubscription?.unsubscribe();
    const to = new Date();
    to.setUTCMilliseconds(0);
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
    const measurementWindow = {
      parameterId,
      fromUtc: from.toISOString().replace('.000Z', 'Z'),
      toUtc: to.toISOString().replace('.000Z', 'Z'),
    };
    this.measurements.set({ ...measurementWindow, state: 'loading', items: [] });
    this.measurementSubscription = this.edata
      .watch({
        carId: this.car().id,
        parameterIds: [String(parameterId)],
        fromDate: measurementWindow.fromUtc,
        toDate: measurementWindow.toUtc,
        pageSize: 100,
      })
      .valueChanges.subscribe({
        next: (result) => {
          if (result.error) {
            this.measurements.set({ ...measurementWindow, state: 'error', items: [] });
          } else if (result.dataState === 'complete' && !result.loading) {
            const items = result.data.karmaEdata.items;
            const targetMatches = items.every(
              (row) => row.carId === this.car().id && row.deviceId === this.car().deviceId,
            );
            this.measurements.set({
              ...measurementWindow,
              state: targetMatches ? 'ready' : 'error',
              items: targetMatches ? items : [],
            });
          }
        },
        error: () => {
          this.measurements.set({ ...measurementWindow, state: 'error', items: [] });
        },
      });
  }

  refreshMeasurements(): void {
    const parameterId = this.measurements()?.parameterId;
    if (parameterId !== undefined) {
      this.readMeasurements(parameterId);
    }
  }

  closeMeasurements(): void {
    this.measurementSubscription?.unsubscribe();
    this.measurementSubscription = undefined;
    this.measurements.set(null);
  }

  async requestConfiguration(
    input: AdminRequestDeviceConfigurationReadMutationVariables['input'],
  ): Promise<void> {
    const operation = await this.requestDeviceRead(input, () => this.api.requestRead(input));
    if (operation) {
      this.sequenceOperation = { id: operation.id, input };
      this.readSequence.set('parameters');
      await this.continueReadSequence();
    }
  }

  private async continueReadSequence(): Promise<void> {
    const sequence = this.sequenceOperation;
    if (!sequence || this.requesting() || this.refreshing() || this.reconciling()) {
      return;
    }
    const operation = this.operations().find((row) => row.id === sequence.id);
    if (!operation || deviceReadPending(operation)) {
      return;
    }
    this.sequenceOperation = null;
    if (
      this.readSequence() !== 'parameters' ||
      operation.status !== 'COMPLETE' ||
      !operation.configuration ||
      operation.branchId !== this.branch().id ||
      operation.karmaCarId !== sequence.input.karmaCarId ||
      operation.karmaDeviceId !== sequence.input.expectedKarmaDeviceId
    ) {
      this.readSequence.set(null);
      return;
    }
    this.readSequence.set('rules');
    const rules = await this.requestDeviceRead(sequence.input, () =>
      this.api.requestRulesRead(sequence.input),
    );
    if (rules) {
      this.sequenceOperation = { id: rules.id, input: sequence.input };
      await this.continueReadSequence();
    } else {
      this.readSequence.set(null);
    }
  }

  async requestRead(
    input: AdminRequestDeviceConfigurationReadMutationVariables['input'],
  ): Promise<void> {
    await this.requestDeviceRead(input, () => this.api.requestRead(input));
  }

  async requestRulesRead(
    input: AdminRequestDeviceRulesReadMutationVariables['input'],
  ): Promise<void> {
    await this.requestDeviceRead(input, () => this.api.requestRulesRead(input));
  }

  private async requestDeviceRead(
    input: AdminRequestDeviceConfigurationReadMutationVariables['input'],
    submit: () => Promise<DeviceConfigurationOperation>,
  ): Promise<DeviceConfigurationOperation | undefined> {
    if (
      this.requesting() ||
      this.refreshing() ||
      this.reconciling() ||
      this.state() !== 'ready' ||
      !this.data()?.fleetDeviceOperationsEnabled ||
      input.karmaCarId !== this.car().id ||
      input.expectedKarmaDeviceId !== this.car().deviceId ||
      this.operations().some(deviceReadPending)
    ) {
      return undefined;
    }
    this.requesting.set(true);
    this.requestError.set(null);
    let refreshTarget = false;
    try {
      const operation = await submit();
      if (this.destroyRef.destroyed) {
        return undefined;
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
      return operation;
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.requestError.set(error);
        this.reconciling.set(true);
        refreshTarget = errorCode(error) === 'CONFLICT';
        // A lost HTTP response may still have created the durable request.
        this.refresh();
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.requesting.set(false);
        if (refreshTarget) {
          this.targetRefresh.emit();
        }
      }
    }
    return undefined;
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

  requestRuleChange(input: AdminRequestDeviceRuleChangeMutationVariables['input']): Promise<void> {
    const rules = this.data()?.fleetDeviceRulesSnapshot;
    const parameters = this.data()?.fleetDeviceConfigurationSnapshot;
    if (
      !rules?.rulesConfiguration ||
      rules.status !== 'COMPLETE' ||
      rules.branchId !== this.branch().id ||
      !parameters?.configuration ||
      parameters.status !== 'COMPLETE' ||
      parameters.branchId !== this.branch().id ||
      input.baselineOperationId !== rules.id ||
      input.parameterBaselineOperationId !== parameters.id ||
      rules.karmaCarId !== input.karmaCarId ||
      rules.karmaDeviceId !== input.expectedKarmaDeviceId ||
      parameters.karmaCarId !== input.karmaCarId ||
      parameters.karmaDeviceId !== input.expectedKarmaDeviceId
    ) {
      return Promise.resolve();
    }
    return this.requestParameterChange({ ...input, baselineOperationId: parameters.id }, () =>
      this.api.requestRuleChange(input),
    );
  }

  canLeave(): boolean | Promise<boolean> {
    return !this.requesting() && (this.view()?.canLeave() ?? true);
  }

  clearWriteError(): void {
    this.writeError.set(null);
  }

  private async requestParameterChange(
    input: Pick<
      AdminRequestDeviceParameterIntervalUpdateMutationVariables['input'],
      'karmaCarId' | 'expectedKarmaDeviceId' | 'baselineOperationId'
    >,
    submit: () => Promise<DeviceConfigurationOperation>,
  ): Promise<void> {
    const baseline = this.data()?.fleetDeviceConfigurationSnapshot;
    if (
      this.requesting() ||
      this.refreshing() ||
      this.reconciling() ||
      this.state() !== 'ready' ||
      !this.data()?.fleetDeviceConfigurationWritesEnabled ||
      input.karmaCarId !== this.car().id ||
      input.expectedKarmaDeviceId !== this.car().deviceId ||
      !baseline ||
      baseline.id !== input.baselineOperationId ||
      baseline.branchId !== this.branch().id ||
      baseline.karmaCarId !== input.karmaCarId ||
      baseline.karmaDeviceId !== input.expectedKarmaDeviceId ||
      this.operations().some(deviceReadPending)
    ) {
      return;
    }
    this.requesting.set(true);
    this.writeError.set(null);
    let refreshTarget = false;
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
        detail: this.text().changeAccepted,
      });
      this.refresh();
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.writeError.set(error);
        this.reconciling.set(true);
        refreshTarget = errorCode(error) === 'CONFLICT';
        this.refresh();
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.requesting.set(false);
        if (refreshTarget) {
          this.targetRefresh.emit();
        }
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

  private failPage(error: unknown): void {
    this.loadError.set(error);
    this.refreshing.set(false);
    if (!this.data()) {
      this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
    }
    this.schedulePoll();
  }
}
