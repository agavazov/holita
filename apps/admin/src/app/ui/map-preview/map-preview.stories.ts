import { applicationConfig, type Meta, type StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { onFrame } from '../../../storybook/story-config';
import { AdminConfig } from '../../core/config/admin-config';
import { MapPreview } from './map-preview';

// Synthetic offshore points; no account locations or real browser key are used.
const origin = { latitude: 0.125, longitude: 0.25 };
const destination = { latitude: 0.25, longitude: 0.5 };
const configured = applicationConfig({
  providers: [{ provide: AdminConfig, useValue: { googleMapsEmbedApiKey: 'storybook-map-key' } }],
});

const meta: Meta<MapPreview> = {
  title: 'Design System/Patterns/Map preview',
  component: MapPreview,
  decorators: [applicationConfig({ providers: [{ provide: AdminConfig, useValue: {} }] }), onFrame],
  tags: ['!autodocs'],
  args: {
    language: 'en',
    origin,
    identity: 'Synthetic location 41',
    originTime: '2026-01-01 09:59:00',
  },
};
export default meta;
type Story = StoryObj<MapPreview>;

export const Location: Story = {};
export const StreetView: Story = { args: { initialView: 'streetview' } };

export const TripEndpoints: Story = {
  args: {
    route: true,
    identity: 'Synthetic trip 9000000001',
    destination,
    destinationTime: '2026-01-01 10:29:00',
  },
};

export const NoKey: Story = { args: { route: true, destination } };

/** The selected preview loads automatically with a fake key and synthetic points. */
export const ConfiguredPreview: Story = {
  decorators: [configured],
  args: { route: true, destination, destinationTime: '2026-01-01 10:29:00' },
};

export const MissingCoordinates: Story = { args: { origin: null, originTime: null } };
export const InvalidCoordinates: Story = { args: { origin: { latitude: 91, longitude: 181 } } };
export const ZeroCoordinates: Story = { args: { origin: { latitude: 0, longitude: 0 } } };
export const StartOnly: Story = { args: { route: true } };
export const EndOnly: Story = {
  args: { route: true, origin: null, originTime: null, destination, destinationTime: null },
};
export const MissingTime: Story = { args: { originTime: null } };
export const Bulgarian: Story = {
  ...TripEndpoints,
  args: { ...TripEndpoints.args, language: 'bg' },
};
export const Mobile: Story = {
  ...Bulgarian,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { ...TripEndpoints, globals: { theme: 'dark' } };

/** Change the source identity/time at the same point without replacing the component. */
export const ContextChange: Story = {
  decorators: [configured],
  render: (args) => ({
    props: { ...args, changed: false },
    moduleMetadata: { imports: [MapPreview, ButtonDirective] },
    template: `
      <div class="app-view">
        <button pButton type="button" severity="secondary" (click)="changed = !changed">
          Change synthetic source record
        </button>
        <holita-map-preview
          [language]="language"
          [origin]="origin"
          [identity]="changed ? 'Synthetic location 42' : identity"
          [originTime]="changed ? '2026-01-01 10:29:00' : originTime"
        />
      </div>
    `,
  }),
};
