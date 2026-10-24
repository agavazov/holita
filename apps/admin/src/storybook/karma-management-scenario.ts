import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { routes } from '../app/app.routes';
import { AdminWorkspace } from '../app/workspace/admin-workspace';
import { injectPageRecord } from '../app/layout/page-record';
import type { Language } from '../app/i18n/messages';
import type { FleetDeviceOperationStatus } from '../generated/graphql/operations';
import { CarDetails } from '../app/features/karma-client/cars/car-details/car-details';
import { KARMA_CAR_EXTRA_TABS } from '../app/features/karma-client/car-header/karma-car-header';
import {
  DeviceManagementView,
  type ParameterSetting,
  type RuleDraft,
  type DeviceOperationPreview,
} from '../app/features/karma-client/device-management/device-management-view';
import en from '../app/features/karma-client/device-management/i18n/en.json';
import bg from '../app/features/karma-client/device-management/i18n/bg.json';
import { fixtureKarmaCars } from './karma-fixtures';

/** Real shell and truck pages; only settings use local drafts and canned device outcomes. */
@Component({
  selector: 'holita-karma-management-scenario',
  imports: [RouterOutlet],
  providers: [
    {
      provide: KARMA_CAR_EXTRA_TABS,
      useValue: [
        { path: 'configuration', label: { bg: bg.deviceSettings, en: en.deviceSettings } },
      ],
    },
  ],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KarmaManagementScenario {
  readonly language = input<Language>('en');
  readonly device = input(false);
  readonly hasScope = input(true);
  readonly empty = input(false);
  readonly loadState = input<'ready' | 'loading' | 'error'>('ready');
  readonly initialOperation = input<FleetDeviceOperationStatus | null>(null);
  readonly outcome = input<FleetDeviceOperationStatus>('QUEUED');
  readonly previewLanguage = signal<Language>('en');
  readonly text = computed(() => (this.previewLanguage() === 'bg' ? bg : en));
  readonly carId = signal<string | null>(null);
  readonly car = computed(() => fixtureKarmaCars.find((row) => row.id === this.carId()) ?? null);
  readonly scopeOverride = signal<string | null | undefined>(undefined);
  readonly ready = signal(false);
  readonly state = computed(() => (this.ready() ? 'ready' : this.loadState()));
  readonly notice = signal<string | null>(null);
  private readonly router = inject(Router);

  constructor() {
    // Overrides are confined to this story; the application's route table is unchanged.
    this.router.resetConfig(
      routes.map((route) =>
        route.path !== ':language'
          ? route
          : {
              ...route,
              children: [
                {
                  path: 'karma-client/cars/:recordId/configuration',
                  component: KarmaManagementPage,
                  data: { feature: 'karma-client', requiresBranch: false, previewSettings: true },
                },
                {
                  path: 'karma-client/cars/:recordId',
                  component: KarmaManagementPage,
                  data: { feature: 'karma-client', requiresBranch: false },
                },
                ...(route.children ?? []),
              ],
            },
      ),
    );
    effect(() => {
      void this.router.navigate([
        '/',
        this.language(),
        'karma-client',
        'cars',
        ...(this.device() ? ['41', 'configuration'] : []),
      ]);
    });
  }
  readonly catalog = computed<ParameterSetting[]>(() => [
    {
      id: 718,
      name:
        this.previewLanguage() === 'bg' ? 'Предупреждение ABS/EBS' : 'ABS/EBS Amber Warning Signal',
      interval: 30,
    },
    {
      id: 748,
      name: this.previewLanguage() === 'bg' ? 'AC изход 1 Amper' : 'AC output 1 Amper',
      interval: 60,
    },
    {
      id: 747,
      name: this.previewLanguage() === 'bg' ? 'AC изход 2 Amper' : 'AC output 2 Amper',
      interval: 60,
    },
  ]);
  private readonly parameterDrafts = signal<Record<string, ParameterSetting[]>>({});
  private readonly ruleDrafts = signal<Record<string, RuleDraft[]>>({});
  private readonly requests = signal<Record<string, DeviceOperationPreview[]>>({});
  readonly parameters = computed(() => {
    const rows =
      this.parameterDrafts()[this.car()?.id ?? ''] ??
      (this.empty() ? [] : this.catalog().slice(0, 2));
    return rows.map((row) => ({
      ...row,
      name: this.catalog().find((item) => item.id === row.id)?.name ?? row.name,
    }));
  });
  readonly rules = computed<RuleDraft[]>(
    () =>
      this.ruleDrafts()[this.car()?.id ?? ''] ??
      (this.empty()
        ? []
        : [
            {
              id: 'example-rule',
              name: this.previewLanguage() === 'bg' ? 'Примерно сравнение' : 'Example comparison',
              expression: '[718] > 10',
              trueEvent: 0,
              falseEvent: 0,
              debounce: 1,
              sourceHex: '07021502CE0F0A',
            },
          ]),
  );
  readonly operations = computed<DeviceOperationPreview[]>(
    () =>
      this.requests()[this.car()?.id ?? ''] ??
      (this.initialOperation()
        ? [{ id: 'example-operation', status: this.initialOperation() ?? 'QUEUED' }]
        : []),
  );

  saveParameter(row: ParameterSetting): void {
    const key = this.car()?.id;
    if (!key) {
      return;
    }
    const rows = this.parameters().filter((item) => item.id !== row.id);
    this.parameterDrafts.update((value) => ({ ...value, [key]: [...rows, row] }));
    this.notice.set(this.text().saved);
  }
  saveRule(row: RuleDraft): void {
    const key = this.car()?.id;
    if (!key) {
      return;
    }
    const rows = this.rules().filter((item) => item.id !== row.id);
    this.ruleDrafts.update((value) => ({ ...value, [key]: [...rows, row] }));
    this.notice.set(this.text().saved);
  }
  removeRule(id: string): void {
    const key = this.car()?.id;
    if (!key) {
      return;
    }
    const rows = this.rules().filter((item) => item.id !== id);
    this.ruleDrafts.update((value) => ({ ...value, [key]: rows }));
  }
  send(): void {
    const key = this.car()?.id;
    if (!key) {
      return;
    }
    this.requests.update((value) => ({
      ...value,
      [key]: [{ id: crypto.randomUUID(), status: this.outcome() }],
    }));
    this.notice.set(this.text().queued);
  }
}

/** Adds the proposed entry point to the existing truck detail, inside AdminWorkspace. */
@Component({
  selector: 'holita-karma-management-page',
  imports: [CarDetails, DeviceManagementView],
  template: `
    @if (settings) {
      @if (scenario.car(); as car) {
        <holita-device-management-view
          [language]="workspace.language()"
          [car]="car"
          [catalog]="scenario.catalog()"
          [parameters]="scenario.parameters()"
          [rules]="scenario.rules()"
          [state]="scenario.state()"
          [branch]="branch()?.name ?? null"
          [branchId]="branch()?.id ?? null"
          [branchOptions]="branchOptions()"
          (branchChange)="scenario.scopeOverride.set($event)"
          [notice]="scenario.notice()"
          [operations]="scenario.operations()"
          (retry)="scenario.ready.set(true)"
          (parameterChange)="scenario.saveParameter($event)"
          (ruleChange)="scenario.saveRule($event)"
          (ruleRemoval)="scenario.removeRule($event)"
          (sendRequest)="scenario.send()"
        />
        <p class="app-muted">{{ scenario.text().preview }}</p>
      }
    } @else {
      <holita-car-details [language]="workspace.language()" [carId]="recordId()" />
    }
  `,
  styles: ':host { display: flex; flex-direction: column; gap: var(--p-app-stack-gap); }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class KarmaManagementPage {
  protected readonly scenario = inject(KarmaManagementScenario);
  protected readonly workspace = inject(AdminWorkspace);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly recordId = computed(() => this.params().get('recordId') ?? '');
  protected readonly settings = this.route.snapshot.data['previewSettings'] === true;
  protected readonly branchOptions = computed(() =>
    (this.workspace.branches.branches() ?? []).map((branch) => ({
      label: branch.name,
      value: branch.id,
    })),
  );
  protected readonly branch = computed(() => {
    const id =
      this.scenario.scopeOverride() === undefined
        ? this.scenario.hasScope()
          ? this.workspace.branches.selectedId()
          : null
        : this.scenario.scopeOverride();
    return this.workspace.branches.branches()?.find((branch) => branch.id === id);
  });

  constructor() {
    effect(() => {
      this.scenario.carId.set(this.recordId());
      this.scenario.previewLanguage.set(this.workspace.language());
      this.scenario.notice.set(null);
    });
    injectPageRecord(() => this.scenario.car()?.carNumber ?? null);
  }
}
