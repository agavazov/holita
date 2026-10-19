import { afterNextRender, Component, type ElementRef, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { Search } from '@primeicons/angular/search';
import { ConfirmationService, MessageService } from 'primeng/api';
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
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { confirmAction, confirmDialogPt } from '../ui/confirm';
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
  readonly statuses = ['Active', 'In service', 'Inactive'];
  readonly segments = [
    { label: '7 days', value: '7d' },
    { label: '30 days', value: '30d' },
    { label: 'Custom', value: 'custom' },
  ];
  readonly meter = [
    { label: 'Moving', value: 24, color: 'var(--p-app-tone-success-solid)' },
    { label: 'Idling', value: 11, color: 'var(--p-app-tone-warn-solid)' },
    { label: 'Parked', value: 41, color: 'var(--p-app-tone-info-solid)' },
  ];
  readonly rows = vehicles
    .slice(0, 3)
    .map((plate, index) => ({ plate, odometer: 412330 - index * 9000 }));
  readonly events = [{ title: 'Opened' }, { title: 'Acknowledged' }, { title: 'Resolved' }];
  date = new Date(2026, 9, 18);
  vehicle = vehicles[0];
  selected = [vehicles[0], vehicles[2]];
  segment = '7d';
  checked = true;
  toggled = true;
  amount = 650;
  status = 'Active';
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
        pTooltip="Shown on focus and hover"
        tooltipEvent="focus"
      >
        Tooltip
      </button>
    </div>
    <p-popover #popover ariaLabel="Explanation">
      <p style="max-inline-size: 16rem">Open alarms in the branch as of the data timestamp.</p>
    </p-popover>
    <p-dialog
      header="Details (Karma)"
      [visible]="true"
      [modal]="false"
      [draggable]="false"
      [style]="{ width: '24rem' }"
      closeAriaLabel="Close"
      position="topleft"
    >
      <p>Dialogs remain for Karma Client only; Fleet edits in drawers.</p>
    </p-dialog>
    <p-drawer
      header="Navigation"
      [visible]="true"
      [modal]="false"
      position="right"
      ariaCloseLabel="Close"
    >
      <p>Mobile navigation and route drawers.</p>
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

/** The modal confirmation of destructive actions (`confirmAction` with `danger`). */
@Component({
  selector: 'holita-primeng-confirm',
  imports: [ConfirmDialog],
  providers: [ConfirmationService],
  template: `<p-confirmdialog [pt]="pt" />`,
})
class PrimeNgConfirm {
  readonly pt = confirmDialogPt('en');
  private readonly confirmation = inject(ConfirmationService);

  constructor() {
    afterNextRender(() => {
      void confirmAction(this.confirmation, 'en', {
        header: 'Delete 3 vehicles?',
        message: 'Their trips stay in reports.',
        acceptLabel: 'Delete',
        danger: true,
      });
    });
  }
}

/** Uses the preview's single Toast host, as every example page does. */
@Component({
  selector: 'holita-primeng-toast',
  imports: [ButtonDirective],
  template: '<button pButton type="button" (click)="show()">Show toast</button>',
})
class PrimeNgToast {
  private readonly messages = inject(MessageService);

  protected show(): void {
    this.messages.add({ severity: 'info', summary: 'Toast notification', sticky: true });
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
    await expect(Object.keys(registeredComponents)).toHaveLength(32);
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
      if (!tooltip) {
        throw new Error('Missing tooltip.');
      }
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
    await waitFor(() => expect(body.getByRole('button', { name: 'Cancel' })).toHaveFocus());
  },
};

export const ToastStory: Story = {
  name: 'Toast',
  render: () => ({
    moduleMetadata: { imports: [PrimeNgToast] },
    template: '<holita-primeng-toast />',
  }),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show toast' }));
    await waitFor(() =>
      expect(within(canvasElement).getByRole('alert')).toHaveTextContent('Toast notification'),
    );
    await expect(canvasElement.querySelectorAll('p-toast')).toHaveLength(1);
  },
};
