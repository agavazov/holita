import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { Message } from 'primeng/message';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { catchError, EMPTY, Subject, switchMap } from 'rxjs';
import type {
  AdminGeoZoneEventsQuery,
  AdminGeoZonesQuery,
  FleetGeoZoneEventKind,
} from '../../../../generated/graphql/operations';
import { requestError } from '../../../core/graphql/request-error';
import type { Language } from '../../../i18n/messages';
import { injectFleetFormat } from '../../../ui/format/fleet-format';
import { interpolate } from '../../../ui/i18n/messages';
import { trackById } from '../../../ui/list/list-actions';
import { PageHeader } from '../../../ui/page-header/page-header';
import { TablePanel, type TableColumn } from '../../../ui/table-panel/table-panel';
import { tableView } from '../../../ui/table-panel/table-view';
import { GeoZoneMap } from './geo-zone-map';
import { GeoZonesApi } from './geo-zones-api';
import { geoZonesText } from './geo-zones-text';

interface LogFilter {
  readonly vehicleId: string | null;
  readonly zoneId: string | null;
  readonly kind: FleetGeoZoneEventKind | null;
  readonly range: readonly (Date | null)[] | null;
}

const emptyFilter: LogFilter = { vehicleId: null, zoneId: null, kind: null, range: null };

/** Zones on a map with their list, and the entry/exit log with its filters. */
@Component({
  selector: 'discocan-geo-zones-page',
  imports: [
    FormsModule,
    DatePicker,
    Message,
    Select,
    TableModule,
    Tag,
    PageHeader,
    TablePanel,
    GeoZoneMap,
  ],
  providers: [GeoZonesApi],
  templateUrl: './geo-zones-page.html',
  styleUrl: './geo-zones-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-view' },
})
export class GeoZonesPage implements OnInit {
  readonly branchId = input.required<string>();
  readonly language = input.required<Language>();

  private readonly api = inject(GeoZonesApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly format = injectFleetFormat();
  protected readonly text = computed(() => geoZonesText(this.language()));
  protected readonly trackById = trackById;

  protected readonly zones = signal<AdminGeoZonesQuery['fleetGeoZones']>([]);
  protected readonly vehicles = signal<AdminGeoZonesQuery['fleetVehicles']['items']>([]);
  protected readonly zonesError = signal<unknown>(null);
  protected readonly focusId = signal<string | null>(null);

  protected readonly filter = signal<LogFilter>(emptyFilter);
  protected readonly pageState = signal({ page: 1, pageSize: 20 });
  protected readonly events = signal<AdminGeoZoneEventsQuery['fleetGeoZoneEvents'] | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<unknown>(null);
  private readonly reload = new Subject<void>();

  protected readonly zoneOptions = computed(() => [
    { label: this.text().allZones, value: null },
    ...this.zones().map((zone) => ({ label: zone.name, value: zone.id })),
  ]);
  protected readonly vehicleOptions = computed(() => [
    { label: this.text().allVehicles, value: null },
    ...this.vehicles().map((vehicle) => ({ label: vehicle.licensePlate, value: vehicle.id })),
  ]);
  protected readonly kindOptions = computed(() => [
    { label: this.text().allKinds, value: null },
    { label: this.text().kinds.ENTER, value: 'ENTER' },
    { label: this.text().kinds.EXIT, value: 'EXIT' },
  ]);
  protected readonly columns = computed<readonly TableColumn[]>(() => [
    { id: 'occurredAt', label: this.text().table.occurred, width: '22%', kind: 'date' },
    { id: 'vehicle', label: this.text().vehicle, width: '18%', kind: 'identity' },
    { id: 'zone', label: this.text().zone, width: '28%' },
    { id: 'kind', label: this.text().kind, width: '12%', kind: 'status' },
    { id: 'position', label: this.text().table.position, width: '20%' },
  ]);
  protected readonly view = computed(() => {
    const { vehicleId, zoneId, kind, range } = this.filter();
    return tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.events()?.items.length ?? null,
      filtered: !!(vehicleId ?? zoneId ?? kind ?? range?.[0]),
    });
  });
  protected readonly page = computed(() => ({
    ...this.pageState(),
    total: this.events()?.total ?? 0,
  }));
  protected readonly errorText = computed(() =>
    requestError(this.error(), this.text().table.errorText),
  );
  protected readonly zonesErrorText = computed(() =>
    this.zonesError() ? requestError(this.zonesError(), this.text().loadError) : null,
  );

  ngOnInit(): void {
    this.api.initialize(this.branchId(), this.language());
    this.api
      .zones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.zones.set(data.fleetGeoZones);
          this.vehicles.set(data.fleetVehicles.items);
        },
        error: (error: unknown) => {
          this.zonesError.set(error);
        },
      });
    this.reload
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          return this.api.events(this.variables()).pipe(
            catchError((error: unknown) => {
              this.error.set(error);
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((events) => {
        this.events.set(events);
        this.error.set(null);
        this.loading.set(false);
      });
    this.reload.next();
  }

  protected zonePoints(count: number): string {
    return interpolate(this.text().points, { count: Math.max(count - 1, 0) });
  }

  protected showZoneLabel(name: string): string {
    return interpolate(this.text().showZone, { name });
  }

  protected changeFilter(patch: Partial<LogFilter>): void {
    this.filter.update((filter) => ({ ...filter, ...patch }));
    this.pageState.update((state) => ({ ...state, page: 1 }));
    this.reload.next();
  }

  protected clearFilters(): void {
    this.filter.set(emptyFilter);
    this.pageState.update((state) => ({ ...state, page: 1 }));
    this.reload.next();
  }

  protected changePage(state: { page: number; pageSize: number }): void {
    this.pageState.set(state);
    this.reload.next();
  }

  protected retry(): void {
    this.reload.next();
  }

  private variables() {
    const { vehicleId, zoneId, kind, range } = this.filter();
    const { page, pageSize } = this.pageState();
    const from = range?.[0] ?? null;
    const to = range?.[1] ?? from;
    return {
      offset: (page - 1) * pageSize,
      limit: pageSize,
      filter: {
        vehicleIds: vehicleId ? [vehicleId] : null,
        zoneIds: zoneId ? [zoneId] : null,
        kinds: kind ? [kind] : null,
        occurredFrom: from ? dayStart(from).toISOString() : null,
        occurredTo: to ? dayEnd(to).toISOString() : null,
      },
    };
  }
}

function dayStart(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

function dayEnd(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
}
