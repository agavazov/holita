import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  InjectionToken,
  input,
} from '@angular/core';
import {
  applicationConfig,
  moduleMetadata,
  type Decorator,
  type Meta,
  type StoryObj,
} from '@storybook/angular-vite';
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
  },
  bg: {
    title: 'Местоположение на автопарка',
    vehicle: 'Автомобил',
    moving: 'На живо · в движение',
    parked: 'Отчита · паркиран',
    stale: 'Остаряла GPS позиция',
    unknown: 'Неизвестна позиция',
    coverage: 'Заявени 24 ч · два записани интервала · един недостъпен интервал',
  },
};

interface MapStoryConfig {
  readonly googleMapsApiKey?: string;
  readonly googleMapsMapId: string;
}

interface MapStoryArgs {
  readonly googleMapsApiKey: string;
  readonly googleMapsMapId: string;
}

const MAP_STORY_CONFIG = new InjectionToken<MapStoryConfig>('map story config');

/** A restricted browser key can be supplied explicitly through the Storybook controls. */
const withGoogleMapsConfig: Decorator<MapStoryArgs> = (story, context) => {
  const apiKey: unknown = context.args['googleMapsApiKey'];
  const mapId: unknown = context.args['googleMapsMapId'];
  const config: MapStoryConfig = {
    ...(typeof apiKey === 'string' && apiKey.trim() ? { googleMapsApiKey: apiKey.trim() } : {}),
    googleMapsMapId: typeof mapId === 'string' && mapId.trim() ? mapId.trim() : 'DEMO_MAP_ID',
  };
  return applicationConfig({
    providers: [{ provide: MAP_STORY_CONFIG, useValue: config }],
  })(story, context);
};

@Component({
  selector: 'discocan-location-map-demo',
  imports: [LocationMap],
  providers: [{ provide: AdminConfig, useFactory: () => inject(MAP_STORY_CONFIG) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <discocan-location-map
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
        speedKph: 42,
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
        speedKph: 0,
        heading: 0,
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
        speedKph: 42,
        heading: 140,
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

/** The missing-key fixture remains independent of configured map stories and preview providers. */
@Component({
  selector: 'discocan-location-map-key-missing-demo',
  imports: [LocationMapDemo],
  providers: [
    {
      provide: MAP_STORY_CONFIG,
      useValue: { googleMapsMapId: 'DEMO_MAP_ID' } satisfies MapStoryConfig,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<discocan-location-map-demo />',
})
class LocationMapKeyMissingDemo {}

const meta: Meta<MapStoryArgs> = {
  title: 'Design System/Maps',
  decorators: [
    withGoogleMapsConfig,
    moduleMetadata({ imports: [LocationMapDemo, LocationMapKeyMissingDemo] }),
    onFrame,
  ],
  tags: ['!autodocs'],
  args: { googleMapsApiKey: '', googleMapsMapId: 'DEMO_MAP_ID' },
  argTypes: {
    googleMapsApiKey: {
      control: 'text',
      description: 'Restricted Google Maps JavaScript API browser key for this preview.',
    },
    googleMapsMapId: {
      control: 'text',
      description: 'Google Maps Map ID; DEMO_MAP_ID is for development only.',
    },
  },
  parameters: {
    discocan: { now: asOf },
    docs: {
      description: {
        component:
          'Supply a restricted Google Maps JavaScript API browser key in the googleMapsApiKey control to review the live map. googleMapsMapId defaults to DEMO_MAP_ID for development. No private configuration is read by these stories. Key missing always demonstrates the accessible fallback list.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<MapStoryArgs>;

export const Many: Story = { render: () => ({ template: '<discocan-location-map-demo />' }) };
export const One: Story = {
  render: () => ({ template: '<discocan-location-map-demo mode="one" />' }),
};
export const None: Story = {
  render: () => ({ template: '<discocan-location-map-demo mode="none" />' }),
};
export const Stale: Story = {
  render: () => ({ template: '<discocan-location-map-demo mode="stale" />' }),
};
export const HeadingAndTrack: Story = {
  render: () => ({ template: '<discocan-location-map-demo mode="track" />' }),
};
export const KeyMissing: Story = {
  argTypes: { googleMapsApiKey: { control: false }, googleMapsMapId: { control: false } },
  render: () => ({ template: '<discocan-location-map-key-missing-demo />' }),
};
export const Narrow: Story = {
  globals: { viewport: { value: 'mobile375', isRotated: false } },
  render: () => ({ template: '<discocan-location-map-demo />' }),
};
