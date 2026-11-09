import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { Truck } from '@primeicons/angular/truck';
import { Wifi } from '@primeicons/angular/wifi';
import { ExclamationTriangle } from '@primeicons/angular/exclamation-triangle';
import { ChartLine } from '@primeicons/angular/chart-line';
import { onFrame } from '../../../storybook/story-config';
import { KpiStrip } from './kpi-strip';
import { KpiTile } from './kpi-tile';

const meta: Meta<KpiStrip> = {
  title: 'Design System/KPI',
  component: KpiStrip,
  decorators: [
    moduleMetadata({ imports: [KpiTile, Truck, Wifi, ExclamationTriangle, ChartLine] }),
    onFrame,
  ],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<KpiStrip>;

const tiles = `
  <discocan-kpi-tile label="Active vehicles" value="45" secondary="in service: 4" footnote="38 of 42 with a device" tone="success"><svg kpiIcon data-p-icon="truck" /></discocan-kpi-tile>
  <discocan-kpi-tile label="Moving" value="11" unit="vehicles" [delta]="{ text: '+3 vs. yesterday', trend: 'up', sentiment: 'neutral' }" category="c2"><svg kpiIcon data-p-icon="wifi" /></discocan-kpi-tile>
  <discocan-kpi-tile label="Open alarms" value="9" secondary="critical: 4" tone="danger" [delta]="{ text: '+2', trend: 'up', sentiment: 'bad' }" explanation="Open alarms in the branch as of the data timestamp; critical alarms are counted separately."><svg kpiIcon data-p-icon="exclamation-triangle" /></discocan-kpi-tile>
  <discocan-kpi-tile label="Mileage, 7 days" value="18,420" unit="km" [delta]="{ text: '−6%', trend: 'down', sentiment: 'neutral' }" footnote="Oct 12 – Oct 18" category="c4"><svg kpiIcon data-p-icon="chart-line" /></discocan-kpi-tile>
  <discocan-kpi-tile label="Overdue service" value="6" tone="warn" secondary="due within 14 days: 7" />
`;

export const Default: Story = {
  render: () => ({
    template: `<discocan-kpi-strip label="Fleet today">${tiles}</discocan-kpi-strip>`,
  }),
};

export const Loading: Story = {
  render: () => ({
    template: `<discocan-kpi-strip label="Fleet today" [loading]="true">${tiles}</discocan-kpi-strip>`,
  }),
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => ({
    template: `
      <discocan-kpi-strip label="Fleet today" error="The metrics could not be refreshed. Showing the last known values.">
        ${tiles}
      </discocan-kpi-strip>`,
  }),
};

export const Nulls: Story = {
  render: () => ({
    template: `
      <discocan-kpi-strip label="No telemetry">
        <discocan-kpi-tile label="Moving" [value]="null" unit="vehicles" footnote="no data" />
        <discocan-kpi-tile label="Mileage, 7 days" [value]="null" unit="km" />
        <discocan-kpi-tile label="Open alarms" value="0" />
        <discocan-kpi-tile label="Average consumption" [value]="null" unit="L/100 km" footnote="0 of 42 with data" />
      </discocan-kpi-strip>`,
  }),
};

export const Deltas: Story = {
  render: () => ({
    template: `
      <discocan-kpi-strip label="Changes vs. the previous period">
        <discocan-kpi-tile label="Mileage" value="18,420" unit="km" [delta]="{ text: '+12%', trend: 'up', sentiment: 'good' }" />
        <discocan-kpi-tile label="Idling" value="7.4" unit="%" [delta]="{ text: '+1.2 pp', trend: 'up', sentiment: 'bad' }" />
        <discocan-kpi-tile label="Trips" value="312" [delta]="{ text: 'no change', trend: 'flat', sentiment: 'neutral' }" />
      </discocan-kpi-strip>`,
  }),
};

export const Links: Story = {
  render: () => ({
    template: `
      <discocan-kpi-strip label="Needs attention">
        <discocan-kpi-tile label="Critical alarms" value="4" tone="danger" [link]="['/', 'bg']" [queryParams]="{ severity: 'CRITICAL' }" explanation="Open alarms with critical severity." />
        <discocan-kpi-tile label="Offline" value="4" tone="danger" [link]="['/', 'bg']" />
        <discocan-kpi-tile label="Low fuel" value="3" tone="warn" [link]="['/', 'bg']" />
      </discocan-kpi-strip>`,
  }),
};

export const Categories: Story = {
  render: () => ({
    template: `
      <discocan-kpi-strip label="Vehicle groups">
        @for (category of categories; track category) {
          <discocan-kpi-tile [label]="category" value="12" [category]="category">
            <svg kpiIcon data-p-icon="truck" />
          </discocan-kpi-tile>
        }
      </discocan-kpi-strip>`,
    props: { categories: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] },
  }),
};

export const LoadingGeometry: Story = {
  render: () => ({
    template: `
      <div class="app-view">
        <discocan-kpi-strip label="Loading geometry" [loading]="true">${tiles}</discocan-kpi-strip>
        <discocan-kpi-strip label="Ready geometry">${tiles}</discocan-kpi-strip>
      </div>`,
  }),
};
