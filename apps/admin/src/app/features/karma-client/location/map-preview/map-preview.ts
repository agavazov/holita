import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ButtonDirective } from 'primeng/button';
import { MapMarker } from '@primeicons/angular/map-marker';
import { AdminConfig } from '../../../../core/config/admin-config';
import type { Language } from '../../../../i18n/messages';
import {
  googleMapDirections,
  googleMapEmbed,
  locationMap,
  mapCoordinates,
  type MapCoordinates,
} from '../location-map';
import bg from './bg.json';
import en from './en.json';

export const karmaMapMessages: Record<Language, typeof en> = { bg, en };

@Component({
  imports: [ButtonDirective, MapMarker],
  selector: 'holita-map-preview',
  styleUrl: './map-preview.scss',
  templateUrl: './map-preview.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPreview {
  readonly language = input.required<Language>();
  readonly origin = input<MapCoordinates | null>(null);
  readonly destination = input<MapCoordinates | null>(null);
  readonly route = input(false);
  protected readonly text = computed(() => karmaMapMessages[this.language()]);
  protected readonly validOrigin = computed(() =>
    mapCoordinates(this.origin()?.latitude, this.origin()?.longitude),
  );
  protected readonly validDestination = computed(() =>
    this.route()
      ? mapCoordinates(this.destination()?.latitude, this.destination()?.longitude)
      : null,
  );
  protected readonly heading = computed(() =>
    this.route() ? this.text().routeTitle : this.text().locationTitle,
  );
  private readonly config = inject(AdminConfig);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly activated = signal<string | null>(null);
  protected readonly embedUrl = computed(() => {
    const point = this.validOrigin() ?? this.validDestination();
    const key = this.config.googleMapsEmbedApiKey;
    return point && key
      ? googleMapEmbed(
          key,
          this.language(),
          point,
          this.validOrigin() ? this.validDestination() : null,
        )
      : null;
  });
  protected readonly source = computed(() => {
    const url = this.embedUrl();
    // The resource URL is constructed here from a fixed Google host and validated coordinates.
    return url && this.activated() === url
      ? this.sanitizer.bypassSecurityTrustResourceUrl(url)
      : null;
  });
  protected readonly externalUrl = computed(() => {
    const origin = this.validOrigin();
    const destination = this.validDestination();
    if (origin && destination) {
      return googleMapDirections(origin, destination);
    }
    const point = origin ?? destination;
    return point ? locationMap(point.latitude, point.longitude) : null;
  });
  protected activate(): void {
    this.activated.set(this.embedUrl());
  }
}
