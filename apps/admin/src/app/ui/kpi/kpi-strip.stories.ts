import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { onFrame } from '../../../storybook/story-config';
import { KpiStrip } from './kpi-strip';
import { KpiTile } from './kpi-tile';

const meta: Meta<KpiStrip> = {
  title: 'Design System/Patterns/KpiStrip',
  component: KpiStrip,
  decorators: [moduleMetadata({ imports: [KpiTile] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<KpiStrip>;

const tiles = `
  <holita-kpi-tile label="Active vehicles" value="45" secondary="in service: 4" footnote="38 of 42 with a device" tone="success" />
  <holita-kpi-tile label="Moving" value="11" unit="vehicles" [delta]="{ text: '+3 vs. yesterday', trend: 'up', sentiment: 'neutral' }" />
  <holita-kpi-tile label="Open alarms" value="9" secondary="critical: 4" tone="danger" [delta]="{ text: '+2', trend: 'up', sentiment: 'bad' }" explanation="Open alarms in the branch as of the data timestamp; critical alarms are counted separately." />
  <holita-kpi-tile label="Mileage, 7 days" value="18,420" unit="km" [delta]="{ text: '−6%', trend: 'down', sentiment: 'neutral' }" footnote="Oct 12 – Oct 18" />
  <holita-kpi-tile label="Overdue service" value="6" tone="warn" secondary="due within 14 days: 7" />
`;

export const Default: Story = {
  render: () => ({
    template: `<holita-kpi-strip label="Fleet today">${tiles}</holita-kpi-strip>`,
  }),
};

export const Loading: Story = {
  render: () => ({
    template: `<holita-kpi-strip label="Fleet today" [loading]="true">${tiles}</holita-kpi-strip>`,
  }),
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => ({
    template: `
      <holita-kpi-strip label="Fleet today" error="The metrics could not be refreshed. Showing the last known values.">
        ${tiles}
      </holita-kpi-strip>`,
  }),
};

export const Nulls: Story = {
  render: () => ({
    template: `
      <holita-kpi-strip label="No telemetry">
        <holita-kpi-tile label="Moving" [value]="null" unit="vehicles" footnote="no data" />
        <holita-kpi-tile label="Mileage, 7 days" [value]="null" unit="km" />
        <holita-kpi-tile label="Open alarms" value="0" />
        <holita-kpi-tile label="Average consumption" [value]="null" unit="L/100 km" footnote="0 of 42 with data" />
      </holita-kpi-strip>`,
  }),
};

export const Deltas: Story = {
  render: () => ({
    template: `
      <holita-kpi-strip label="Changes vs. the previous period">
        <holita-kpi-tile label="Mileage" value="18,420" unit="km" [delta]="{ text: '+12%', trend: 'up', sentiment: 'good' }" />
        <holita-kpi-tile label="Idling" value="7.4" unit="%" [delta]="{ text: '+1.2 pp', trend: 'up', sentiment: 'bad' }" />
        <holita-kpi-tile label="Trips" value="312" [delta]="{ text: 'no change', trend: 'flat', sentiment: 'neutral' }" />
      </holita-kpi-strip>`,
  }),
};

export const Links: Story = {
  render: () => ({
    template: `
      <holita-kpi-strip label="Needs attention">
        <holita-kpi-tile label="Critical alarms" value="4" tone="danger" [link]="['/', 'bg']" [queryParams]="{ severity: 'CRITICAL' }" explanation="Open alarms with critical severity." />
        <holita-kpi-tile label="Offline" value="4" tone="danger" [link]="['/', 'bg']" />
        <holita-kpi-tile label="Low fuel" value="3" tone="warn" [link]="['/', 'bg']" />
      </holita-kpi-strip>`,
  }),
};
