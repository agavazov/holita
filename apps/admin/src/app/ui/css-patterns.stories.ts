import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { Tag } from 'primeng/tag';
import { Timeline } from 'primeng/timeline';
import { onFrame } from '../../storybook/story-config';

const meta: Meta = {
  title: 'Design System/Patterns/CSS patterns',
  decorators: [moduleMetadata({ imports: [Tag, Timeline] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

export const Facts: Story = {
  render: () => ({
    template: `
      <section class="app-card">
        <div class="app-card__header"><h2 class="app-card__title">Vehicle details</h2><p-tag severity="success" value="Active" /></div>
        <dl class="app-facts">
          <div><dt>License plate</dt><dd>CB 1004 AX</dd></div>
          <div><dt>Fleet number</dt><dd>T-04</dd></div>
          <div><dt>Make and model</dt><dd>MAN TGX 18.510 · 2021</dd></div>
          <div><dt>VIN</dt><dd class="app-mono">WMA06XZZ1MP123456</dd></div>
          <div><dt>Odometer</dt><dd class="app-num">412,330 km</dd></div>
          <div><dt>Fuel tank</dt><dd><span class="app-meter app-meter--success" style="--app-meter-value: 64%"></span> 64% of 650 L</dd></div>
          <div><dt>Driver</dt><dd>—</dd></div>
          <div class="app-facts--wide"><dt>Notes</dt><dd>Tractor unit for international haulage; serviced every 90,000 km.</dd></div>
        </dl>
      </section>
    `,
  }),
};

export const TimelineEvents: Story = {
  name: 'Timeline',
  render: () => ({
    props: {
      events: [
        {
          title: 'Harsh braking',
          meta: '08:12 · 84 km/h → 31 km/h · Tsarigradsko Shose Blvd.',
          tone: 'danger',
        },
        { title: 'Speeding', meta: '08:31 · 128 / 90 km/h', tone: 'warn' },
        { title: 'Idling over 10 min', meta: '09:05 · 14 min', tone: 'info' },
        { title: 'Trip end', meta: '09:40 · 112.4 km · 1 h 28 min', tone: 'neutral' },
      ],
    },
    template: `
      <section class="app-card">
        <div class="app-card__header"><h2 class="app-card__title">Trip events</h2></div>
        <p-timeline [value]="events">
          <ng-template #marker let-event>
            <span [class]="'app-dot app-dot--' + event.tone"></span>
          </ng-template>
          <ng-template #content let-event>
            <div class="app-timeline-event">
              <span class="app-timeline-event__title">{{ event.title }}</span>
              <span class="app-timeline-event__meta">{{ event.meta }}</span>
            </div>
          </ng-template>
        </p-timeline>
      </section>
    `,
  }),
};
