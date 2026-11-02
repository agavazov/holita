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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule, type TablePageEvent } from 'primeng/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  AdminKarmaReferencesQuery,
  AdminKarmaCarsQuery,
} from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { KarmaApi } from '../../karma-api';
import { referenceListQuery } from '../../reference-list-query';
import { positiveId } from '../../edata/edata-page/edata-filters';
import { karmaCarListContext } from '../../car-header/karma-car-context';
import { PageHeader } from '../../../../ui/page-header/page-header';
import { FormField } from '../../../../ui/form-field/form-field';
import { TablePanel } from '../../../../ui/table-panel/table-panel';
import { tableView } from '../../../../ui/table-panel/table-view';
import {
  listRecord,
  trackById,
  type ListAction,
  type ListActionRequest,
} from '../../../../ui/list/list-actions';
import { RowActions } from '../../../../ui/row-actions/row-actions';
import { mapPreviewMessages } from '../../../../ui/map-preview/map-preview';
import type { GoogleMapView } from '../../../../ui/map-preview/location-map';
import { CarLocationDrawer } from './car-location-drawer';
import en from './i18n/en.json';
import bg from './i18n/bg.json';

type Car = AdminKarmaCarsQuery['karmaCars'][number];
type MapAction = 'location' | 'streetview';

@Component({
  selector: 'holita-karma-cars-page',
  imports: [
    ButtonDirective,
    InputText,
    Message,
    Select,
    TableModule,
    RouterLink,
    ReactiveFormsModule,
    PageHeader,
    FormField,
    TablePanel,
    RowActions,
    CarLocationDrawer,
  ],
  providers: [KarmaApi],
  templateUrl: './cars-page.html',
  styleUrl: './cars-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarsPage {
  readonly language = input.required<Language>();
  readonly text = computed(() => messages[this.language()]);
  readonly listText = computed(() => (this.language() === 'bg' ? bg : en));
  private readonly mapText = computed(() => mapPreviewMessages[this.language()]);
  readonly trackById = trackById;
  readonly actions = computed<readonly ListAction<MapAction, Car>[]>(() => [
    { id: 'location', label: this.text().karmaLocation },
    { id: 'streetview', label: this.mapText().streetView },
  ]);
  readonly cars = signal<AdminKarmaCarsQuery['karmaCars']>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly loaded = signal(false);
  readonly references = signal<AdminKarmaReferencesQuery | null>(null);
  readonly referencesError = signal(false);
  readonly form = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    project: new FormControl<string | null>(null),
  });
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly query = computed(() => {
    const query = referenceListQuery(this.params());
    const project = this.params().get('project') ?? '';
    return {
      ...query,
      search: Array.from(query.search).slice(0, 200).join(''),
      project: positiveId(project) ? project : '',
    };
  });
  readonly carContext = computed(() => karmaCarListContext(this.params()));
  readonly selectedCars = computed(() => {
    const car = this.cars().find((row) => row.id === this.params().get('mapCar'));
    return car ? [car] : [];
  });
  readonly mapView = computed<GoogleMapView>(() =>
    this.params().get('mapView') === 'streetview' ? 'streetview' : 'place',
  );
  readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error() ? true : null,
      rows: this.loaded() ? this.filtered().length : null,
      filtered: !!(this.query().search || this.query().project),
    }),
  );
  readonly filtered = computed(() => {
    const query = this.query();
    const search = query.search.toLocaleLowerCase(this.language());
    return this.cars().filter(
      (car) =>
        (!query.project || car.projectId === query.project) &&
        [car.carNumber, car.id, car.deviceId].some((value) =>
          value.toLocaleLowerCase(this.language()).includes(search),
        ),
    );
  });
  readonly first = computed(() =>
    this.loaded()
      ? Math.min(
          this.query().first,
          Math.max(0, Math.ceil(this.filtered().length / this.query().rows) - 1) *
            this.query().rows,
        )
      : this.query().first,
  );
  readonly projectOptions = computed(() =>
    [
      ...new Set([
        ...this.cars().map((car) => car.projectId),
        ...(this.query().project ? [this.query().project] : []),
      ]),
    ]
      .map((value) => {
        const name = this.references()?.karmaProjects.find((project) => project.id === value)?.name;
        return { value, label: name || `${this.listText().project} ${value}` };
      })
      .sort((left, right) => left.label.localeCompare(right.label, this.language())),
  );
  private referenceRead: ReturnType<KarmaApi['watchReferences']> | undefined;
  projectName(id: string): string {
    return this.references()?.karmaProjects.find((project) => project.id === id)?.name || '—';
  }
  private readonly api = inject(KarmaApi);
  private read: ReturnType<KarmaApi['watch']> | undefined;

  record(car: Car) {
    return listRecord(
      this.actions(),
      car,
      car.id,
      car.carNumber || `${this.text().karmaCarId} ${car.id}`,
    );
  }

  openMap(request: ListActionRequest<MapAction>): void {
    const id = request.ids[0];
    if (!id) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mapCar: id, mapView: request.action === 'streetview' ? 'streetview' : null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  closeMap(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mapCar: null, mapView: null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }

  constructor() {
    effect(() => {
      this.form.reset({ search: this.query().search, project: this.query().project || null });
    });
    effect((onCleanup) => {
      this.api.initialize(this.language());
      const references = this.api.watchReferences();
      this.referenceRead = references;
      const referenceSubscription = references.valueChanges.subscribe({
        next: (result) => {
          this.referencesError.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) {
            this.references.set(result.data);
          }
        },
        error: () => {
          this.referencesError.set(true);
        },
      });
      onCleanup(() => {
        referenceSubscription.unsubscribe();
        this.referenceRead = undefined;
      });
      const query = this.api.watch();
      this.read = query;
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) {
            this.cars.set(result.data.karmaCars);
            this.loaded.set(true);
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
        this.read = undefined;
      });
    });
  }

  applySearch(): void {
    const values = this.form.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: values.search.trim() || null,
        project: values.project || null,
        size: this.query().rows,
      },
    });
  }

  clearSearch(): void {
    this.form.reset({ search: '', project: null });
    this.applySearch();
  }

  page(event: TablePageEvent): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.query().search || null,
        project: this.query().project || null,
        size: event.rows,
        first: event.first || null,
      },
    });
  }

  refresh(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(false);
    const references = this.referenceRead;
    void references?.refetch().catch(() => {
      if (this.referenceRead === references) {
        this.referencesError.set(true);
      }
    });
    const query = this.read;
    void query?.refetch().catch(() => {
      if (this.read === query) {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
