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
  output,
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

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface GeoZoneShape {
  readonly id: string;
  readonly name: string;
  readonly points: readonly GeoPoint[];
}

/**
 * The Branch zones as named polygons; `focusId` fits the map to one zone. While `draft` is set,
 * a click adds a vertex, a dragged vertex moves and a right-clicked vertex is removed; the zone
 * `editingId` is hidden behind its draft.
 */
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
  readonly draft = input<readonly GeoPoint[] | null>(null);
  readonly editingId = input<string | null>(null);
  readonly draftChange = output<GeoPoint[]>();

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
  private draftShape: google.maps.Polygon | undefined;
  private syncing = false;

  constructor() {
    afterNextRender(() => {
      if (!this.missingKey) {
        void this.initialize();
      }
    });
    afterRenderEffect(() => {
      const palette = this.palette.palette();
      if (this.ready() && palette) {
        const editingId = this.editingId();
        this.draw(
          this.zones().filter((zone) => zone.id !== editingId),
          palette.categories,
        );
        this.fit(this.focusId());
      }
    });
    afterRenderEffect(() => {
      const palette = this.palette.palette();
      if (this.ready() && palette) {
        // The draft uses the warning tone so it stands out from the saved zones.
        this.syncDraft(this.draft(), palette.tones[2] ?? palette.text);
      }
    });
    this.destroyRef.onDestroy(() => {
      this.clear();
      this.draftShape?.setMap(null);
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
      this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
        this.addVertex(event.latLng);
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

  private addVertex(at: google.maps.LatLng | null): void {
    const draft = this.draft();
    if (draft && at) {
      this.draftChange.emit([...draft, { latitude: at.lat(), longitude: at.lng() }]);
    }
  }

  private emitDraft(): void {
    if (!this.syncing && this.draftShape) {
      this.draftChange.emit(
        this.draftShape
          .getPath()
          .getArray()
          .map((point) => ({ latitude: point.lat(), longitude: point.lng() })),
      );
    }
  }

  private syncDraft(draft: readonly GeoPoint[] | null, color: string): void {
    const map = this.map;
    if (!map || !draft) {
      this.draftShape?.setMap(null);
      this.draftShape = undefined;
      return;
    }
    if (!this.draftShape) {
      const shape = new google.maps.Polygon({
        map,
        editable: true,
        strokeColor: color,
        strokeWeight: 3,
        fillColor: color,
        fillOpacity: 0.3,
      });
      shape.addListener('click', (event: google.maps.PolyMouseEvent) => {
        if (event.vertex === undefined && event.edge === undefined) {
          this.addVertex(event.latLng);
        }
      });
      shape.addListener('rightclick', (event: google.maps.PolyMouseEvent) => {
        if (event.vertex !== undefined) {
          shape.getPath().removeAt(event.vertex);
        }
      });
      this.draftShape = shape;
    }
    const path = this.draftShape.getPath();
    const same =
      path.getLength() === draft.length &&
      path.getArray().every((point, index) => {
        const vertex = draft[index];
        return (
          vertex !== undefined &&
          point.lat() === vertex.latitude &&
          point.lng() === vertex.longitude
        );
      });
    if (same) {
      return;
    }
    // Replacing the path drops its listeners, so they are attached to each new path.
    const next = new google.maps.MVCArray(
      draft.map((point) => new google.maps.LatLng(point.latitude, point.longitude)),
    );
    this.syncing = true;
    this.draftShape.setPath(next);
    this.syncing = false;
    for (const name of ['set_at', 'insert_at', 'remove_at']) {
      next.addListener(name, () => {
        this.emitDraft();
      });
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
