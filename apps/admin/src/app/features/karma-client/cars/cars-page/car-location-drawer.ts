import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import type {
  AdminKarmaCarsQuery,
  AdminKarmaLocationQuery,
} from '../../../../../generated/graphql/operations';
import { messages, type Language } from '../../../../i18n/messages';
import { RouteDrawer, type RouteDrawerState } from '../../../../ui/drawer/route-drawer';
import { MapPreview } from '../../../../ui/map-preview/map-preview';
import { mapCoordinates, type GoogleMapView } from '../../../../ui/map-preview/location-map';
import { KarmaApi } from '../../karma-api';
import bg from './i18n/bg.json';
import en from './i18n/en.json';

@Component({
  selector: 'holita-karma-car-location-drawer',
  imports: [ButtonDirective, MapPreview, Message, RouteDrawer],
  providers: [KarmaApi],
  templateUrl: './car-location-drawer.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarLocationDrawer implements OnInit {
  readonly car = input.required<AdminKarmaCarsQuery['karmaCars'][number]>();
  readonly language = input.required<Language>();
  readonly initialView = input<GoogleMapView>('place');
  readonly closeRequest = output();
  private readonly api = inject(KarmaApi);
  private readonly destroyRef = inject(DestroyRef);
  private read: ReturnType<KarmaApi['watchLocation']> | undefined;
  protected readonly text = computed(() => messages[this.language()]);
  protected readonly listText = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly location = signal<AdminKarmaLocationQuery['karmaLocation']>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  private readonly loaded = signal(false);
  protected readonly state = computed<RouteDrawerState>(() =>
    this.loaded() ? 'ready' : this.error() ? 'error' : 'loading',
  );
  protected readonly coordinates = computed(() =>
    mapCoordinates(this.location()?.latitude, this.location()?.longitude),
  );
  protected readonly title = computed(
    () => this.car().carNumber || `${this.text().karmaCarId} ${this.car().id}`,
  );
  protected readonly identity = computed(
    () =>
      `${this.title()} · ${this.text().karmaCarId} ${this.car().id} · ${this.text().karmaMessageId} ${this.location()?.messageId ?? '—'}`,
  );

  ngOnInit(): void {
    this.api.initialize(this.language());
    const read = this.api.watchLocation(this.car().id);
    this.read = read;
    read.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.loading.set(result.loading);
        this.error.set(!!result.error);
        if (result.dataState === 'complete' && !result.error) {
          this.location.set(result.data.karmaLocation);
          this.loaded.set(true);
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected refresh(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(false);
    this.loading.set(true);
    void this.read?.refetch().catch(() => {
      this.loading.set(false);
      this.error.set(true);
    });
  }
}
