/// <reference types="google.maps" />
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Compress } from '@primeicons/angular/compress';
import { Expand } from '@primeicons/angular/expand';
import { ExternalLink } from '@primeicons/angular/external-link';
import { Times } from '@primeicons/angular/times';
import { WindowMaximize } from '@primeicons/angular/window-maximize';
import { WindowMinimize } from '@primeicons/angular/window-minimize';
import { AdminConfig } from '../../core/config/admin-config';
import type { Language } from '../../i18n/messages';
import { formatNumber } from '../format/format';
import { googleMapsAuthenticationFailed, loadGoogleStreetView } from '../location-map/google-maps';
import { locationMap } from '../map-preview/location-map';
import bg from './bg.json';
import en from './en.json';

const messages: Record<Language, typeof en> = { bg, en };
type Position = { readonly latitude: number; readonly longitude: number };

/** A followed truck moves the panorama only after a real move, so small jitter never reloads. */
const moveMetres = 15;
/** The nearest panorama within this distance of a truck or route position. */
const searchMetres = 300;

function coordinate(value: number, language: Language): string {
  return formatNumber(value, language, { fraction: 5 });
}

function bearing(from: google.maps.LatLng, to: Position): number {
  const radians = Math.PI / 180;
  const lat1 = from.lat() * radians;
  const lat2 = to.latitude * radians;
  const longitude = (to.longitude - from.lng()) * radians;
  const y = Math.sin(longitude) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(longitude);
  return (Math.atan2(y, x) / radians + 360) % 360;
}

function distanceMetres(from: Position, to: Position): number {
  const radians = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * radians;
  const dLng = (to.longitude - from.longitude) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(dLng / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(a));
}

/**
 * Street View of one position in a corner of its map. It can be minimised to its header, restored
 * and shown full screen; a followed position updates the same panorama.
 */
@Component({
  selector: 'discocan-street-view-popup',
  imports: [Compress, Expand, ExternalLink, Times, WindowMaximize, WindowMinimize],
  templateUrl: './street-view-popup.html',
  styleUrl: './street-view-popup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[hidden]': '!position() || !hasKey',
    '[class.street-view--minimized]': 'minimized()',
    '(keydown.escape)': 'escape()',
    '(document:fullscreenchange)': 'fullscreenChanged()',
  },
})
export class StreetViewPopup {
  readonly position = input<Position | null>(null);
  readonly language = input.required<Language>();
  readonly label = input<string | null>(null);
  /** A second header line, such as the time and speed of a route point. */
  readonly detail = input<string | null>(null);
  /** The direction to look, such as a truck's heading; otherwise towards the position. */
  readonly heading = input<number | null>(null);
  readonly closable = input(true);
  readonly closed = output();

  private readonly config = inject(AdminConfig);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly frame = viewChild<ElementRef<HTMLElement>>('frame');
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  protected readonly hasKey = !!this.config.googleMapsApiKey;
  protected readonly text = computed(() => messages[this.language()]);
  protected readonly title = computed(() => {
    const point = this.position();
    return (
      this.label() ??
      (point
        ? `${coordinate(point.latitude, this.language())}, ${coordinate(point.longitude, this.language())}`
        : '')
    );
  });
  protected readonly url = computed(() => {
    const point = this.position();
    return locationMap(point?.latitude, point?.longitude);
  });
  protected readonly state = signal<'loading' | 'ready' | 'unavailable' | 'failed'>('loading');
  protected readonly failed = computed(
    () => this.state() === 'failed' || googleMapsAuthenticationFailed(),
  );
  /** Collapsed to its header; a page may restore it, for example for a newly chosen point. */
  readonly minimized = model(false);
  protected readonly fullscreen = signal(false);
  private service?: google.maps.StreetViewService;
  private panorama?: google.maps.StreetViewPanorama;
  private shown: Position | null = null;
  /** The last direction applied, so an unchanged heading never undoes the user's rotation. */
  private looking: number | null = null;
  private request = 0;

  constructor() {
    afterRenderEffect(() => {
      const point = this.position();
      const view = this.heading();
      const key = this.config.googleMapsApiKey;
      if (!point || !key) {
        this.shown = null;
        return;
      }
      if (this.shown && distanceMetres(this.shown, point) < moveMetres) {
        if (view !== null && view !== this.looking && untracked(this.state) === 'ready') {
          this.looking = view;
          this.panorama?.setPov({ heading: view, pitch: 0 });
        }
        return;
      }
      this.shown = point;
      void this.show(point, view, ++this.request, key);
    });
    afterRenderEffect(() => {
      // A restored or resized panel redraws the panorama at its new size.
      this.minimized();
      this.fullscreen();
      if (this.panorama) {
        google.maps.event.trigger(this.panorama, 'resize');
      }
    });
    this.destroyRef.onDestroy(() => {
      this.request++;
      this.panorama?.setVisible(false);
      if (this.fullscreen()) {
        void this.document.exitFullscreen();
      }
    });
  }

  protected toggleMinimized(): void {
    if (this.fullscreen()) {
      void this.document.exitFullscreen();
    }
    this.minimized.set(!this.minimized());
  }

  protected toggleFullscreen(): void {
    if (this.fullscreen()) {
      void this.document.exitFullscreen();
    } else {
      this.minimized.set(false);
      void this.frame()?.nativeElement.requestFullscreen();
    }
  }

  protected fullscreenChanged(): void {
    const frame = this.frame()?.nativeElement;
    this.fullscreen.set(!!frame && this.document.fullscreenElement === frame);
  }

  protected escape(): void {
    if (!this.position() || !this.hasKey || this.fullscreen()) {
      return;
    }
    if (this.closable()) {
      this.closed.emit();
    } else {
      this.minimized.set(true);
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  private async show(
    point: Position,
    view: number | null,
    request: number,
    key: string,
  ): Promise<void> {
    this.state.set('loading');
    let streetView: google.maps.StreetViewLibrary;
    try {
      streetView = await loadGoogleStreetView(key);
    } catch {
      if (request === this.request && !this.destroyRef.destroyed) {
        this.state.set('failed');
      }
      return;
    }
    try {
      if (request !== this.request || this.destroyRef.destroyed) {
        return;
      }
      this.service ??= new streetView.StreetViewService();
      const result = await this.service.getPanorama({
        location: { lat: point.latitude, lng: point.longitude },
        radius: searchMetres,
        preference: streetView.StreetViewPreference.NEAREST,
        source: streetView.StreetViewSource.OUTDOOR,
      });
      if (request !== this.request) {
        return;
      }
      const location = result.data.location;
      if (!location?.latLng || !location.pano) {
        this.state.set('unavailable');
        return;
      }
      this.panorama ??= new streetView.StreetViewPanorama(this.canvas().nativeElement, {
        addressControl: false,
        fullscreenControl: false,
        panControl: true,
        zoomControl: true,
      });
      this.panorama.setPano(location.pano);
      this.looking = view;
      this.panorama.setPov({ heading: view ?? bearing(location.latLng, point), pitch: 0 });
      this.panorama.setVisible(true);
      this.state.set('ready');
    } catch {
      if (request === this.request && !this.destroyRef.destroyed) {
        this.state.set(googleMapsAuthenticationFailed() ? 'failed' : 'unavailable');
      }
    }
  }
}
