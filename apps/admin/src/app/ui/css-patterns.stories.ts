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
        <div class="app-card__header"><h2 class="app-card__title">Данни за превозното средство</h2><p-tag severity="success" value="Активно" /></div>
        <dl class="app-facts">
          <div><dt>Регистрационен номер</dt><dd>CB 1004 AX</dd></div>
          <div><dt>Пореден номер</dt><dd>Т-04</dd></div>
          <div><dt>Марка и модел</dt><dd>MAN TGX 18.510 · 2021</dd></div>
          <div><dt>VIN</dt><dd class="app-mono">WMA06XZZ1MP123456</dd></div>
          <div><dt>Пробег</dt><dd class="app-num">412 330 км</dd></div>
          <div><dt>Резервоар</dt><dd><span class="app-meter app-meter--success" style="--app-meter-value: 64%"></span> 64% от 650 л</dd></div>
          <div><dt>Шофьор</dt><dd>—</dd></div>
          <div class="app-facts--wide"><dt>Бележки</dt><dd>Влекач за международни превози; обслужване на всеки 90 000 км.</dd></div>
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
          title: 'Рязко спиране',
          meta: '08:12 · 84 км/ч → 31 км/ч · бул. Цариградско шосе',
          tone: 'danger',
        },
        { title: 'Превишена скорост', meta: '08:31 · 128 / 90 км/ч', tone: 'warn' },
        { title: 'Празен ход над 10 мин', meta: '09:05 · 14 мин', tone: 'info' },
        { title: 'Край на курса', meta: '09:40 · 112,4 км · 1 ч 28 мин', tone: 'neutral' },
      ],
    },
    template: `
      <section class="app-card">
        <div class="app-card__header"><h2 class="app-card__title">Събития по курса</h2></div>
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
