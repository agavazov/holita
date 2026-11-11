/// <reference types="google.maps" />
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { AdminConfig } from '../../../core/config/admin-config';
import type { Language } from '../../../i18n/messages';
import { injectChartPalette } from '../../../ui/chart-panel/chart-palette';
import {
  googleMapsAuthenticationFailed,
  loadGoogleMaps,
} from '../../../ui/location-map/google-maps';
import { geoZonesText } from './geo-zones-text';

export interface GeoZoneShape {
  readonly id: string;
  readonly name: string;
  readonly points: readonly { readonly latitude: number; readonly longitude: number }[];
}

/** The Branch zones as named polygons; `focusId` fits the map to one zone. */
@Component({
  selector: 'discocan-geo-zone-map',
  imports: [ButtonDirective],
  template: `
    <div #canvas class="geo-zone-map__canvas" [attr.aria-label]="text().map"></div>
    @if (failed()) {
      <p class="geo-zone-map__status" role="status">{{ text().mapFailed }}</p>
    } @else if (missingKey) {
      <p class="geo-zone-map__status" role="status">{{ text().mapMissing }}</p>
    }
    <div class="geo-zone-map__tools">
      <button pButton type="button" size="small" severity="secondary" (click)="fit(null)">
        {{ text().showAll }}
      </button>
    </div>
  `,
  styleUrl: './geo-zone-map.scss',
  // Google Maps owns the label DOM; the label rules stay beneath this selector.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeoZoneMap {
  readonly language = input.required<Language>();
  readonly zones = input<readonly GeoZoneShape[]>([]);
  readonly focusId = input<string | null>(null);

  protected readonly text = computed(() => geoZonesText(this.language()));
  private readonly config = inject(AdminConfig);
  protected readonly missingKey = !this.config.googleMapsApiKey;
  private readonly mapFailed = signal(false);
  protected readonly failed = computed(() => this.mapFailed() || googleMapsAuthenticationFailed());
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly palette = injectChartPalette(this.host);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  private readonly ready = signal(false);
  private readonly shapes: google.maps.Polygon[] = [];
  private readonly labels: google.maps.marker.AdvancedMarkerElement[] = [];
  private map?: google.maps.Map;
  private library?: google.maps.MarkerLibrary;

  constructor() {
    afterNextRender(() => {
      if (!this.missingKey) {
        void this.initialize();
      }
    });
    afterRenderEffect(() => {
      const palette = this.palette.palette();
      if (this.ready() && palette) {
        this.draw(this.zones(), palette.categories);
        this.fit(this.focusId());
      }
    });
    this.destroyRef.onDestroy(() => {
      this.clear();
    });
  }

  private async initialize(): Promise<void> {
    const key = this.config.googleMapsApiKey;
    if (!key) {
      return;
    }
    try {
      const [maps, markers] = await loadGoogleMaps(key);
      if (this.destroyRef.destroyed) {
        return;
      }
      this.library = markers;
      this.map = new maps.Map(this.canvas().nativeElement, {
        center: { lat: 42.7, lng: 25.3 },
        zoom: 7,
        mapId: this.config.googleMapsMapId,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
        gestureHandling: 'greedy',
        clickableIcons: false,
      });
      this.ready.set(true);
    } catch {
      this.mapFailed.set(true);
    }
  }

  protected fit(zoneId: string | null): void {
    const bounds = new google.maps.LatLngBounds();
    for (const zone of this.zones()) {
      if (zoneId === null || zone.id === zoneId) {
        for (const point of zone.points) {
          bounds.extend({ lat: point.latitude, lng: point.longitude });
        }
      }
    }
    if (this.map && !bounds.isEmpty()) {
      this.map.fitBounds(bounds, 48);
    }
  }

  private draw(zones: readonly GeoZoneShape[], colors: readonly string[]): void {
    const map = this.map;
    const library = this.library;
    if (!map || !library) {
      return;
    }
    this.clear();
    zones.forEach((zone, index) => {
      const color = colors[index % Math.max(colors.length, 1)] ?? '';
      const path = zone.points.map((point) => ({ lat: point.latitude, lng: point.longitude }));
      this.shapes.push(
        new google.maps.Polygon({
          map,
          paths: path,
          strokeColor: color,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.12,
          clickable: false,
        }),
      );
      const bounds = new google.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      const label = this.document.createElement('span');
      label.className = 'geo-zone-map__label';
      label.textContent = zone.name;
      this.labels.push(
        new library.AdvancedMarkerElement({
          map,
          position: bounds.getCenter(),
          content: label,
          title: zone.name,
        }),
      );
    });
  }

  private clear(): void {
    this.shapes.splice(0).forEach((shape) => {
      shape.setMap(null);
    });
    this.labels.splice(0).forEach((label) => {
      label.map = null;
    });
  }
}
