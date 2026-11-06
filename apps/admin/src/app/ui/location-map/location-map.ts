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
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { injectChartPalette } from '../chart-panel/chart-palette';
import { injectFleetNow } from '../fleet-live/fleet-clock';
import { fleetObservationIsRecent, fleetRecordedValue } from '../fleet-live/fleet-live';
import { AdminConfig } from '../../core/config/admin-config';
import type { Language } from '../../i18n/messages';
import { formatNumber, type FleetDateFormat } from '../format/format';
import { FLEET_DISPLAY, injectFleetFormat } from '../format/fleet-format';
import { interpolate } from '../i18n/messages';
import { locationMap, mapCoordinates } from '../map-preview/location-map';
import {
  recordedTrackSegments,
  type LocationMapRecord,
  type LocationMapTrack,
} from './location-map-model';
import { googleMapsAuthenticationFailed, loadGoogleMaps } from './google-maps';
import bg from './bg.json';
import en from './en.json';

export type { LocationMapRecord, LocationMapTrack, LocationTrackPoint } from './location-map-model';
const messages: Record<Language, typeof en> = { bg, en };

interface MapMarker {
  readonly marker: google.maps.marker.AdvancedMarkerElement;
  signature: string;
}

@Component({
  selector: 'holita-location-map',
  imports: [ButtonDirective],
  templateUrl: './location-map.html',
  styleUrl: './location-map.scss',
  // Google Maps creates its own DOM; custom marker/popup rules stay beneath this selector.
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationMap {
  readonly language = input.required<Language>();
  readonly title = input<string>();
  readonly records = input<readonly LocationMapRecord[]>([]);
  readonly track = input<LocationMapTrack | null>(null);
  readonly asOf = input<string | null>(null);
  readonly updatedAt = input<string | null>(null);
  readonly timeZone = input('UTC');
  readonly dateFormat = input<FleetDateFormat>('YYYY_MM_DD');
  readonly recordSelect = output<LocationMapRecord>();
  private readonly preferences = inject(FLEET_DISPLAY);
  private readonly palette = injectChartPalette(inject<ElementRef<HTMLElement>>(ElementRef));
  private readonly now = injectFleetNow();
  protected readonly format = injectFleetFormat(
    computed(() => ({
      ...this.preferences(),
      timeZone: this.timeZone(),
      dateFormat: this.dateFormat(),
    })),
    this.language,
  );
  protected readonly text = computed(() => messages[this.language()]);
  protected readonly selectedId = linkedSignal<readonly LocationMapRecord[], string | null>({
    source: this.records,
    computation: (records, previous) =>
      records.some((record) => record.id === previous?.value) ? (previous?.value ?? null) : null,
  });
  protected readonly positioned = computed(() =>
    this.records().filter((record) =>
      mapCoordinates(record.position?.latitude, record.position?.longitude),
    ),
  );
  protected readonly legend = computed(() => {
    const statuses = new Map<string, LocationMapRecord['status']>();
    for (const record of this.records()) {
      const status = this.status(record);
      statuses.set(`${status.tone}:${status.label}`, status);
    }
    return [...statuses.values()];
  });
  protected readonly mapFailed = signal(false);
  protected readonly failed = computed(() => this.mapFailed() || googleMapsAuthenticationFailed());
  protected readonly ready = signal(false);
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('mapCanvas');
  private readonly config = inject(AdminConfig);
  protected readonly missingKey = !this.config.googleMapsApiKey;
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly markers = new Map<string, MapMarker>();
  private map?: google.maps.Map;
  private infoWindow?: google.maps.InfoWindow;
  private markerLibrary?: google.maps.MarkerLibrary;
  private readonly trackLines: google.maps.Polyline[] = [];
  private fitted = false;
  private tileDeadline?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => {
      if (!this.missingKey) {
        void this.initializeMap();
      }
    });
    afterRenderEffect(() => {
      if (this.ready()) {
        const records = this.records();
        this.language();
        this.asOf();
        this.timeZone();
        this.dateFormat();
        this.now();
        this.refreshMarkers(records);
        this.refreshTrack(this.track());
        if (!this.fitted && (this.positioned().length || this.trackLines.length)) {
          this.fitFleet();
          this.fitted = true;
        }
        this.showSelection(this.selectedId());
      }
    });
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.tileDeadline);
      this.infoWindow?.close();
      for (const { marker } of this.markers.values()) {
        marker.map = null;
      }
      for (const line of this.trackLines) {
        line.setMap(null);
      }
      if (this.map) {
        google.maps.event.clearInstanceListeners(this.map);
      }
    });
  }

  private async initializeMap(): Promise<void> {
    const key = this.config.googleMapsApiKey;
    if (!key) {
      return;
    }
    try {
      const [maps, markers] = await loadGoogleMaps(key);
      if (this.destroyRef.destroyed) {
        return;
      }
      this.markerLibrary = markers;
      this.map = new maps.Map(this.canvas().nativeElement, {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapId: this.config.googleMapsMapId,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        gestureHandling: 'cooperative',
        clickableIcons: false,
      });
      this.infoWindow = new maps.InfoWindow({ disableAutoPan: true });
      this.infoWindow.addListener('closeclick', () => {
        this.selectedId.set(null);
      });
      this.map.addListener('bounds_changed', () => {
        this.waitForTiles();
      });
      this.map.addListener('tilesloaded', () => {
        clearTimeout(this.tileDeadline);
        this.mapFailed.set(false);
      });
      this.waitForTiles();
      this.ready.set(true);
    } catch {
      this.mapFailed.set(true);
    }
  }

  /** Google exposes tilesloaded, but no tile-error event (including vector tiles). */
  private waitForTiles(): void {
    clearTimeout(this.tileDeadline);
    this.tileDeadline = setTimeout(() => {
      this.mapFailed.set(true);
    }, 20_000);
  }

  protected date(value: string | null): string {
    return this.format.dateTime(value, true);
  }

  protected recordedPosition(record: LocationMapRecord): string {
    return record.position
      ? fleetRecordedValue(this.text().position, record.positionAt, this.now(), this.language())
      : this.text().noPosition;
  }

  protected status(record: LocationMapRecord): LocationMapRecord['status'] {
    return record.position && !this.positionIsRecent(record)
      ? { label: `${record.status.label} · ${this.text().historicalPosition}`, tone: 'warn' }
      : record.status;
  }

  protected heading(record: LocationMapRecord): number | null {
    const moving =
      record.moving ??
      (record.speedKph !== null && record.speedKph !== undefined && record.speedKph > 0);
    return this.positionIsRecent(record) && moving && Number.isFinite(record.heading)
      ? (record.heading ?? null)
      : null;
  }

  private positionIsRecent(record: LocationMapRecord): boolean {
    return fleetObservationIsRecent(
      record.positionAt,
      this.now(),
      this.preferences().notReportingHours,
    );
  }

  private markerTitle(record: LocationMapRecord): string {
    return `${record.plate ?? record.label}: ${this.status(record).label} · ${this.recordedPosition(record)}`;
  }

  protected position(record: LocationMapRecord): string {
    const point = mapCoordinates(record.position?.latitude, record.position?.longitude);
    return point
      ? `${formatNumber(point.latitude, this.language(), { fraction: 5 })}, ${formatNumber(point.longitude, this.language(), { fraction: 5 })}`
      : this.text().noPosition;
  }

  protected googleUrl(record: LocationMapRecord): string | null {
    return locationMap(record.position?.latitude, record.position?.longitude);
  }

  protected selectLabel(record: LocationMapRecord): string {
    return interpolate(this.text().select, { record: record.plate ?? record.label });
  }

  protected select(record: LocationMapRecord): void {
    this.selectedId.set(record.id);
    const marker = this.markers.get(record.id)?.marker;
    if (marker?.position && this.map) {
      this.map.panTo(marker.position);
      this.map.setZoom(16);
    }
    this.showSelection(record.id);
    this.recordSelect.emit(record);
  }

  protected fitFleet(): void {
    const map = this.map;
    if (!map) {
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const record of this.positioned()) {
      if (record.position) {
        bounds.extend({ lat: record.position.latitude, lng: record.position.longitude });
      }
    }
    const track = this.track();
    if (track) {
      for (const segment of recordedTrackSegments(track.points)) {
        for (const point of segment) {
          bounds.extend({ lat: point.latitude, lng: point.longitude });
        }
      }
    }
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 48);
      google.maps.event.addListenerOnce(map, 'idle', () => {
        if ((map.getZoom() ?? 0) > 15) {
          map.setZoom(15);
        }
      });
    }
  }

  protected zoom(delta: number): void {
    if (this.map) {
      this.map.setZoom((this.map.getZoom() ?? 2) + delta);
    }
  }

  protected retryMap(): void {
    this.document.defaultView?.location.reload();
  }

  private refreshMarkers(records: readonly LocationMapRecord[]): void {
    const map = this.map;
    const library = this.markerLibrary;
    if (!map || !library) {
      return;
    }
    const positioned = new Set<string>();
    for (const record of records) {
      const point = mapCoordinates(record.position?.latitude, record.position?.longitude);
      if (!point) {
        continue;
      }
      positioned.add(record.id);
      const signature = JSON.stringify([
        this.status(record),
        this.heading(record),
        this.recordedPosition(record),
        record.label,
        record.plate,
        this.language(),
      ]);
      let entry = this.markers.get(record.id);
      if (!entry) {
        const marker = new library.AdvancedMarkerElement({
          map,
          position: { lat: point.latitude, lng: point.longitude },
          title: this.markerTitle(record),
          gmpClickable: true,
        });
        marker.classList.add('location-map__marker');
        marker.append(this.icon(record));
        marker.addEventListener('gmp-click', () => {
          const current = untracked(this.records).find((item) => item.id === record.id);
          if (current) {
            this.select(current);
          }
        });
        entry = { marker, signature };
        this.markers.set(record.id, entry);
      } else {
        entry.marker.position = { lat: point.latitude, lng: point.longitude };
        if (entry.signature !== signature) {
          entry.marker.replaceChildren(this.icon(record));
          entry.marker.title = this.markerTitle(record);
          entry.signature = signature;
        }
      }
    }
    for (const [id, entry] of this.markers) {
      if (!positioned.has(id)) {
        entry.marker.map = null;
        this.markers.delete(id);
      }
    }
  }

  private icon(record: LocationMapRecord): HTMLElement {
    const content = this.document.createElement('span');
    content.className = 'location-map__pin';
    const status = this.status(record);
    content.style.setProperty('--pin-background', `var(--p-app-tone-${status.tone}-background)`);
    content.style.setProperty('--pin-color', `var(--p-app-tone-${status.tone}-color)`);
    content.style.setProperty('--pin-border', `var(--p-app-tone-${status.tone}-solid)`);
    const svg = this.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 44 56');
    svg.setAttribute('aria-hidden', 'true');
    const pin = this.document.createElementNS(svg.namespaceURI, 'path');
    pin.setAttribute('class', 'location-map__pin-shape');
    pin.setAttribute('d', 'M22 2C11 2 2 11 2 22c0 14 20 31 20 31s20-17 20-31C42 11 33 2 22 2Z');
    svg.append(pin);
    const truck = this.document.createElementNS(svg.namespaceURI, 'path');
    truck.setAttribute('class', 'location-map__truck');
    truck.setAttribute(
      'd',
      'M9 14h16v13H9ZM25 19h5l5 6v2H25M13 27a3 3 0 1 0 6 0a3 3 0 1 0-6 0M27 27a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    );
    svg.append(truck);
    content.append(svg);
    const heading = this.heading(record);
    if (heading !== null) {
      const arrow = this.document.createElement('span');
      arrow.className = 'location-map__heading';
      arrow.textContent = '↑';
      arrow.style.transform = `rotate(${String(heading)}deg)`;
      arrow.setAttribute('aria-hidden', 'true');
      content.append(arrow);
    }
    return content;
  }

  private popup(record: LocationMapRecord): HTMLElement {
    const popup = this.document.createElement('div');
    popup.className = 'location-map__popup';
    const identity = this.document.createElement('strong');
    identity.className = record.plate ? 'app-plate' : '';
    identity.textContent = record.plate ?? record.label;
    if (record.countryCode) {
      identity.dataset['country'] = record.countryCode;
    }
    popup.append(identity);
    for (const text of [this.status(record).label, this.recordedPosition(record)]) {
      const line = this.document.createElement('p');
      line.textContent = text;
      popup.append(line);
    }
    const time = this.document.createElement('time');
    time.textContent = this.date(record.positionAt);
    if (record.positionAt) {
      time.dateTime = record.positionAt;
      time.title = this.format.utc(record.positionAt);
    }
    popup.append(time);
    const href = record.href ?? this.googleUrl(record);
    if (href) {
      const open = this.document.createElement('a');
      open.href = href;
      open.textContent = record.href ? this.text().open : this.text().google;
      if (!record.href) {
        open.target = '_blank';
        open.rel = 'noopener noreferrer';
      }
      popup.append(open);
    }
    return popup;
  }

  private showSelection(id: string | null): void {
    for (const [markerId, { marker }] of this.markers) {
      marker.classList.toggle('location-map__marker--selected', markerId === id);
      marker.setAttribute('aria-pressed', String(markerId === id));
      marker.zIndex = markerId === id ? 1000 : 0;
    }
    const marker = id ? this.markers.get(id)?.marker : undefined;
    const record = id ? this.records().find((item) => item.id === id) : undefined;
    if (marker && record && this.infoWindow && this.map) {
      this.infoWindow.setContent(this.popup(record));
      this.infoWindow.setOptions({ ariaLabel: this.markerTitle(record) });
      this.infoWindow.open({ map: this.map, anchor: marker, shouldFocus: false });
    } else {
      this.infoWindow?.close();
    }
  }

  private refreshTrack(track: LocationMapTrack | null): void {
    for (const line of this.trackLines) {
      line.setMap(null);
    }
    this.trackLines.length = 0;
    if (track && this.map) {
      const color = this.palette.palette()?.categories[0];
      if (!color) {
        return;
      }
      for (const segment of recordedTrackSegments(track.points)) {
        this.trackLines.push(
          new google.maps.Polyline({
            map: this.map,
            path: segment.map((point) => ({ lat: point.latitude, lng: point.longitude })),
            strokeColor: color,
            strokeWeight: 3,
            clickable: false,
          }),
        );
      }
    }
  }
}
