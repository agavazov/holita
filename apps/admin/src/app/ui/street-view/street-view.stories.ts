import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  InjectionToken,
  input,
  signal,
} from '@angular/core';
import {
  applicationConfig,
  moduleMetadata,
  type Decorator,
  type Meta,
  type StoryObj,
} from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { onFrame } from '../../../storybook/story-config';
import { AdminConfig } from '../../core/config/admin-config';
import { UI_LANGUAGE } from '../ui-language';
import { StreetViewPopup } from './street-view-popup';

interface StreetViewStoryArgs {
  readonly googleMapsApiKey: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly label: string;
}

interface StreetViewStoryConfig {
  readonly googleMapsApiKey?: string;
}

const STREET_VIEW_STORY_CONFIG = new InjectionToken<StreetViewStoryConfig>(
  'street view story config',
);

const withGoogleMapsConfig: Decorator<StreetViewStoryArgs> = (story, context) => {
  const apiKey: unknown = context.args['googleMapsApiKey'];
  const config: StreetViewStoryConfig =
    typeof apiKey === 'string' && apiKey.trim() ? { googleMapsApiKey: apiKey.trim() } : {};
  return applicationConfig({
    providers: [{ provide: STREET_VIEW_STORY_CONFIG, useValue: config }],
  })(story, context);
};

@Component({
  selector: 'discocan-street-view-demo',
  imports: [ButtonDirective, StreetViewPopup],
  providers: [{ provide: AdminConfig, useFactory: () => inject(STREET_VIEW_STORY_CONFIG) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-card" style="position: relative; min-height: 400px">
      <button pButton type="button" (click)="open.set(true)">
        {{ language() === 'bg' ? 'Отвори Street View' : 'Open Street View' }}
      </button>
      <discocan-street-view-popup
        [position]="position()"
        [language]="language()"
        [label]="label() || null"
        (closed)="open.set(false)"
      />
    </div>
  `,
})
class StreetViewDemo {
  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  readonly label = input('');
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly open = signal(true);
  protected readonly position = computed(() =>
    this.open() ? { latitude: this.latitude(), longitude: this.longitude() } : null,
  );
}

const meta: Meta<StreetViewStoryArgs> = {
  title: 'Design System/Street View',
  decorators: [withGoogleMapsConfig, moduleMetadata({ imports: [StreetViewDemo] }), onFrame],
  tags: ['!autodocs'],
  args: {
    googleMapsApiKey: '',
    latitude: 42.6977,
    longitude: 23.3219,
    label: 'CB 1001 AX',
  },
  argTypes: {
    googleMapsApiKey: {
      control: 'text',
      description: 'Restricted Google Maps JavaScript API browser key for this preview.',
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Supply a restricted Google Maps JavaScript API browser key in the googleMapsApiKey control to review Street View. No private configuration is read by this story.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<StreetViewStoryArgs>;

export const Popup: Story = {
  render: (args) => ({
    props: args,
    template:
      '<discocan-street-view-demo [latitude]="latitude" [longitude]="longitude" [label]="label" />',
  }),
};
