import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular-vite';
import { InputText } from 'primeng/inputtext';
import { Textarea } from 'primeng/textarea';
import { onFrame } from '../../../storybook/story-config';
import { FormField } from './form-field';

const meta: Meta<FormField> = {
  title: 'Design System/Patterns/FormField',
  component: FormField,
  decorators: [moduleMetadata({ imports: [InputText, Textarea] }), onFrame],
  tags: ['!autodocs'],
};

export default meta;
type Story = StoryObj<FormField>;

export const Variants: Story = {
  render: () => ({
    template: `
      <div class="app-form-grid" style="max-inline-size: 35rem">
        <holita-form-field label="Пореден номер" controlId="hint" hint="Вътрешен номер в автопарка, напр. Т-04">
          <input pInputText id="hint" value="Т-04" aria-describedby="hint-hint hint-error" />
        </holita-form-field>
        <holita-form-field label="Регистрационен номер" controlId="required" [required]="true">
          <input pInputText id="required" value="CB 1004 AX" aria-describedby="required-hint required-error" />
        </holita-form-field>
        <holita-form-field class="app-form-grid--wide" label="VIN" controlId="error" hint="17 знака, без I, O и Q" error="Този VIN вече се използва в клона.">
          <input pInputText id="error" class="app-mono" value="WMA06XZZ1MP123456" aria-invalid="true" aria-describedby="error-hint error-error" [invalid]="true" />
        </holita-form-field>
        <holita-form-field class="app-form-grid--wide" label="Бележки" controlId="counter" [counter]="{ length: 1840, max: 2000 }">
          <textarea pTextarea id="counter" rows="3" aria-describedby="counter-hint counter-error">Предстои смяна на гуми и годишен технически преглед.</textarea>
        </holita-form-field>
      </div>
    `,
  }),
};
