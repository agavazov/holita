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
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import { requestError } from '../../../core/graphql/request-error';
import { injectDrawerHost } from '../../../ui/drawer/drawer-host';
import { drawerParam, drawerRouteData } from '../../../ui/drawer/drawer-route';
import type { RouteDrawerState } from '../../../ui/drawer/route-drawer';
import { errorCode } from '../../../ui/forms/field-errors';
import { interpolate } from '../../../ui/i18n/messages';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import { GroupDrawer, type GroupForm } from '../settings/group-drawer';
import { settingsText } from '../settings/i18n/messages';
import {
  vehicleGroupFieldErrors,
  vehicleGroupForm,
  vehicleGroupInput,
} from './vehicle-group-mapping';
import { VehicleGroupsApi } from './vehicle-groups-api';

@Component({
  selector: 'holita-vehicle-group-editor-page',
  imports: [GroupDrawer],
  providers: [VehicleGroupsApi],
  template: `
    <holita-group-drawer
      [group]="group()"
      [state]="state()"
      [loadError]="loadFailure()"
      [closeLink]="listLink"
      [saving]="saving()"
      [saveError]="saveFailure()"
      [fieldErrors]="fieldErrors()"
      (save)="save($event)"
      (retry)="retry.next()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleGroupEditorPage implements OnInit {
  private readonly api = inject(VehicleGroupsApi);
  private readonly language = inject(UI_LANGUAGE);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = injectDrawerHost();
  private readonly drawer = viewChild(GroupDrawer);
  private readonly routeData = drawerRouteData(this.route);
  private closingAfterSave = false;
  readonly id = this.routeData.mode === 'create' ? null : drawerParam(this.route, 'recordId');
  readonly listLink = [
    '/',
    this.language(),
    drawerParam(this.route, 'branchId'),
    'fleet',
    'settings',
    'groups',
  ];
  readonly group = signal<GroupForm | null>(null);
  readonly state = signal<RouteDrawerState>('loading');
  readonly saving = signal(false);
  readonly loadError = signal<unknown>(null);
  readonly saveError = signal<unknown>(null);
  protected readonly retry = new Subject<void>();
  private readonly text = computed(() => settingsText(this.language()).groups);
  protected readonly loadFailure = computed(() =>
    requestError(this.loadError(), this.text().errorText),
  );
  protected readonly saveFailure = computed(() =>
    this.saveError() ? requestError(this.saveError(), this.text().drawer.saveError) : null,
  );
  protected readonly fieldErrors = computed(() => vehicleGroupFieldErrors(this.saveError()));

  ngOnInit(): void {
    const branch = drawerParam(this.route, 'branchId');
    if (!branch) {
      throw new Error('A Vehicle groups editor needs a Branch.');
    }
    this.api.initialize(branch, this.language());
    if (this.id === null && this.routeData.mode === 'create') {
      this.state.set('ready');
      return;
    }
    const id = this.id;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.state.set('invalid-id');
      return;
    }
    this.retry
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.state.set('loading');
          this.loadError.set(null);
          return this.api.watchGroup(id).valueChanges.pipe(
            catchError((error: unknown) => {
              this.failRead(error);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result.error) {
          this.failRead(result.error);
        } else if (result.dataState === 'complete' && !result.loading) {
          if (this.state() !== 'ready') {
            this.group.set(vehicleGroupForm(result.data.fleetVehicleGroup));
          }
          this.state.set('ready');
        }
      });
  }

  private failRead(error: unknown): void {
    this.loadError.set(error);
    this.state.set(errorCode(error) === 'NOT_FOUND' ? 'not-found' : 'error');
  }

  async save(form: GroupForm): Promise<void> {
    if (this.saving() || this.state() !== 'ready') {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const input = vehicleGroupInput(form);
      const result = this.id
        ? await this.api.update({ id: this.id, input })
        : await this.api.create({ input });
      if (this.destroyRef.destroyed) {
        return;
      }
      this.drawer()?.markSaved();
      this.saving.set(false);
      this.closingAfterSave = true;
      this.host.saved({
        recordId: result.id,
        message: interpolate(this.id ? this.text().saved : this.text().created, {
          name: result.name,
        }),
      });
      await this.close();
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

  close(): Promise<boolean> {
    return this.router.navigate(this.listLink, {
      queryParamsHandling: 'preserve',
      preserveFragment: true,
    });
  }

  canLeave(): boolean | Promise<boolean> {
    return this.closingAfterSave || (this.drawer()?.canLeave() ?? true);
  }
}
