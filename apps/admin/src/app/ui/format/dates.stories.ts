import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { type Meta, type StoryObj } from '@storybook/angular-vite';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { FormField } from '../form-field/form-field';
import { onFrame, storyLanguage } from '../../../storybook/story-config';
import { formatDateTimeInput, parseDateTimeInput } from '../forms/date-time-input';
import { UI_LANGUAGE } from '../ui-language';
import bg from './bg.json';
import en from './en.json';
import {
  dateFormatLabels,
  datePickerFormat,
  defaultDateFormat,
  type FleetDateFormat,
  formatDateOnly,
  formatDateRange,
  formatDateTimeCell,
  formatUtcInstant,
  supportedDateFormats,
} from './format';

const messages = { bg, en };
const instant = '2026-10-18T07:00:45.125Z';

@Component({
  selector: 'holita-date-editor-demo',
  imports: [ReactiveFormsModule, DatePicker, InputText, FormField],
  template: `
    <section class="app-card">
      <header class="app-card__header">
        <h2 class="app-card__title">{{ text().heading }}</h2>
      </header>
      <div class="app-card__body app-stack">
        <p class="app-muted">{{ text().zone }}: {{ timeZone() }} · {{ formatLabel() }}</p>
        <div class="app-form-grid">
          <holita-form-field controlId="date-demo-calendar" [label]="text().calendarDate">
            <p-datepicker
              inputId="date-demo-calendar"
              [formControl]="calendar"
              [dateFormat]="pickerFormat()"
              [fluid]="true"
              appendTo="body"
            />
          </holita-form-field>
          <holita-form-field
            controlId="date-demo-instant"
            [label]="text().editor"
            [hint]="text().help"
            [error]="!parsed() ? text().invalid : null"
          >
            <input
              pInputText
              id="date-demo-instant"
              [formControl]="wallTime"
              [placeholder]="formatLabel() + ' HH:mm:ss.sss'"
              [invalid]="!parsed()"
              aria-describedby="date-demo-instant-hint date-demo-instant-error"
            />
          </holita-form-field>
        </div>
        <dl class="app-facts">
          <div>
            <dt>{{ text().utc }}</dt>
            <dd class="app-mono">{{ parsed() ?? '—' }}</dd>
          </div>
        </dl>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class DateEditorDemo {
  readonly dateFormat = input<FleetDateFormat>(defaultDateFormat);
  readonly timeZone = input('Europe/Sofia');
  readonly original = input(instant);
  readonly initialText = input<string | null>(null);
  private readonly language = inject(UI_LANGUAGE);
  protected readonly text = computed(() => messages[this.language()]);
  protected readonly formatLabel = computed(() => dateFormatLabels[this.dateFormat()]);
  protected readonly pickerFormat = computed(() => datePickerFormat(this.dateFormat()));
  protected readonly calendar = new FormControl<Date | null>(new Date(2026, 9, 18));
  protected readonly wallTime = new FormControl('', { nonNullable: true });
  private readonly value = toSignal(this.wallTime.valueChanges, { initialValue: '' });
  protected readonly parsed = computed(() =>
    parseDateTimeInput(this.value(), this.timeZone(), this.dateFormat(), this.original()),
  );

  constructor() {
    effect(() => {
      this.wallTime.setValue(
        this.initialText() ??
          formatDateTimeInput(this.original(), this.timeZone(), this.dateFormat()),
      );
    });
  }
}

const meta: Meta<DateEditorDemo> = {
  title: 'Design System/Patterns/Dates',
  component: DateEditorDemo,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<DateEditorDemo>;

export const NumericFormats: Story = {
  render: (_args, context) => {
    const language = storyLanguage(context.globals);
    const text = messages[language];
    return {
      props: {
        text,
        rows: supportedDateFormats.map((format) => ({
          format: dateFormatLabels[format],
          ...formatDateTimeCell(instant, language, 'Europe/Sofia', true, format),
          calendar: formatDateOnly('2026-10-18', language, format),
          range: formatDateRange('2026-10-18', '2026-10-25', language, format),
        })),
      },
      template: `
        <section class="app-card app-stack">
          <h2 class="app-card__title">{{ text.heading }}</h2>
          @for (row of rows; track row.format) {
            <section class="app-form-section">
              <h3>{{ row.format }}</h3>
              <dl class="app-facts">
                <div><dt>{{ text.instant }}</dt><dd [title]="row.title">{{ row.text }}</dd></div>
                <div><dt>{{ text.calendarDate }}</dt><dd>{{ row.calendar }}</dd></div>
                <div class="app-facts--wide"><dt>{{ text.range }}</dt><dd>{{ row.range }}</dd></div>
              </dl>
            </section>
          }
          <p class="app-muted">{{ text.utc }}: {{ rows[0].title }}</p>
        </section>
      `,
    };
  },
};

export const TimeZones: Story = {
  render: (_args, context) => {
    const language = storyLanguage(context.globals);
    const text = messages[language];
    return {
      props: {
        text,
        utc: formatUtcInstant(instant),
        rows: [
          'UTC',
          'Europe/Sofia',
          'America/New_York',
          'Asia/Kathmandu',
          'Australia/Lord_Howe',
        ].map((zone) => ({ zone, ...formatDateTimeCell(instant, language, zone, true) })),
      },
      template: `
        <section class="app-card app-stack">
          <h2 class="app-card__title">{{ text.heading }}</h2>
          <dl class="app-facts">@for (row of rows; track row.zone) {
            <div><dt>{{ row.zone }}</dt><dd [title]="row.title">{{ row.text }}</dd></div>
          }</dl>
          <p class="app-muted">{{ text.utc }}: {{ utc }}</p>
        </section>
      `,
    };
  },
};

export const Editor: Story = { args: { dateFormat: 'DD_MM_YYYY', timeZone: 'Asia/Kathmandu' } };

export const SkippedTime: Story = {
  args: { dateFormat: 'DD_DOT_MM_DOT_YYYY', initialText: '29.03.2026 03:30:45.125' },
};

export const RepeatedTime: Story = {
  args: { dateFormat: 'DD_MM_YYYY', original: '2026-10-25T01:30:45.125Z' },
};
