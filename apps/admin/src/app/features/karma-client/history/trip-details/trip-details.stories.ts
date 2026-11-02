import { applicationConfig, type Meta, type StoryObj } from '@storybook/angular-vite';
import { fixtureKarmaTrip } from '../../../../../storybook/karma-fixtures';
import { onFrame } from '../../../../../storybook/story-config';
import { AdminConfig } from '../../../../core/config/admin-config';
import { TripDetails } from './trip-details';

const meta: Meta<TripDetails> = {
  title: 'Admin/Karma Client/Trip details',
  component: TripDetails,
  decorators: [applicationConfig({ providers: [{ provide: AdminConfig, useValue: {} }] }), onFrame],
  tags: ['!autodocs'],
  args: { language: 'en', trip: fixtureKarmaTrip },
};
export default meta;
type Story = StoryObj<TripDetails>;

export const Endpoints: Story = {};
export const MapInParent: Story = { args: { showMap: false } };
export const MissingEndpoints: Story = {
  args: {
    trip: {
      ...fixtureKarmaTrip,
      startLatitude: null,
      startLongitude: null,
      stopLatitude: null,
      stopLongitude: null,
    },
  },
};
export const ZeroAndMissingValues: Story = {
  args: {
    showMap: false,
    trip: {
      ...fixtureKarmaTrip,
      tripDistance: 0,
      tripDuration: 0,
      startOdo: 0,
      stopOdo: null,
      maxSpeed: 0,
    },
  },
};
export const UnconfirmedState: Story = {
  args: {
    showMap: false,
    trip: { ...fixtureKarmaTrip, tripActive: null, stopDate: null },
  },
};
export const Bulgarian: Story = { args: { language: 'bg' } };
export const Mobile: Story = {
  ...Bulgarian,
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = { globals: { theme: 'dark' } };
