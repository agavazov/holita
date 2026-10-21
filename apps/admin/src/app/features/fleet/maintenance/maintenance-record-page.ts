import { fleetRecordLinks, type FleetRecordLinks } from '../fleet-record-links';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EMPTY, Subject, catchError, filter, forkJoin, of, startWith, switchMap, take } from 'rxjs';
import type { AdminServiceTaskDetailsFragment } from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import { injectDrawerHost } from '../../../ui/drawer/drawer-host';
import { drawerParam, drawerRouteData } from '../../../ui/drawer/drawer-route';
import type { RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { errorCode } from '../../../ui/forms/field-errors';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { maintenanceText } from './i18n/messages';
import { MaintenanceApi } from './maintenance-api';
import { MaintenanceChoices } from './maintenance-choices';
import { ServiceCompletionDrawer, type ServiceCompletionForm } from './service-completion-drawer';
import { ServiceTaskDrawer, type ServiceTaskForm } from './service-task-drawer';
import {
  serviceCompletedForm,
  serviceCompletionFieldErrors,
  serviceCompletionInput,
  serviceCompletionTask,
  serviceTaskFieldErrors,
  serviceTaskForm,
  serviceTaskInput,
  serviceTaskUpdateInput,
} from './service-task-mapping';

/** One routed record owns its read and write scope across edit, completion and receipt modes. */
@Component({
  selector: 'holita-maintenance-record-page',
  imports: [ServiceTaskDrawer, ServiceCompletionDrawer],
  providers: [MaintenanceApi, MaintenanceChoices],
  template: `
    @if (completionMode()) {
      <holita-service-completion-drawer
        [vehicleLink]="completionVehicleLink()"
        [task]="completionTask()"
        [completed]="completed()"
        [businessDate]="businessDate()"
        [allowNext]="allowNext()"
        [state]="state()"
        [loadError]="loadFailure()"
        [closeLink]="listLink"
        [saving]="saving()"
        [saveError]="saveFailure()"
        [fieldErrors]="completionErrors()"
        (retry)="retry.next()"
        (save)="complete($event)"
      />
    } @else {
      <holita-service-task-drawer
        [recordLinks]="recordLinks"
        [task]="task()"
        [readOnly]="readOnly()"
        [readOnlyTitle]="readOnlyTitle()"
        [vehicles]="assignableVehicles()"
        [state]="state()"
        [loadError]="loadFailure()"
        [closeLink]="listLink"
        [choicesError]="choicesFailure()"
        [saving]="saving()"
        [saveError]="saveFailure()"
        [fieldErrors]="taskErrors()"
        (retry)="retry.next()"
        (retryChoices)="choices.load()"
        (save)="save($event)"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceRecordPage implements OnInit {
  private readonly api = inject(MaintenanceApi);
  protected readonly choices = inject(MaintenanceChoices);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly language = inject(UI_LANGUAGE);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  private readonly baseLinks = fleetRecordLinks(
    this.language(),
    drawerParam(this.route, 'branchId') ?? '',
  );
  protected readonly recordLinks: FleetRecordLinks = {
    ...this.baseLinks,
    vehicle: (id) =>
      this.host.closeLink && this.host.vehicleId === id
        ? {
            commands: this.host.closeLink,
            queryParams: this.route.snapshot.queryParams,
            fragment: this.route.snapshot.fragment ?? undefined,
          }
        : this.baseLinks.vehicle(id),
  };
  protected readonly completionVehicleLink = computed(() => {
    const record = this.record();
    return record ? this.recordLinks.vehicle(record.vehicleId) : null;
  });
  private readonly taskDrawer = viewChild(ServiceTaskDrawer);
  private readonly completionDrawer = viewChild(ServiceCompletionDrawer);
  private readonly routeData = drawerRouteData(this.route);
  private readonly completionAction = this.route.snapshot.data['action'] === 'complete';
  private closingAfterSave = false;
  readonly id =
    this.routeData.mode === 'create'
      ? null
      : drawerParam(this.route, this.routeData.recordParam ?? 'recordId');
  readonly listLink = this.host.closeLink ?? [
    '/',
    this.language(),
    drawerParam(this.route, 'branchId'),
    'fleet',
    'maintenance',
  ];
  readonly record = signal<AdminServiceTaskDetailsFragment | null>(null);
  readonly businessDate = signal<string | null>(null);
  readonly state = signal<RouteDrawerState>('loading');
  readonly saving = signal(false);
  readonly loadError = signal<unknown>(null);
  readonly saveError = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  private readonly text = computed(() => maintenanceText(this.language()));
  readonly completionMode = computed(
    () =>
      this.record()?.status === 'DONE' ||
      (this.completionAction && this.record()?.status !== 'CANCELLED'),
  );
  readonly readOnly = computed(
    () =>
      this.routeData.mode === 'view' ||
      (this.record() !== null && this.record()?.status !== 'PLANNED'),
  );
  readonly task = computed(() => {
    const record = this.record();
    return record ? serviceTaskForm(record) : null;
  });
  readonly completionTask = computed(() => {
    const record = this.record();
    return record ? serviceCompletionTask(record, this.language()) : null;
  });
  readonly completed = computed(() => {
    const record = this.record();
    return record ? serviceCompletedForm(record) : null;
  });
  readonly allowNext = computed(() => this.record()?.vehicle.status !== 'INACTIVE');
  protected readonly readOnlyTitle = computed(() => {
    const record = this.record();
    return record?.status === 'PLANNED' && this.readOnly()
      ? interpolate(this.text().drawer.recordTitle, {
          task: record.title ?? this.text().serviceTypes[record.serviceType],
        })
      : null;
  });
  protected readonly assignableVehicles = computed(() => {
    const record = this.record();
    const vehicles = this.choices
      .vehicles()
      .filter((vehicle) => vehicle.status !== 'INACTIVE' || vehicle.id === record?.vehicleId);
    return record && !vehicles.some((vehicle) => vehicle.id === record.vehicleId)
      ? [
          ...vehicles,
          {
            id: record.vehicleId,
            name: record.vehicle.licensePlate,
            status: record.vehicle.status,
          },
        ]
      : vehicles;
  });
  protected readonly loadFailure = computed(() =>
    requestError(this.loadError(), this.text().table.errorText),
  );
  protected readonly saveFailure = computed(() =>
    this.saveError()
      ? requestError(
          this.saveError(),
          this.completionMode() ? this.text().completion.saveError : this.text().drawer.saveError,
        )
      : null,
  );
  protected readonly choicesFailure = computed(() =>
    this.choices.error() ? requestError(this.choices.error(), this.text().table.errorText) : null,
  );
  protected readonly taskErrors = computed(() => serviceTaskFieldErrors(this.saveError()));
  protected readonly completionErrors = computed(() =>
    serviceCompletionFieldErrors(this.saveError()),
  );

  ngOnInit(): void {
    const branch = drawerParam(this.route, 'branchId');
    if (!branch) {
      throw new Error('A Maintenance record needs a Branch.');
    }
    this.api.initialize(branch, this.language());
    if (this.routeData.mode === 'create') {
      this.choices.load();
      this.state.set('ready');
      return;
    }
    const id = this.id;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.state.set('invalid-id');
      return;
    }
    this.choices.load();
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.loadError.set(null);
          const record = this.api.watchTask(id).valueChanges.pipe(
            filter((result) => !result.loading),
            take(1),
          );
          const summary = this.completionAction
            ? this.api.watchSummary().valueChanges.pipe(
                filter((result) => !result.loading),
                take(1),
              )
            : of(null);
          return forkJoin({ record, summary }).pipe(
            catchError((error: unknown) => {
              this.failRead(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ record, summary }) => {
        if (record.error || summary?.error) {
          this.failRead(record.error ?? summary?.error);
          return;
        }
        if (record.dataState !== 'complete' || (summary && summary.dataState !== 'complete')) {
          this.failRead(new Error('Missing service task result.'));
          return;
        }
        if (this.host.vehicleId && record.data.fleetServiceTask.vehicleId !== this.host.vehicleId) {
          this.state.set('not-found');
          return;
        }
        this.record.set(record.data.fleetServiceTask);
        if (summary?.dataState === 'complete') {
          this.businessDate.set(summary.data.fleetServiceSummary.businessDate);
        }
        this.state.set('ready');
      });
  }
  private failRead(error: unknown): void {
    this.loadError.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }
  async save(form: ServiceTaskForm): Promise<void> {
    if (this.state() !== 'ready' || this.saving() || this.readOnly() || this.completionMode()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const result = this.id
        ? await this.api.update({ id: this.id, input: serviceTaskUpdateInput(form) })
        : await this.api.create({ input: serviceTaskInput(form) });
      if (this.destroyRef.destroyed) {
        return;
      }
      this.taskDrawer()?.markSaved();
      await this.finish(
        result.id,
        interpolate(this.id ? this.text().notices.saved : this.text().notices.created, {
          task: result.title ?? this.text().serviceTypes[result.serviceType],
        }),
      );
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.saveError.set(error);
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.saving.set(false);
        this.closingAfterSave = false;
      }
    }
  }
  async complete(form: ServiceCompletionForm): Promise<void> {
    const record = this.record();
    if (
      this.state() !== 'ready' ||
      this.saving() ||
      !this.completionAction ||
      !record ||
      record.status !== 'PLANNED' ||
      !this.businessDate()
    ) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const result = await this.api.complete({
        id: record.id,
        input: serviceCompletionInput(form),
      });
      if (this.destroyRef.destroyed) {
        return;
      }
      this.completionDrawer()?.markSaved();
      await this.finish(
        result.completed.id,
        interpolate(
          result.next ? this.text().notices.completedAndPlanned : this.text().notices.completed,
          {
            task: result.completed.title ?? this.text().serviceTypes[result.completed.serviceType],
          },
        ),
      );
    } catch (error: unknown) {
      if (!this.destroyRef.destroyed) {
        this.saveError.set(error);
      }
    } finally {
      if (!this.destroyRef.destroyed) {
        this.saving.set(false);
        this.closingAfterSave = false;
      }
    }
  }
  private async finish(recordId: string, message: string): Promise<void> {
    this.saving.set(false);
    this.closingAfterSave = true;
    this.host.saved({ recordId, message });
    await this.close();
  }
  close(): Promise<boolean> {
    return this.router.navigate(this.listLink, {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }
  canLeave(): boolean | Promise<boolean> {
    return (
      this.closingAfterSave ||
      (!this.saving() &&
        ((this.completionMode()
          ? this.completionDrawer()?.canLeave()
          : this.taskDrawer()?.canLeave()) ??
          true))
    );
  }
}
