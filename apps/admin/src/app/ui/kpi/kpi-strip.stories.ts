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
  <holita-kpi-tile label="Активни превозни средства" value="45" secondary="в сервиз: 4" footnote="38 от 42 с устройство" tone="success" />
  <holita-kpi-tile label="В движение" value="11" unit="бр." [delta]="{ text: '+3 спрямо вчера', trend: 'up', sentiment: 'neutral' }" />
  <holita-kpi-tile label="Отворени аларми" value="9" secondary="критични: 4" tone="danger" [delta]="{ text: '+2', trend: 'up', sentiment: 'bad' }" explanation="Отворени аларми в клона към момента на данните; критичните се броят отделно." />
  <holita-kpi-tile label="Пробег, 7 дни" value="18 420" unit="км" [delta]="{ text: '−6%', trend: 'down', sentiment: 'neutral' }" footnote="12.10 – 18.10" />
  <holita-kpi-tile label="Просрочено обслужване" value="6" tone="warn" secondary="до 14 дни: 7" />
`;

export const Default: Story = {
  render: () => ({
    template: `<holita-kpi-strip label="Автопарк днес">${tiles}</holita-kpi-strip>`,
  }),
};

export const Loading: Story = {
  render: () => ({
    template: `<holita-kpi-strip label="Автопарк днес" [loading]="true">${tiles}</holita-kpi-strip>`,
  }),
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => ({
    template: `
      <holita-kpi-strip label="Автопарк днес" error="Показателите не можаха да се обновят. Показани са последните стойности.">
        ${tiles}
      </holita-kpi-strip>`,
  }),
};

export const Nulls: Story = {
  render: () => ({
    template: `
      <holita-kpi-strip label="Без телеметрия">
        <holita-kpi-tile label="В движение" [value]="null" unit="бр." footnote="няма данни" />
        <holita-kpi-tile label="Пробег, 7 дни" [value]="null" unit="км" />
        <holita-kpi-tile label="Отворени аларми" value="0" />
        <holita-kpi-tile label="Среден разход" [value]="null" unit="л/100 км" footnote="0 от 42 с данни" />
      </holita-kpi-strip>`,
  }),
};

export const Deltas: Story = {
  render: () => ({
    template: `
      <holita-kpi-strip label="Промени спрямо предходния период">
        <holita-kpi-tile label="Пробег" value="18 420" unit="км" [delta]="{ text: '+12%', trend: 'up', sentiment: 'good' }" />
        <holita-kpi-tile label="Празен ход" value="7,4" unit="%" [delta]="{ text: '+1,2 п.п.', trend: 'up', sentiment: 'bad' }" />
        <holita-kpi-tile label="Курсове" value="312" [delta]="{ text: 'без промяна', trend: 'flat', sentiment: 'neutral' }" />
      </holita-kpi-strip>`,
  }),
};

export const Links: Story = {
  render: () => ({
    template: `
      <holita-kpi-strip label="Нужда от внимание">
        <holita-kpi-tile label="Критични аларми" value="4" tone="danger" [link]="['/', 'bg']" [queryParams]="{ severity: 'CRITICAL' }" explanation="Отворени аларми с критична тежест." />
        <holita-kpi-tile label="Без връзка" value="4" tone="danger" [link]="['/', 'bg']" />
        <holita-kpi-tile label="Нисък резервоар" value="3" tone="warn" [link]="['/', 'bg']" />
      </holita-kpi-strip>`,
  }),
};
