import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Message } from 'primeng/message';
import { Bolt } from '@primeicons/angular/bolt';
import { ChartLine } from '@primeicons/angular/chart-line';
import { Database } from '@primeicons/angular/database';
import { Directions } from '@primeicons/angular/directions';
import { MapMarker } from '@primeicons/angular/map-marker';
import type {
  AdminKarmaReferencesQuery,
  AdminKarmaLocationQuery,
  AdminKarmaCarQuery,
} from '../../../../generated/graphql/operations';
import { messages, type Language } from '../../../i18n/messages';
import { locationMap } from '../location-map';
import { KarmaApi } from '../karma-api';

@Component({
  imports: [RouterLink, ButtonDirective, Message, Bolt, ChartLine, Database, Directions, MapMarker],
  providers: [KarmaApi],
  selector: 'holita-car-details',
  styleUrl: './car-details.css',
  templateUrl: './car-details.html',
})
export class CarDetails {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly text = computed(() => messages[this.language()]);
  readonly car = signal<AdminKarmaCarQuery['karmaCar']>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly loaded = signal(false);
  readonly validId = computed(
    () => /^[1-9]\d*$/.test(this.carId()) && Number.isSafeInteger(Number(this.carId())),
  );
  readonly location = signal<AdminKarmaLocationQuery['karmaLocation']>(null);
  readonly locationError = signal(false);
  readonly locationLoaded = signal(false);
  readonly map = computed(() => locationMap(this.location()?.latitude, this.location()?.longitude));
  private locationRead: ReturnType<KarmaApi['watchLocation']> | undefined;
  readonly references = signal<AdminKarmaReferencesQuery | null>(null);
  readonly referencesError = signal(false);
  private referenceRead: ReturnType<KarmaApi['watchReferences']> | undefined;
  projectName(id: string): string {
    return this.references()?.karmaProjects.find((project) => project.id === id)?.name || '—';
  }
  timeZoneName(id: number | null | undefined): string {
    return this.references()?.karmaTimeZones.find((zone) => zone.id === id)?.name || '—';
  }
  private readonly api = inject(KarmaApi);
  private query: ReturnType<KarmaApi['watchCar']> | undefined;

  constructor() {
    effect((onCleanup) => {
      if (!this.validId()) return;
      this.api.initialize(this.language());
      const references = this.api.watchReferences();
      this.referenceRead = references;
      const referenceSubscription = references.valueChanges.subscribe({
        next: (result) => {
          this.referencesError.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) this.references.set(result.data);
        },
        error: () => {
          this.referencesError.set(true);
        },
      });
      onCleanup(() => {
        referenceSubscription.unsubscribe();
        this.referenceRead = undefined;
      });
      this.loading.set(true);
      const query = this.api.watchCar(this.carId());
      this.query = query;
      const subscription = query.valueChanges.subscribe({
        next: (result) => {
          this.loading.set(result.loading);
          this.error.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) {
            this.car.set(result.data.karmaCar);
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
        this.query = undefined;
      });
    });
    effect((onCleanup) => {
      const car = this.car();
      if (!car) return;
      const read = this.api.watchLocation(car.id);
      this.locationRead = read;
      const subscription = read.valueChanges.subscribe({
        next: (result) => {
          this.locationError.set(!!result.error);
          if (result.dataState === 'complete' && !result.error) {
            this.location.set(result.data.karmaLocation);
            this.locationLoaded.set(true);
          }
        },
        error: () => {
          this.locationError.set(true);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
        this.locationRead = undefined;
      });
    });
  }

  refresh(): void {
    if (this.loading()) return;
    this.error.set(false);
    const references = this.referenceRead;
    void references?.refetch().catch(() => {
      if (this.referenceRead === references) this.referencesError.set(true);
    });
    const location = this.locationRead;
    void location?.refetch().catch(() => {
      if (this.locationRead === location) this.locationError.set(true);
    });
    const query = this.query;
    void query?.refetch().catch(() => {
      if (this.query === query) {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
