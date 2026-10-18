import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { ButtonDirective } from 'primeng/button';
import { onFrame } from '../../../storybook/story-config';
import { EmptyState } from './empty-state';

const meta: Meta<EmptyState> = {
  title: 'Design System/Patterns/EmptyState',
  component: EmptyState,
  decorators: [moduleMetadata({ imports: [ButtonDirective] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<EmptyState>;

export const AllKinds: Story = {
  name: 'All kinds',
  render: () => ({
    template: `
      <div class="app-card-grid">
        <div class="app-card"><holita-empty-state kind="empty" title="Все още няма шофьори" description="Добавете първия шофьор на клона."><button emptyActions pButton type="button">Нов шофьор</button></holita-empty-state></div>
        <div class="app-card"><holita-empty-state kind="no-results" title="Няма съвпадащи записи" description="Променете търсенето или филтрите."><button emptyActions pButton type="button" severity="secondary" [outlined]="true">Изчисти филтрите</button></holita-empty-state></div>
        <div class="app-card"><holita-empty-state kind="error" title="Списъкът не може да бъде зареден" description="Няма връзка с gateway-а. (fixture-AdminFleetVehicles)"><button emptyActions pButton type="button">Опитай отново</button></holita-empty-state></div>
        <div class="app-card"><holita-empty-state kind="not-found" title="Клонът не е намерен" description="Изберете наличен клон." /></div>
        <div class="app-card"><holita-empty-state kind="disabled" title="Автопаркът е недостъпен" description="Модулът е изключен в конфигурацията." /></div>
        <div class="app-card"><holita-empty-state kind="no-telemetry" title="Няма телеметрия" description="Устройствата на клона още не са изпратили данни." [compact]="true" /></div>
        <div class="app-card"><holita-empty-state kind="done" title="Няма отворени аларми" description="Всички аларми са потвърдени или решени." [compact]="true" /></div>
      </div>
    `,
  }),
};
