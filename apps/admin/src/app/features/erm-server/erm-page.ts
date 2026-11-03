import { JsonPipe } from '@angular/common';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, type Observable } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import type {
  AdminErmUnitsQuery,
  AdminErmEventsQuery,
  AdminErmFramesQuery,
  AdminErmCommandsQuery,
  ErmFrameDirection,
  ErmFrameChecksum,
  ErmCommandState,
} from '../../../generated/graphql/operations';
import { requestError } from '../../core/graphql/request-error';
import type { Language } from '../../i18n/messages';
import { formatDateTime, formatNumber, emptyValue } from '../../ui/format/format';
import { PageHeader } from '../../ui/page-header/page-header';
import { TablePanel } from '../../ui/table-panel/table-panel';
import { tableView } from '../../ui/table-panel/table-view';
import { toneSeverity } from '../../ui/tones';
import { ErmApi } from './erm-api';
import en from './en.json';
import bg from './bg.json';

type Unit = AdminErmUnitsQuery['ermUnits']['items'][number];
type Event = AdminErmEventsQuery['ermEvents']['items'][number];
type Frame = AdminErmFramesQuery['ermFrames']['items'][number];
type Command = AdminErmCommandsQuery['ermCommands']['items'][number];
type HistoryTab = 'events' | 'frames' | 'commands';
interface ErmReadState {
  readonly loading: boolean;
  readonly error: unknown;
  readonly data:
    | { readonly units: AdminErmUnitsQuery['ermUnits'] }
    | { readonly events: AdminErmEventsQuery['ermEvents'] }
    | { readonly frames: AdminErmFramesQuery['ermFrames'] }
    | { readonly commands: AdminErmCommandsQuery['ermCommands'] }
    | null;
}

@Component({
  selector: 'holita-erm-page',
  imports: [
    JsonPipe,
    RouterLink,
    ButtonDirective,
    TableModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tag,
    PageHeader,
    TablePanel,
  ],
  providers: [ErmApi],
  templateUrl: './erm-page.html',
  styleUrl: './erm-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErmPage {
  readonly language = input.required<Language>();
  readonly unitId = input<string | null>(null);
  readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  readonly units = signal<AdminErmUnitsQuery['ermUnits'] | null>(null);
  readonly events = signal<AdminErmEventsQuery['ermEvents'] | null>(null);
  readonly frames = signal<AdminErmFramesQuery['ermFrames'] | null>(null);
  readonly commands = signal<AdminErmCommandsQuery['ermCommands'] | null>(null);
  readonly loading = signal(true);
  readonly error = signal<unknown>(null);
  readonly failure = computed(() => requestError(this.error(), this.text().unavailable));
  private readonly api = inject(ErmApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly reload = signal(0);
  private readKey = '';
  readonly tab = computed<HistoryTab>(() => {
    const value = this.params().get('view');
    return value === 'frames' || value === 'commands' ? value : 'events';
  });
  readonly cursor = computed(() => this.params().get('cursor'));
  readonly page = computed(() =>
    !this.unitId()
      ? this.units()
      : this.tab() === 'events'
        ? this.events()
        : this.tab() === 'frames'
          ? this.frames()
          : this.commands(),
  );
  readonly view = computed(() =>
    tableView({
      loading: this.loading(),
      error: this.error(),
      rows: this.page()?.items.length ?? null,
      filtered: false,
    }),
  );
  readonly toneSeverity = toneSeverity;
  readonly trackUnit = (_index: number, unit: Unit) => unit.unitId;
  readonly trackId = (_index: number, row: Event | Frame | Command) => row.id;

  constructor() {
    effect((onCleanup) => {
      this.reload();
      const language = this.language();
      const unitId = this.unitId();
      const cursor = this.cursor();
      const tab = this.tab();
      const key = JSON.stringify({ unitId, cursor, tab });
      if (this.readKey !== key) {
        this.units.set(null);
        this.events.set(null);
        this.frames.set(null);
        this.commands.set(null);
        this.readKey = key;
      }
      this.loading.set(true);
      this.error.set(null);
      const input = { pageSize: 50, cursor };
      const read: Observable<ErmReadState> =
        unitId === null
          ? this.api.watchUnits(input, language).valueChanges.pipe(
              map((result) => ({
                loading: result.loading,
                error: result.error,
                data:
                  result.dataState === 'complete' && !result.error
                    ? { units: result.data.ermUnits }
                    : null,
              })),
            )
          : tab === 'events'
            ? this.api.watchEvents({ ...input, unitId }, language).valueChanges.pipe(
                map((result) => ({
                  loading: result.loading,
                  error: result.error,
                  data:
                    result.dataState === 'complete' && !result.error
                      ? { events: result.data.ermEvents }
                      : null,
                })),
              )
            : tab === 'frames'
              ? this.api.watchFrames({ ...input, unitId }, language).valueChanges.pipe(
                  map((result) => ({
                    loading: result.loading,
                    error: result.error,
                    data:
                      result.dataState === 'complete' && !result.error
                        ? { frames: result.data.ermFrames }
                        : null,
                  })),
                )
              : this.api.watchCommands({ ...input, unitId }, language).valueChanges.pipe(
                  map((result) => ({
                    loading: result.loading,
                    error: result.error,
                    data:
                      result.dataState === 'complete' && !result.error
                        ? { commands: result.data.ermCommands }
                        : null,
                  })),
                );
      const subscription = read.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(result.error ?? null);
          if (result.data) {
            if ('units' in result.data) {
              this.units.set(result.data.units);
            }
            if ('events' in result.data) {
              this.events.set(result.data.events);
            }
            if ('frames' in result.data) {
              this.frames.set(result.data.frames);
            }
            if ('commands' in result.data) {
              this.commands.set(result.data.commands);
            }
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

  date(value: string | null | undefined): string {
    return formatDateTime(value, this.language(), 'UTC', true);
  }
  number(value: number | null | undefined, fraction = 2): string {
    return formatNumber(value, this.language(), { fraction });
  }
  engine(value: boolean | null): string {
    return value === null ? emptyValue : value ? this.text().on : this.text().off;
  }
  mode(unit: Unit): string {
    return unit.mode === 'MIRROR'
      ? this.text().mirror
      : unit.mode === 'PRIMARY'
        ? this.text().primary
        : emptyValue;
  }
  mapLink(
    event: { latitude?: number | null; longitude?: number | null } | null | undefined,
  ): string | null {
    return event?.latitude != null && event.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${String(event.latitude)},${String(event.longitude)}`
      : null;
  }
  direction(value: ErmFrameDirection): string {
    return this.text()[
      value === 'DEVICE' ? 'device' : value === 'UPSTREAM' ? 'upstream' : 'holita'
    ];
  }
  checksum(value: ErmFrameChecksum): string {
    return this.text()[value === 'OK' ? 'ok' : value === 'MISMATCH' ? 'mismatch' : 'absent'];
  }
  commandStatus(value: ErmCommandState): string {
    return this.text()[
      value === 'SENT'
        ? 'sent'
        : value === 'ANSWERED'
          ? 'answered'
          : value === 'TIMEOUT'
            ? 'timeout'
            : 'failed'
    ];
  }
  commandTone(value: ErmCommandState) {
    return toneSeverity(value === 'ANSWERED' ? 'success' : value === 'SENT' ? 'info' : 'warn');
  }
  refresh(): void {
    this.reload.update((value) => value + 1);
  }
  selectTab(value: string | number | undefined): void {
    if (value !== 'events' && value !== 'frames' && value !== 'commands') {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: value === 'events' ? null : value, cursor: null },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }
  navigate(cursor: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cursor },
      queryParamsHandling: 'merge',
      preserveFragment: true,
    });
  }
}
