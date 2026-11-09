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
  model,
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
import type { MapCoordinates } from '../../../ui/map-preview/location-map';
import { isMoving, type LiveTruck, type SpeedBand, type TrailLine } from './live-dashboard-model';
import { liveDashboardText } from './live-dashboard-text';

interface TruckMarker {
  readonly marker: google.maps.marker.AdvancedMarkerElement;
  signature: string;
  /** Where the marker is drawn now, including mid-glide. */
  at: google.maps.LatLngLiteral;
  animation: number | undefined;
}

/** Markers glide only over a short hop; a longer jump is a new report after a gap. */
const glideMetres = 3_000;
const glideMs = 1_200;

@Component({
  selector: 'discocan-live-truck-map',
  imports: [ButtonDirective],
  template: `
    <div #canvas class="live-map__canvas" [attr.aria-label]="text().map"></div>
    @if (failed()) {
      <p class="live-map__status" role="status">{{ text().mapFailed }}</p>
    } @else if (missingKey) {
      <p class="live-map__status" role="status">{{ text().mapMissing }}</p>
    }
    <div class="live-map__tools">
      @if (selectedId()) {
        <button
          pButton
          type="button"
          size="small"
          [severity]="follow() ? 'primary' : 'secondary'"
          [attr.aria-pressed]="follow()"
          (click)="follow.set(!follow())"
        >
          {{ text().follow }}
        </button>
      }
      <button pButton type="button" size="small" severity="secondary" (click)="fitAll()">
        {{ text().showAll }}
      </button>
      <button
        pButton
        type="button"
        size="small"
        severity="secondary"
        [attr.aria-pressed]="satellite()"
        (click)="toggleSatellite()"
      >
        {{ satellite() ? text().roadmap : text().satellite }}
      </button>
    </div>
    @if (trail().length) {
      <ul class="live-map__legend" [attr.aria-label]="text().legend">
        <li class="live-map__band live-map__band--normal">{{ text().bandNormal }}</li>
        <li class="live-map__band live-map__band--over">{{ text().bandOver }}</li>
        <li class="live-map__band live-map__band--far">{{ text().bandFar }}</li>
        <li class="live-map__hint">{{ text().trailHint }}</li>
      </ul>
    }
  `,
  styleUrl: './live-truck-map.scss',
  // Google Maps owns the marker DOM; the pin rules stay beneath this selector.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveTruckMap {
  readonly language = input.required<Language>();
  readonly trucks = input<readonly LiveTruck[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly trail = input<readonly TrailLine[]>([]);
  /** The route report shown in Street View; null while Street View follows the truck. */
  readonly routePoint = input<MapCoordinates | null>(null);
  readonly follow = model(true);
  readonly truckSelect = output<string>();
  readonly trailSelect = output<MapCoordinates>();

  protected readonly text = computed(() => liveDashboardText(this.language()));
  protected readonly satellite = signal(false);
  protected readonly mapFailed = signal(false);
  protected readonly failed = computed(() => this.mapFailed() || googleMapsAuthenticationFailed());
  private readonly config = inject(AdminConfig);
  protected readonly missingKey = !this.config.googleMapsApiKey;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly palette = injectChartPalette(this.host);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  private readonly ready = signal(false);
  private readonly markers = new Map<string, TruckMarker>();
  private readonly lines: google.maps.Polyline[] = [];
  private routeMarker?: google.maps.marker.AdvancedMarkerElement;
  private map?: google.maps.Map;
  private library?: google.maps.MarkerLibrary;
  private fitted = false;
  private focused: string | null = null;

  constructor() {
    afterNextRender(() => {
      if (!this.missingKey) {
        void this.initialize();
      }
    });
    afterRenderEffect(() => {
      if (!this.ready()) {
        return;
      }
      const trucks = this.trucks();
      const selected = this.selectedId();
      this.language();
      this.refreshMarkers(trucks, selected);
      if (!this.fitted && trucks.some((truck) => truck.position)) {
        this.fitted = true;
        // A truck chosen in the link is focused below instead of the whole fleet.
        if (!selected) {
          this.fitAll();
        }
      }
      this.focus(trucks, selected, this.follow());
    });
    afterRenderEffect(() => {
      const palette = this.palette.palette();
      if (this.ready() && palette) {
        this.refreshTrail(this.trail(), palette.tones, palette.background);
      }
    });
    afterRenderEffect(() => {
      if (this.ready()) {
        this.refreshRoutePoint(this.routePoint());
      }
    });
    this.destroyRef.onDestroy(() => {
      for (const entry of this.markers.values()) {
        cancelAnimationFrame(entry.animation ?? 0);
        entry.marker.map = null;
      }
      this.clearTrail();
      if (this.routeMarker) {
        this.routeMarker.map = null;
      }
      if (this.map) {
        google.maps.event.clearInstanceListeners(this.map);
      }
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
      this.map.addListener('dragstart', () => {
        this.follow.set(false);
      });
      this.ready.set(true);
    } catch {
      this.mapFailed.set(true);
    }
  }

  protected fitAll(): void {
    const map = this.map;
    const bounds = new google.maps.LatLngBounds();
    for (const truck of this.trucks()) {
      if (truck.position) {
        bounds.extend({ lat: truck.position.latitude, lng: truck.position.longitude });
      }
    }
    if (map && !bounds.isEmpty()) {
      this.follow.set(false);
      map.fitBounds(bounds, 64);
      google.maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 14) {
          map.setZoom(14);
        }
      });
    }
  }

  protected toggleSatellite(): void {
    this.satellite.set(!this.satellite());
    this.map?.setMapTypeId(this.satellite() ? 'hybrid' : 'roadmap');
  }

  /** A new selection zooms to the truck; following keeps every newer position in view. */
  private focus(trucks: readonly LiveTruck[], selected: string | null, follow: boolean): void {
    const truck = trucks.find((item) => item.id === selected);
    const map = this.map;
    if (!map || !truck?.position) {
      // Focus once the selected truck's position has loaded.
      if (!selected) {
        this.focused = null;
      }
      return;
    }
    const target = { lat: truck.position.latitude, lng: truck.position.longitude };
    if (this.focused !== selected) {
      this.focused = selected;
      map.panTo(target);
      if ((map.getZoom() ?? 0) < 13) {
        map.setZoom(15);
      }
    } else if (follow) {
      map.panTo(target);
    }
  }

  private refreshMarkers(trucks: readonly LiveTruck[], selected: string | null): void {
    const map = this.map;
    const library = this.library;
    if (!map || !library) {
      return;
    }
    const shown = new Set<string>();
    for (const truck of trucks) {
      if (!truck.position) {
        continue;
      }
      shown.add(truck.id);
      const signature = JSON.stringify([
        truck.plate,
        truck.online,
        truck.activity,
        truck.heading,
        truck.problems,
        truck.severity,
        truck.id === selected,
        this.language(),
      ]);
      const target = { lat: truck.position.latitude, lng: truck.position.longitude };
      let entry = this.markers.get(truck.id);
      if (!entry) {
        const marker = new library.AdvancedMarkerElement({
          map,
          position: target,
          title: this.title(truck),
          gmpClickable: true,
        });
        marker.append(this.pin(truck, selected));
        marker.addEventListener('gmp-click', () => {
          this.truckSelect.emit(truck.id);
        });
        entry = { marker, signature, at: target, animation: undefined };
        this.markers.set(truck.id, entry);
      } else {
        this.glide(entry, target);
        if (entry.signature !== signature) {
          entry.marker.replaceChildren(this.pin(truck, selected));
          entry.marker.title = this.title(truck);
          entry.signature = signature;
        }
      }
      entry.marker.zIndex = truck.id === selected ? 1000 : truck.online ? 10 : 1;
    }
    for (const [id, entry] of this.markers) {
      if (!shown.has(id)) {
        cancelAnimationFrame(entry.animation ?? 0);
        entry.marker.map = null;
        this.markers.delete(id);
      }
    }
  }

  /** Moves a marker smoothly to its newer report, so a driving truck does not jump. */
  private glide(entry: TruckMarker, target: google.maps.LatLngLiteral): void {
    const from = entry.at;
    if (from.lat === target.lat && from.lng === target.lng) {
      return;
    }
    cancelAnimationFrame(entry.animation ?? 0);
    const view = this.document.defaultView;
    if (!view || distanceMetres(from, target) > glideMetres || reducedMotion(view)) {
      entry.at = target;
      entry.marker.position = target;
      return;
    }
    const started = view.performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / glideMs);
      const eased = 1 - (1 - progress) ** 3;
      entry.at = {
        lat: from.lat + (target.lat - from.lat) * eased,
        lng: from.lng + (target.lng - from.lng) * eased,
      };
      entry.marker.position = entry.at;
      entry.animation = progress < 1 ? view.requestAnimationFrame(step) : undefined;
    };
    entry.animation = view.requestAnimationFrame(step);
  }

  private title(truck: LiveTruck): string {
    const text = this.text();
    return [
      truck.plate,
      truck.online ? text.online : text.offline,
      text.activity[truck.activity],
      truck.problems ? text.problemCount.replace('{count}', String(truck.problems)) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  private pin(truck: LiveTruck, selected: string | null): HTMLElement {
    const pin = this.document.createElement('span');
    pin.className = 'truck-pin';
    pin.classList.toggle('truck-pin--offline', !truck.online);
    pin.classList.toggle('truck-pin--moving', isMoving(truck));
    pin.classList.toggle('truck-pin--selected', truck.id === selected);
    const badge = this.document.createElement('span');
    badge.className = 'truck-pin__badge';
    if (isMoving(truck) && truck.heading !== null) {
      const arrow = this.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrow.setAttribute('viewBox', '0 0 24 24');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.style.transform = `rotate(${String(truck.heading)}deg)`;
      const shape = this.document.createElementNS(arrow.namespaceURI, 'path');
      shape.setAttribute('d', 'M12 3l7 17-7-4-7 4z');
      arrow.append(shape);
      badge.append(arrow);
    } else {
      badge.textContent = truck.activity === 'PARKED' ? 'P' : '•';
    }
    const plate = this.document.createElement('span');
    plate.className = 'truck-pin__plate';
    plate.textContent = truck.plate;
    pin.append(badge, plate);
    if (truck.problems) {
      const alert = this.document.createElement('span');
      alert.className = `truck-pin__alert truck-pin__alert--${truck.severity === 'CRITICAL' ? 'danger' : 'warn'}`;
      alert.textContent = '!';
      alert.setAttribute('aria-hidden', 'true');
      pin.append(alert);
    }
    return pin;
  }

  private clearTrail(): void {
    for (const line of this.lines) {
      google.maps.event.clearInstanceListeners(line);
      line.setMap(null);
    }
    this.lines.length = 0;
  }

  /** The trail answers clicks: the nearest recorded report opens in Street View. */
  private refreshTrail(
    trail: readonly TrailLine[],
    tones: readonly string[],
    outline: string,
  ): void {
    this.clearTrail();
    const map = this.map;
    if (!map) {
      return;
    }
    // Tones follow statusToneNames: success, info, warn, danger.
    const colors: Record<SpeedBand, string | undefined> = {
      normal: tones[1],
      over: tones[2],
      far: tones[3],
    };
    for (const line of trail) {
      const path = line.path.map((point) => ({ lat: point.latitude, lng: point.longitude }));
      const shapes = [
        new google.maps.Polyline({
          map,
          path,
          strokeColor: outline,
          strokeOpacity: 0.9,
          strokeWeight: 9,
          clickable: true,
          zIndex: 1,
        }),
        new google.maps.Polyline({
          map,
          path,
          strokeColor: colors[line.band] ?? null,
          strokeWeight: line.band === 'normal' ? 4 : 5,
          clickable: true,
          zIndex: line.band === 'normal' ? 2 : 3,
        }),
      ];
      for (const shape of shapes) {
        shape.addListener('click', (event: google.maps.PolyMouseEvent) => {
          if (event.latLng) {
            this.trailSelect.emit({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
          }
        });
      }
      this.lines.push(...shapes);
    }
  }

  /** A small ring marks the route report that Street View shows. */
  private refreshRoutePoint(point: MapCoordinates | null): void {
    const map = this.map;
    const library = this.library;
    if (!map || !library) {
      return;
    }
    if (!point) {
      if (this.routeMarker) {
        this.routeMarker.map = null;
      }
      return;
    }
    const position = { lat: point.latitude, lng: point.longitude };
    if (!this.routeMarker) {
      const ring = this.document.createElement('span');
      ring.className = 'route-pin';
      ring.setAttribute('aria-hidden', 'true');
      this.routeMarker = new library.AdvancedMarkerElement({ position, zIndex: 900 });
      this.routeMarker.append(ring);
    }
    this.routeMarker.position = position;
    this.routeMarker.map = map;
  }
}

function distanceMetres(from: google.maps.LatLngLiteral, to: google.maps.LatLngLiteral): number {
  const radians = Math.PI / 180;
  const dLat = (to.lat - from.lat) * radians;
  const dLng = (to.lng - from.lng) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(a));
}

function reducedMotion(view: Window): boolean {
  return view.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
