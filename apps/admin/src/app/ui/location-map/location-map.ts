import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
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
import * as L from 'leaflet';
import { ButtonDirective } from 'primeng/button';
import { AdminConfig } from '../../core/config/admin-config';
import type { Language } from '../../i18n/messages';
import { formatNumber, formatRelative, type FleetDateFormat } from '../format/format';
import { FLEET_DISPLAY, injectFleetFormat } from '../format/fleet-format';
import { interpolate } from '../i18n/messages';
import { locationMap, mapCoordinates } from '../map-preview/location-map';
import {
  recordedTrackSegments,
  type LocationMapRecord,
  type LocationMapTrack,
} from './location-map-model';
import bg from './bg.json';
import en from './en.json';

export type { LocationMapRecord, LocationMapTrack, LocationTrackPoint } from './location-map-model';
const messages: Record<Language, typeof en> = { bg, en };

interface MapMarker {
  readonly marker: L.Marker;
  signature: string;
}

@Component({
  selector: 'holita-location-map',
  imports: [ButtonDirective],
  templateUrl: './location-map.html',
  styleUrl: './location-map.scss',
  // Leaflet creates its own DOM; its layout rules are scoped beneath this selector.
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
      statuses.set(`${record.status.tone}:${record.status.label}`, record.status);
    }
    return [...statuses.values()];
  });
  protected readonly tileFailed = signal(false);
  private readonly ready = signal(false);
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('mapCanvas');
  private readonly config = inject(AdminConfig);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly markers = new Map<string, MapMarker>();
  private map?: L.Map;
  private tiles?: L.TileLayer;
  private trackLines?: L.LayerGroup;
  private fitted = false;

  constructor() {
    afterNextRender(() => {
      const element = this.canvas().nativeElement;
      const map = L.map(element, {
        zoomControl: false,
        scrollWheelZoom: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView([0, 0], 2);
      this.map = map;
      map.attributionControl.setPrefix(false);
      this.tiles = L.tileLayer(this.config.mapTileUrl, {
        attribution: this.config.mapAttribution,
        maxZoom: 19,
      })
        .on('tileerror', () => {
          this.tileFailed.set(true);
        })
        .addTo(map);
      this.trackLines = L.layerGroup().addTo(map);
      const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      resize.observe(element);
      this.destroyRef.onDestroy(() => {
        resize.disconnect();
        map.remove();
      });
      this.ready.set(true);
    });
    afterRenderEffect(() => {
      if (this.ready()) {
        const records = this.records();
        this.language();
        this.asOf();
        this.timeZone();
        this.dateFormat();
        this.refreshMarkers(records);
        this.refreshTrack(this.track());
        if (!this.fitted && this.positioned().length) {
          this.fitFleet();
          this.fitted = true;
        }
        this.showSelection(this.selectedId());
      }
    });
  }

  protected date(value: string | null): string {
    return this.format.dateTime(value, true);
  }

  protected age(record: LocationMapRecord): string {
    return formatRelative(record.positionAt, this.asOf(), this.language());
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
    this.showSelection(record.id);
    this.recordSelect.emit(record);
  }

  protected fitFleet(): void {
    const points = this.positioned().flatMap((record): L.LatLngTuple[] =>
      record.position ? [[record.position.latitude, record.position.longitude]] : [],
    );
    const track = this.track();
    if (track) {
      for (const segment of recordedTrackSegments(track.points)) {
        points.push(...segment.map((point): L.LatLngTuple => [point.latitude, point.longitude]));
      }
    }
    if (points.length) {
      this.map?.fitBounds(L.latLngBounds(points), {
        padding: [32, 32],
        maxZoom: 15,
        animate: false,
      });
    }
  }

  protected zoom(delta: number): void {
    if (this.map) {
      this.map.setZoom(this.map.getZoom() + delta, { animate: false });
    }
  }

  protected retryTiles(): void {
    this.tileFailed.set(false);
    this.tiles?.redraw();
  }

  private refreshMarkers(records: readonly LocationMapRecord[]): void {
    const map = this.map;
    if (!map) {
      return;
    }
    const positioned = new Set<string>();
    records.forEach((record, index) => {
      const point = mapCoordinates(record.position?.latitude, record.position?.longitude);
      if (!point) {
        return;
      }
      positioned.add(record.id);
      const signature = JSON.stringify([
        index,
        record.status,
        record.heading,
        record.label,
        record.plate,
        this.language(),
      ]);
      let entry = this.markers.get(record.id);
      if (!entry) {
        const marker = L.marker([point.latitude, point.longitude], {
          icon: this.icon(record, index),
          title: `${record.plate ?? record.label}: ${record.status.label}`,
          keyboard: true,
        }).bindPopup(this.popup(record), { autoPan: false, closeButton: false });
        const select = () => {
          const current = untracked(this.records).find((item) => item.id === record.id);
          if (current) {
            this.select(current);
          }
        };
        marker.on('click', select);
        marker.on('keypress', (event: L.LeafletKeyboardEvent) => {
          if (event.originalEvent.key === 'Enter') {
            select();
          }
        });
        marker.on('keydown', (event: L.LeafletKeyboardEvent) => {
          if (event.originalEvent.key === ' ') {
            event.originalEvent.preventDefault();
            select();
          }
        });
        marker.addTo(map);
        entry = { marker, signature };
        this.markers.set(record.id, entry);
      } else {
        entry.marker.setLatLng([point.latitude, point.longitude]);
        if (entry.signature !== signature) {
          entry.marker.setIcon(this.icon(record, index));
          entry.marker
            .getElement()
            ?.setAttribute('title', `${record.plate ?? record.label}: ${record.status.label}`);
          entry.signature = signature;
        }
        entry.marker.setPopupContent(this.popup(record));
      }
    });
    for (const [id, entry] of this.markers) {
      if (!positioned.has(id)) {
        entry.marker.remove();
        this.markers.delete(id);
      }
    }
  }

  private icon(record: LocationMapRecord, index: number): L.DivIcon {
    const content = this.document.createElement('span');
    content.className = 'location-map__pin';
    content.style.background = `var(--p-app-tone-${record.status.tone}-background)`;
    content.style.color = `var(--p-app-tone-${record.status.tone}-color)`;
    content.style.borderColor = `var(--p-app-tone-${record.status.tone}-solid)`;
    content.textContent = String(index + 1);
    if (
      record.heading !== null &&
      record.heading !== undefined &&
      Number.isFinite(record.heading)
    ) {
      const arrow = this.document.createElement('span');
      arrow.className = 'location-map__heading';
      arrow.textContent = '↑';
      arrow.style.transform = `rotate(${String(record.heading)}deg)`;
      arrow.setAttribute('aria-hidden', 'true');
      content.append(arrow);
    }
    return L.divIcon({
      className: 'location-map__marker',
      html: content,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20],
    });
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
    for (const text of [record.status.label, `${this.text().positionAge}: ${this.age(record)}`]) {
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
    if (record.href) {
      const open = this.document.createElement('a');
      open.href = record.href;
      open.textContent = this.text().open;
      popup.append(open);
    }
    return popup;
  }

  private showSelection(id: string | null): void {
    for (const [markerId, { marker }] of this.markers) {
      marker.getElement()?.classList.toggle('location-map__marker--selected', markerId === id);
      marker.getElement()?.setAttribute('aria-pressed', String(markerId === id));
      if (markerId === id && !marker.isPopupOpen()) {
        marker.openPopup();
      } else if (markerId !== id && marker.isPopupOpen()) {
        marker.closePopup();
      }
    }
  }

  private refreshTrack(track: LocationMapTrack | null): void {
    const lines = this.trackLines;
    lines?.clearLayers();
    if (track && lines) {
      for (const segment of recordedTrackSegments(track.points)) {
        L.polyline(
          segment.map((point): L.LatLngTuple => [point.latitude, point.longitude]),
          {
            color: 'var(--p-app-category-c1)',
            weight: 3,
          },
        ).addTo(lines);
      }
    }
  }
}
