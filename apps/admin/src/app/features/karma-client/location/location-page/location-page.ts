import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Message } from 'primeng/message';
import type {
  AdminKarmaCarQuery,
  AdminKarmaLocationQuery,
} from '../../../../../generated/graphql/operations';
import { KarmaApi } from '../../karma-api';
import { mapCoordinates } from '../location-map';
import { karmaMapMessages, MapPreview } from '../map-preview/map-preview';
import { messages, type Language } from '../../../../i18n/messages';
import { KarmaCarHeader } from '../../car-header/karma-car-header';

@Component({
  selector: 'holita-location-page',
  imports: [KarmaCarHeader, Message, MapPreview],
  providers: [KarmaApi],
  templateUrl: './location-page.html',
  styleUrl: './location-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationPage {
  readonly language = input.required<Language>();
  readonly carId = input.required<string>();
  readonly text = computed(() => messages[this.language()]);
  readonly mapText = computed(() => karmaMapMessages[this.language()]);
  readonly car = signal<AdminKarmaCarQuery['karmaCar']>(null);
  readonly location = signal<AdminKarmaLocationQuery['karmaLocation']>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly carLoaded = signal(false);
  readonly loaded = signal(false);
  readonly validId = computed(
    () => /^[1-9]\d*$/.test(this.carId()) && Number.isSafeInteger(Number(this.carId())),
  );
  readonly coordinates = computed(() =>
    mapCoordinates(this.location()?.latitude, this.location()?.longitude),
  );
  private readonly api = inject(KarmaApi);
  private carRead: ReturnType<KarmaApi['watchCar']> | undefined;
  private read: ReturnType<KarmaApi['watchLocation']> | undefined;
  constructor() {
    effect((onCleanup) => {
      if (!this.validId()) {
        return;
      }
      this.api.initialize(this.language());
      this.loading.set(true);
      const read = this.api.watchCar(this.carId());
      this.carRead = read;
      const subscription = read.valueChanges.subscribe({
        next: (result) => {
          if (result.error) {
            this.error.set(true);
            this.loading.set(false);
          }
          if (result.dataState === 'complete' && !result.error && !result.loading) {
            this.car.set(result.data.karmaCar);
            this.carLoaded.set(true);
            if (!result.data.karmaCar) {
              this.loading.set(false);
            }
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
      onCleanup(() => {
        subscription.unsubscribe();
        this.carRead = undefined;
      });
    });
    effect((onCleanup) => {
      const car = this.car();
      if (!car) {
        return;
      }
      this.loading.set(true);
      const read = this.api.watchLocation(car.id);
      this.read = read;
      const subscription = read.valueChanges.subscribe({
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
      onCleanup(() => {
        subscription.unsubscribe();
        this.read = undefined;
      });
    });
  }
  refresh(): void {
    if (this.loading()) {
      return;
    }
    this.error.set(false);
    this.loading.set(true);
    const read = this.read ?? this.carRead;
    void read?.refetch().catch(() => {
      if (this.read === read || this.carRead === read) {
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }
}
