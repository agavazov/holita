import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { Tag } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { Timeline } from 'primeng/timeline';
import { onFrame } from '../../storybook/story-config';

const meta: Meta = {
  title: 'Design System/Patterns/CSS patterns',
  decorators: [moduleMetadata({ imports: [Tag, TableModule, Timeline] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

export const RouteNavigation: Story = {
  render: () => ({
    template: `
      <section class="app-view">
        <h1>Truck workspace</h1>
        <nav aria-label="Truck sections">
          <ul class="app-route-nav" role="list">
            <li><a class="app-route-nav__link app-route-nav__link--active" href="#overview" aria-current="page">Overview</a></li>
            <li><a class="app-route-nav__link" href="#trips">Trips</a></li>
            <li><a class="app-route-nav__link" href="#location">Location</a></li>
          </ul>
        </nav>
        <div class="app-context-toolbar">
          <h2 id="overview">Overview</h2>
          <div class="app-page-actions"><a class="app-link" href="#trips">View trips</a></div>
        </div>
        <p class="app-muted">Identity, section navigation, contextual actions, then content.</p>
      </section>
    `,
  }),
};

export const Facts: Story = {
  render: () => ({
    template: `
      <section class="app-card">
        <div class="app-card__header"><h2 class="app-card__title">Vehicle details</h2><p-tag severity="success" value="Active" /></div>
        <dl class="app-facts">
          <div><dt>License plate</dt><dd><span class="app-plate" data-country="BG">CB 1004 AX</span></dd></div>
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

export const CardsAndStacks: Story = {
  render: () => ({
    template: `
      <div class="app-tab-content">
        <p class="app-muted">Tab content stretches its sibling blocks and separates them with the density stack gap.</p>
        <div class="app-card-grid">
          <section class="app-card">
            <header class="app-card__header"><h2 class="app-card__title">Card spacing</h2><p-tag value="Ready" severity="success" /></header>
            <div class="app-card__body">
              <p>Headings, paragraphs and child blocks retain a token gap after the reset removes margins.</p>
              <dl class="app-facts"><div><dt>Vehicle</dt><dd><span class="app-plate" data-country="BG">CB 1004 AX</span></dd></div></dl>
              <div class="app-stack"><a class="app-link" href="#record">Open vehicle</a><span class="app-muted">Start-aligned actions use app-stack.</span></div>
            </div>
          </section>
          <section class="app-card app-card--accent">
            <h2 class="app-card__title">Panel accent</h2>
            <p>A restrained accent for a lead panel; ordinary content stays on the panel surface.</p>
            <div class="app-card__body"><p>Two sibling blocks</p><p>with a stretching body gap.</p></div>
          </section>
        </div>
        <section class="app-card"><h2 class="app-card__title">Next sibling panel</h2><p>Card spacing and outer stack spacing are independent.</p></section>
      </div>
    `,
  }),
};

export const LicencePlates: Story = {
  render: () => ({
    template: `
      <div class="app-card-grid">
        <section class="app-card"><h2 class="app-card__title">List identity</h2><div class="app-cell-identity"><span class="app-plate" data-country="BG">CB 1004 AX</span><span>MAN TGX · Fleet 04</span></div></section>
        <section class="app-card"><h2 class="app-card__title">Record</h2><dl class="app-facts"><div><dt>Registration</dt><dd><span class="app-plate" data-country="DE">B AB 1234</span></dd></div></dl></section>
        <section class="app-card"><h2 class="app-card__title">Map popup</h2><div class="app-card__body"><span><span class="app-plate" data-country="BG">PB 2048 BT</span></span><p>Latest recorded position · 6 minutes ago</p><a class="app-link" href="#record">Open vehicle</a></div></section>
      </div>
    `,
  }),
};

export const BoundedCells: Story = {
  render: () => ({
    props: {
      rows: [
        {
          id: '1',
          plate: 'CB 1004 AX',
          identity: 'MAN TGX · A long vehicle description that stays inside its column',
          status: 'Reporting',
          severity: 'success',
          date: '2026-11-06 13:24',
          distance: '412,330 km',
          problems: 2,
        },
        {
          id: '2',
          plate: 'PB 2048 BT',
          identity: 'Volvo FH · International distribution group',
          status: 'Disconnected',
          severity: 'warn',
          date: '2026-11-05 22:10',
          distance: '0 km',
          problems: 0,
        },
      ],
    },
    template: `
      <section class="app-card">
        <h2 class="app-card__title">Identity, status, date, number and problems</h2>
        <p-table [value]="rows" dataKey="id" [scrollable]="true" styleClass="app-table-fixed" [tableStyle]="{ 'min-width': '58rem' }">
          <ng-template #colgroup><colgroup><col style="width: 16rem" /><col style="width: 12rem" /><col style="width: 12rem" /><col style="width: 10rem" /><col style="width: 8rem" /></colgroup></ng-template>
          <ng-template #header><tr><th scope="col">Vehicle</th><th scope="col">Activity</th><th scope="col">Last report</th><th scope="col" class="app-cell-number">Odometer</th><th scope="col">Problems</th></tr></ng-template>
          <ng-template #body let-row><tr>
            <td><div class="app-cell-identity"><span class="app-plate" data-country="BG">{{ row.plate }}</span><span [title]="row.identity">{{ row.identity }}</span></div></td>
            <td><div class="app-cell-status"><p-tag [value]="row.status" [severity]="row.severity" /></div></td>
            <td class="app-cell-date"><time [title]="row.date + ' · Europe/Sofia'">{{ row.date }}</time></td>
            <td class="app-cell-number" [title]="row.distance">{{ row.distance }}</td>
            <td><div class="app-cell-problems"><span class="app-dot" [class.app-dot--danger]="row.problems > 0" [class.app-dot--neutral]="row.problems === 0" aria-hidden="true"></span><a class="app-link" href="#problems">{{ row.problems }} recorded</a></div></td>
          </tr></ng-template>
        </p-table>
      </section>
    `,
  }),
};

export const StatusPanels: Story = {
  render: () => ({
    template: `
      <div class="app-card-grid">
        <section class="app-card"><h2 class="app-card__title">Status icon wells</h2><div class="app-page-actions"><span class="app-icon-well app-icon-well--success" role="img" aria-label="Success">✓</span><span class="app-icon-well app-icon-well--info" role="img" aria-label="Information">i</span><span class="app-icon-well app-icon-well--warn" role="img" aria-label="Warning">!</span><span class="app-icon-well app-icon-well--danger" role="img" aria-label="Problem">!</span></div><p>Each colour has a text or icon equivalent.</p></section>
        <section class="app-problem-panel app-problem-panel--warn"><span class="app-icon-well app-icon-well--warn" aria-hidden="true">!</span><div class="app-card__body"><h2 class="app-card__title">Reporting gap</h2><p>No recent frame. Connection and position age remain separate facts.</p></div></section>
        <section class="app-problem-panel app-problem-panel--danger"><div class="app-card__body"><h2 class="app-card__title">2 recorded faults</h2><p>Historical device evidence; this count does not assert that faults are currently unresolved.</p><a class="app-link" href="#problems">Review evidence</a></div></section>
      </div>
    `,
  }),
};
