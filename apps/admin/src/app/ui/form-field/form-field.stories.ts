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
        <holita-form-field label="Fleet number" controlId="hint" hint="Internal fleet number, e.g. T-04">
          <input pInputText id="hint" value="T-04" aria-describedby="hint-hint hint-error" />
        </holita-form-field>
        <holita-form-field label="License plate" controlId="required" [required]="true">
          <input pInputText id="required" value="CB 1004 AX" aria-describedby="required-hint required-error" />
        </holita-form-field>
        <holita-form-field class="app-form-grid--wide" label="VIN" controlId="error" hint="17 characters, no I, O or Q" error="This VIN is already used in this branch.">
          <input pInputText id="error" class="app-mono" value="WMA06XZZ1MP123456" aria-invalid="true" aria-describedby="error-hint error-error" [invalid]="true" />
        </holita-form-field>
        <holita-form-field class="app-form-grid--wide" label="Notes" controlId="counter" [counter]="{ length: 1840, max: 2000 }">
          <textarea pTextarea id="counter" rows="3" aria-describedby="counter-hint counter-error">Tyre change and annual roadworthiness inspection are due.</textarea>
        </holita-form-field>
      </div>
    `,
  }),
};
