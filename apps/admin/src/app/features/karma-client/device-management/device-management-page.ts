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
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { EMPTY, Subject, catchError, startWith, switchMap } from 'rxjs';
import type { AdminKarmaCarQuery } from '../../../../generated/graphql/operations';
import { DemoSession } from '../../../core/auth/demo-session';
import type { Language } from '../../../i18n/messages';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { KarmaApi } from '../karma-api';
import { KarmaCarHeader } from '../car-header/karma-car-header';
import { DeviceConfigurationPage } from '../../fleet/device-operations/device-configuration-page';
import { DeviceManagementView } from './device-management-view';
import { RuleDraftStore } from './rule-drafts';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

type KarmaCar = NonNullable<AdminKarmaCarQuery['karmaCar']>;

/** Karma owns the target; the active Branch scopes saved operations. */
@Component({
  selector: 'holita-device-management-page',
  imports: [
    KarmaCarHeader,
    ButtonDirective,
    Message,
    DeviceConfigurationPage,
    DeviceManagementView,
  ],
  providers: [KarmaApi, RuleDraftStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
  template: `
    <holita-karma-car-header
      [language]="language()"
      [carId]="carId()"
      [carNumber]="car()?.carNumber"
      [title]="text().deviceSettings"
      [busy]="loading()"
      [error]="error()"
      (refreshRequest)="refreshTruck()"
    />
    @if (loading()) {
      <p role="status">{{ text().loadingTruck }}</p>
    }
    @if (error()) {
      <p-message severity="error">{{ text().targetChanged }}</p-message>
    }
    @if (loaded() && !car()) {
      <p-message severity="warn">{{ text().targetChanged }}</p-message>
    }
    @if (car(); as currentCar) {
      @if (!workspace.fleetEnabled) {
        <p-message severity="info">{{ text().fleetUnavailable }}</p-message>
      } @else {
        @if (workspace.branches.loading()) {
          <p role="status">{{ text().loadingBranch }}</p>
        } @else if (workspace.branches.error()) {
          <p-message severity="error">{{ text().branchError }}</p-message>
          <button pButton type="button" severity="secondary" (click)="workspace.branches.refresh()">
            {{ text().retry }}
          </button>
        } @else if (!branches().length) {
          <p-message severity="info">{{ text().chooseBranch }}</p-message>
        }
        @for (branch of branches(); track branch.id + ':' + targetScopeKey()) {
          <holita-device-configuration-page
            [branch]="branch"
            [language]="language()"
            [car]="currentCar"
            (targetRefresh)="refreshTruck()"
          />
        }
      }
      @if (!workspace.fleetEnabled || !branches().length) {
        <holita-device-management-view [language]="language()" [car]="currentCar" />
      }
    }
  `,
})
export class DeviceManagementPage implements OnInit {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  protected readonly workspace = inject(AdminWorkspace);
  private readonly api = inject(KarmaApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly configuration = viewChild(DeviceConfigurationPage);
  private readonly localView = viewChild(DeviceManagementView);
  private readonly drafts = inject(RuleDraftStore);
  private readonly session = inject(DemoSession);
  private readonly reload = new Subject<void>();
  readonly car = signal<KarmaCar | null>(null);
  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly error = signal(false);
  protected readonly targetScopeKey = computed(
    () => `${this.car()?.id ?? ''}:${this.car()?.deviceId ?? ''}`,
  );
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly branches = computed(() =>
    (this.workspace.branches.branches() ?? []).filter(
      (branch) => branch.id === this.workspace.branches.selectedId(),
    ),
  );

  ngOnInit(): void {
    if (!/^[1-9]\d*$/.test(this.carId()) || !Number.isSafeInteger(Number(this.carId()))) {
      this.loading.set(false);
      this.loaded.set(true);
      return;
    }
    this.drafts.initialize(this.session.capture().tenantId, this.carId());
    this.api.initialize(this.language());
    this.reload
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading.set(true);
          this.error.set(false);
          return this.api.watchCar(this.carId()).valueChanges.pipe(
            catchError(() => {
              this.error.set(true);
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        this.loading.set(result.loading);
        this.error.set(!!result.error);
        if (!result.error && result.dataState === 'complete') {
          this.car.set(result.data.karmaCar);
          this.loaded.set(true);
        }
      });
  }

  canLeave(): boolean | Promise<boolean> {
    return this.configuration()?.canLeave() ?? this.localView()?.canLeave() ?? true;
  }

  async refreshTruck(): Promise<void> {
    if (await this.canLeave()) {
      this.car.set(null);
      this.reload.next();
    }
  }
}
