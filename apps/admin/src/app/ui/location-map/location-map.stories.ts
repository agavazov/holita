import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { onFrame } from '../../../storybook/story-config';
import { AdminConfig } from '../../core/config/admin-config';
import { UI_LANGUAGE } from '../ui-language';
import { LocationMap, type LocationMapRecord, type LocationMapTrack } from './location-map';

const asOf = '2026-11-06T12:00:00.000Z';
const storyMessages = {
  en: {
    title: 'Fleet locations',
    vehicle: 'Vehicle',
    moving: 'Live · moving',
    parked: 'Reporting · parked',
    stale: 'Stale GPS',
    unknown: 'Unknown position',
    coverage: '24 h requested · two recorded intervals · one unavailable interval',
    tileProvider: 'Synthetic unavailable tile provider',
  },
  bg: {
    title: 'Местоположение на автопарка',
    vehicle: 'Автомобил',
    moving: 'На живо · в движение',
    parked: 'Отчита · паркиран',
    stale: 'Остаряла GPS позиция',
    unknown: 'Неизвестна позиция',
    coverage: 'Заявени 24 ч · два записани интервала · един недостъпен интервал',
    tileProvider: 'Примерен недостъпен доставчик на картни плочки',
  },
};

@Component({
  selector: 'holita-location-map-demo',
  imports: [LocationMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <holita-location-map
      [language]="language()"
      [title]="text().title"
      [records]="records()"
      [track]="track()"
      [asOf]="asOf"
      [updatedAt]="asOf"
      timeZone="Europe/Sofia"
    />
  `,
})
class LocationMapDemo {
  readonly mode = input<'many' | 'one' | 'none' | 'stale' | 'track'>('many');
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => storyMessages[this.language()]);
  protected readonly asOf = asOf;
  protected readonly records = computed<readonly LocationMapRecord[]>(() => {
    const text = this.text();
    const records: readonly LocationMapRecord[] = [
      {
        id: 'v1',
        label: `${text.vehicle} 1`,
        plate: 'CB 1001 AX',
        countryCode: 'BG',
        status: { label: text.moving, tone: 'success' },
        position: { latitude: 42.6977, longitude: 23.3219 },
        positionAt: '2026-11-06T11:59:00.000Z',
        heading: 80,
        href: '#vehicle-1',
      },
      {
        id: 'v2',
        label: `${text.vehicle} 2`,
        plate: 'CB 1002 AX',
        countryCode: 'BG',
        status: { label: text.parked, tone: 'info' },
        position: { latitude: 42.72, longitude: 23.36 },
        positionAt: '2026-11-06T11:50:00.000Z',
        href: '#vehicle-2',
      },
      {
        id: 'v3',
        label: `${text.vehicle} 3`,
        plate: 'CB 1003 AX',
        countryCode: 'BG',
        status: { label: text.stale, tone: 'warn' },
        position: { latitude: 42.66, longitude: 23.39 },
        positionAt: '2026-11-03T10:00:00.000Z',
        heading: null,
        href: '#vehicle-3',
      },
      {
        id: 'v4',
        label: `${text.vehicle} 4`,
        plate: 'CB 1004 AX',
        countryCode: 'BG',
        status: { label: text.unknown, tone: 'neutral' },
        position: null,
        positionAt: null,
        href: '#vehicle-4',
      },
    ];
    switch (this.mode()) {
      case 'one':
      case 'track':
        return records.slice(0, 1);
      case 'none':
        return records.slice(3);
      case 'stale':
        return records.slice(2, 3);
      case 'many':
        return records;
    }
  });
  protected readonly track = computed<LocationMapTrack | null>(() =>
    this.mode() === 'track'
      ? {
          recordId: 'v1',
          from: '2026-11-05T12:00:00.000Z',
          to: asOf,
          truncated: true,
          coverage: this.text().coverage,
          points: [
            {
              position: { latitude: 42.68, longitude: 23.28 },
              recordedAt: '2026-11-06T10:00:00.000Z',
            },
            {
              position: { latitude: 42.69, longitude: 23.29 },
              recordedAt: '2026-11-06T10:10:00.000Z',
            },
            { position: null, recordedAt: '2026-11-06T10:20:00.000Z' },
            {
              position: { latitude: 42.695, longitude: 23.31 },
              recordedAt: '2026-11-06T11:40:00.000Z',
              breakBefore: true,
            },
            {
              position: { latitude: 42.6977, longitude: 23.3219 },
              recordedAt: '2026-11-06T11:59:00.000Z',
            },
          ],
        }
      : null,
  );
}

/** An element-scoped provider keeps the failure fixture independent of preview provider order. */
@Component({
  selector: 'holita-location-map-tile-failure-demo',
  imports: [LocationMapDemo],
  providers: [
    {
      provide: AdminConfig,
      useFactory: () => ({
        mapTileUrl: 'http://127.0.0.1:1/{z}/{x}/{y}.png',
        mapAttribution: storyMessages[inject(UI_LANGUAGE)()].tileProvider,
      }),
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<holita-location-map-demo />',
})
class LocationMapTileFailureDemo {}

const meta: Meta = {
  title: 'Design System/Maps',
  decorators: [moduleMetadata({ imports: [LocationMapDemo, LocationMapTileFailureDemo] }), onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj;

export const Many: Story = { render: () => ({ template: '<holita-location-map-demo />' }) };
export const One: Story = {
  render: () => ({ template: '<holita-location-map-demo mode="one" />' }),
};
export const None: Story = {
  render: () => ({ template: '<holita-location-map-demo mode="none" />' }),
};
export const Stale: Story = {
  render: () => ({ template: '<holita-location-map-demo mode="stale" />' }),
};
export const HeadingAndTrack: Story = {
  render: () => ({ template: '<holita-location-map-demo mode="track" />' }),
};
export const TileFailure: Story = {
  render: () => ({ template: '<holita-location-map-tile-failure-demo />' }),
};
export const Narrow: Story = {
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  render: () => ({ template: '<holita-location-map-demo />' }),
};
