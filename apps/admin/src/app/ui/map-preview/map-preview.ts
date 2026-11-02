import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ButtonDirective } from 'primeng/button';
import { MapMarker } from '@primeicons/angular/map-marker';
import { Compass } from '@primeicons/angular/compass';
import { Directions } from '@primeicons/angular/directions';
import { ExternalLink } from '@primeicons/angular/external-link';
import { AdminConfig } from '../../core/config/admin-config';
import type { Language } from '../../i18n/messages';
import {
  googleMapDirections,
  googleMapEmbed,
  googleMapStreetView,
  locationMap,
  mapCoordinates,
  type MapCoordinates,
  type GoogleMapView,
} from './location-map';
import bg from './bg.json';
import en from './en.json';

export const mapPreviewMessages: Record<Language, typeof en> = { bg, en };

interface MapPoint {
  readonly endpoint: 'start' | 'stop';
  readonly label: string;
  readonly coordinates: MapCoordinates | null;
  readonly time: string | null;
}

@Component({
  imports: [ButtonDirective, MapMarker, Compass, Directions, ExternalLink],
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
  readonly initialView = input<GoogleMapView>('place');
  readonly identity = input.required<string>();
  readonly originTime = input<string | null>(null);
  readonly destinationTime = input<string | null>(null);
  protected readonly text = computed(() => mapPreviewMessages[this.language()]);
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
  private readonly context = computed(() => ({
    identity: this.identity(),
    origin: this.validOrigin(),
    destination: this.validDestination(),
    originTime: this.originTime(),
    destinationTime: this.destinationTime(),
    route: this.route(),
  }));
  protected readonly endpoint = linkedSignal<'start' | 'stop'>(() => {
    const context = this.context();
    return context.origin || !context.destination ? 'start' : 'stop';
  });
  protected readonly view = linkedSignal<GoogleMapView>(() => {
    this.context();
    return this.initialView();
  });
  protected readonly point = computed(() =>
    this.endpoint() === 'start' ? this.validOrigin() : this.validDestination(),
  );
  protected readonly points = computed<readonly MapPoint[]>(() => [
    {
      endpoint: 'start',
      label: this.route() ? this.text().start : this.text().locationTitle,
      coordinates: this.validOrigin(),
      time: this.originTime(),
    },
    ...(this.route()
      ? [
          {
            endpoint: 'stop' as const,
            label: this.text().stop,
            coordinates: this.validDestination(),
            time: this.destinationTime(),
          },
        ]
      : []),
  ]);
  protected readonly canRoute = computed(() => !!this.validOrigin() && !!this.validDestination());
  protected readonly viewLabel = computed(() => {
    switch (this.view()) {
      case 'streetview':
        return this.text().streetView;
      case 'directions':
        return this.text().suggestedRoute;
      case 'place':
        return this.text().map;
    }
  });
  protected readonly viewHint = computed(() => {
    switch (this.view()) {
      case 'streetview':
        return this.text().streetViewHint;
      case 'directions':
        return this.text().routeHint;
      case 'place':
        return this.text().pointHint;
    }
  });
  private readonly config = inject(AdminConfig);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly embedUrl = computed(() => {
    const point = this.view() === 'directions' ? this.validOrigin() : this.point();
    const key = this.config.googleMapsEmbedApiKey;
    return point && key && (this.view() !== 'directions' || this.canRoute())
      ? googleMapEmbed(
          key,
          this.language(),
          point,
          this.view() === 'directions' ? this.validDestination() : null,
          this.view(),
        )
      : null;
  });
  protected readonly source = computed(() => {
    this.context();
    const url = this.embedUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  protected readonly externalUrl = computed(() => {
    if (this.view() === 'directions') {
      const origin = this.validOrigin();
      const destination = this.validDestination();
      return origin && destination ? googleMapDirections(origin, destination) : null;
    }
    const point = this.point();
    return point
      ? this.view() === 'streetview'
        ? googleMapStreetView(point)
        : locationMap(point.latitude, point.longitude)
      : null;
  });
  protected selectEndpoint(endpoint: 'start' | 'stop'): void {
    this.endpoint.set(endpoint);
    this.view.set('place');
  }
}
