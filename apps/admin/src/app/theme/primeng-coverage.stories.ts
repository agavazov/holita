import { afterNextRender, Component, type ElementRef, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { Search } from '@primeicons/angular/search';
import { ConfirmationService } from 'primeng/api';
import { AutoComplete } from 'primeng/autocomplete';
import { Avatar } from 'primeng/avatar';
import { Badge } from 'primeng/badge';
import { ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Chip } from 'primeng/chip';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DatePicker } from 'primeng/datepicker';
import { Dialog } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputNumber } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { Listbox } from 'primeng/listbox';
import { Message } from 'primeng/message';
import { MeterGroup } from 'primeng/metergroup';
import { Paginator } from 'primeng/paginator';
import { Popover } from 'primeng/popover';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { Tag } from 'primeng/tag';
import { Textarea } from 'primeng/textarea';
import { Timeline } from 'primeng/timeline';
import { ToggleButton } from 'primeng/togglebutton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { expect, waitFor, within } from 'storybook/test';
import { confirmDestructive, confirmDialogPt } from '../ui/confirm';
import { selectMultiplePt } from '../ui/select-multiple';
import { registeredComponents } from './holita-preset';

const vehicles = Array.from({ length: 200 }, (_, index) => `CB ${String(1001 + index)} AX`);

/** Every control of the registered presets, rendered inline. */
@Component({
  selector: 'holita-primeng-controls',
  imports: [
    FormsModule,
    AutoComplete,
    Avatar,
    Badge,
    ButtonDirective,
    Checkbox,
    Chip,
    DatePicker,
    IconField,
    InputIcon,
    InputNumber,
    InputText,
    Listbox,
    Message,
    MeterGroup,
    Paginator,
    Search,
    Select,
    SelectButton,
    Skeleton,
    TableModule,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    Tag,
    Textarea,
    Timeline,
    ToggleButton,
    ToggleSwitch,
  ],
  templateUrl: './primeng-coverage.html',
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(34rem, 1fr));
      gap: 1rem;
      padding: 1.5rem;
    }
    .scheme {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1.25rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-app-radius-panel);
      background: var(--p-app-frame-background);
      color: var(--p-text-color);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .label {
      inline-size: 100%;
      font-size: var(--p-app-text-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--p-text-muted-color);
    }
  `,
})
class PrimeNgControls {
  readonly selectMultiplePt = selectMultiplePt;
  readonly schemes = ['light', 'dark'] as const;
  readonly vehicles = vehicles;
  readonly suggestions = vehicles.slice(0, 5);
  readonly statuses = ['Активно', 'В сервиз', 'Неактивно'];
  readonly segments = [
    { label: '7 дни', value: '7d' },
    { label: '30 дни', value: '30d' },
    { label: 'Период', value: 'custom' },
  ];
  readonly meter = [
    { label: 'В движение', value: 24, color: 'var(--p-app-tone-success-solid)' },
    { label: 'Празен ход', value: 11, color: 'var(--p-app-tone-warn-solid)' },
    { label: 'Паркирани', value: 41, color: 'var(--p-app-tone-info-solid)' },
  ];
  readonly rows = vehicles
    .slice(0, 3)
    .map((plate, index) => ({ plate, odometer: 412330 - index * 9000 }));
  readonly events = [{ title: 'Отворена' }, { title: 'Потвърдена' }, { title: 'Решена' }];
  date = new Date(2026, 9, 18);
  vehicle = vehicles[0];
  selected = [vehicles[0], vehicles[2]];
  segment = '7d';
  checked = true;
  toggled = true;
  amount = 650;
  status = 'Активно';
}

/** Non-modal overlay controls: dialog, drawer, popover and tooltip, opened on render. */
@Component({
  selector: 'holita-primeng-overlays',
  imports: [ButtonDirective, Dialog, Drawer, Popover, Tooltip],
  template: `
    <div class="anchors">
      <button #popoverAnchor pButton type="button" severity="secondary" [outlined]="true">
        Popover
      </button>
      <button
        #tooltipAnchor
        pButton
        type="button"
        severity="secondary"
        [outlined]="true"
        pTooltip="Показва се при фокус и посочване"
        tooltipEvent="focus"
      >
        Tooltip
      </button>
    </div>
    <p-popover #popover ariaLabel="Обяснение">
      <p style="max-inline-size: 16rem">Отворени аларми в клона към момента на данните.</p>
    </p-popover>
    <p-dialog
      header="Детайли (Karma)"
      [visible]="true"
      [modal]="false"
      [draggable]="false"
      [style]="{ width: '24rem' }"
      closeAriaLabel="Затвори"
      position="topleft"
    >
      <p>Диалозите остават само за Karma Client; Fleet редактира в чекмеджета.</p>
    </p-dialog>
    <p-drawer
      header="Навигация"
      [visible]="true"
      [modal]="false"
      position="right"
      ariaCloseLabel="Затвори"
    >
      <p>Мобилна навигация и чекмеджета на маршрути.</p>
    </p-drawer>
  `,
  styles: `
    .anchors {
      display: flex;
      gap: 0.5rem;
      padding: 1.5rem;
      padding-block-start: 22rem;
    }
  `,
})
class PrimeNgOverlays {
  private readonly popover = viewChild.required(Popover);
  private readonly popoverAnchor = viewChild.required<ElementRef<HTMLElement>>('popoverAnchor');
  private readonly tooltipAnchor = viewChild.required<ElementRef<HTMLElement>>('tooltipAnchor');

  constructor() {
    afterNextRender(() => {
      this.popover().show(null, this.popoverAnchor().nativeElement);
      this.tooltipAnchor().nativeElement.focus();
    });
  }
}

/** The modal confirmation every destructive action uses (`confirmDestructive`). */
@Component({
  selector: 'holita-primeng-confirm',
  imports: [ConfirmDialog],
  providers: [ConfirmationService],
  template: `<p-confirmdialog [pt]="pt" />`,
})
class PrimeNgConfirm {
  readonly pt = confirmDialogPt('bg');
  private readonly confirmation = inject(ConfirmationService);

  constructor() {
    afterNextRender(() => {
      void confirmDestructive(this.confirmation, 'bg', {
        header: 'Изтриване на превозни средства',
        message: 'Да изтрием ли 3 избрани превозни средства?',
        acceptLabel: 'Изтрий',
      });
    });
  }
}

const meta: Meta = {
  title: 'Design System/PrimeNG coverage',
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj;

export const Controls: Story = {
  render: () => ({
    moduleMetadata: { imports: [PrimeNgControls] },
    template: '<holita-primeng-controls />',
  }),
  play: async ({ canvasElement }) => {
    await expect(Object.keys(registeredComponents)).toHaveLength(30);
    await expect(canvasElement.querySelectorAll('.scheme').length).toBe(2);
  },
};

export const Overlays: Story = {
  render: () => ({
    moduleMetadata: { imports: [PrimeNgOverlays] },
    template: '<holita-primeng-overlays />',
  }),
  play: async ({ canvasElement }) => {
    // Overlays fade in; the accessibility check runs on their final colours.
    await waitFor(() => {
      const tooltip = canvasElement.ownerDocument.querySelector('.p-tooltip');
      if (!tooltip) throw new Error('Missing tooltip.');
      return expect(getComputedStyle(tooltip).opacity).toBe('1');
    });
  },
};

export const ConfirmDialogStory: Story = {
  name: 'Confirm dialog',
  render: () => ({
    moduleMetadata: { imports: [PrimeNgConfirm] },
    template: '<holita-primeng-confirm />',
  }),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getByRole('alertdialog')).toBeVisible());
    await waitFor(() => expect(body.getByRole('button', { name: 'Отказ' })).toHaveFocus());
  },
};
