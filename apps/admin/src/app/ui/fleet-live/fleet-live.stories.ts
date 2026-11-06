import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { fixtureLiveDevice } from '../../../storybook/devices-fixtures';
import { onFrame, storyLanguage } from '../../../storybook/story-config';
import { FleetConnection } from './fleet-connection';
import { FleetFaults } from './fleet-faults';
import { FleetLastReport } from './fleet-last-report';
import { FleetNow } from './fleet-now';
import { fleetLiveText } from './fleet-live';

const meta: Meta = {
  title: 'Design System/Fleet/Live cells',
  decorators: [
    moduleMetadata({ imports: [FleetConnection, FleetFaults, FleetLastReport, FleetNow] }),
    onFrame,
  ],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj;

export const Compact: Story = {
  render: (_, context) => ({
    props: { device: fixtureLiveDevice, text: fleetLiveText(storyLanguage(context.globals)) },
    template: `
      <div class="app-card-grid">
        <section class="app-card">
          <h2>{{ text.connection }}</h2>
          <div style="inline-size: 14rem"><holita-fleet-connection mode="table" [device]="device" /></div>
          <h2>{{ text.now }}</h2>
          <div style="inline-size: 14rem"><holita-fleet-now mode="table" [device]="device" /></div>
          <h2>{{ text.lastReport }}</h2>
          <div style="inline-size: 14rem"><holita-fleet-last-report mode="table" [device]="device" /></div>
          <div style="inline-size: 14rem"><holita-fleet-last-report mode="table" kind="position" [device]="device" reportedAt="2026-10-20T07:45:00.000Z" /></div>
          <h2>{{ text.faults }}</h2>
          <div style="inline-size: 14rem"><holita-fleet-faults mode="table" [device]="device" [link]="['/en']" /></div>
        </section>
        <section class="app-card">
          <h2>{{ text.unavailable }}</h2>
          <div style="inline-size: 14rem"><holita-fleet-connection mode="table" [device]="undefined" /></div>
          <div style="inline-size: 14rem"><holita-fleet-now mode="table" [device]="undefined" /></div>
          <div style="inline-size: 14rem"><holita-fleet-last-report mode="table" [device]="undefined" /></div>
          <div style="inline-size: 14rem"><holita-fleet-faults mode="table" [device]="undefined" /></div>
        </section>
      </div>`,
  }),
};

export const Record: Story = {
  render: (_, context) => ({
    props: { device: fixtureLiveDevice, text: fleetLiveText(storyLanguage(context.globals)) },
    template: `
      <section class="app-card">
        <h2>{{ text.connection }}</h2><holita-fleet-connection [device]="device" />
        <h2>{{ text.now }}</h2><holita-fleet-now [device]="device" />
        <h2>{{ text.lastReport }}</h2><holita-fleet-last-report [device]="device" />
        <h2>{{ text.faults }}</h2><holita-fleet-faults [device]="device" [link]="['/en']" />
      </section>`,
  }),
};
