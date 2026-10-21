import { afterNextRender, Component, viewChild } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular-vite';
import { expect, waitFor, within } from 'storybook/test';
import { fixtureConfigurationOperation } from '../../../../storybook/device-configuration-fixtures';
import { fixtureDevice } from '../../../../storybook/devices-fixtures';
import { fixtureKarmaCars } from '../../../../storybook/karma-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { onFrame } from '../../../../storybook/story-config';
import {
  DeviceConfigurationView,
  type DeviceConfigurationOperation,
} from './device-configuration-view';

/** Present the captured target while the result of its submitted request is being reconciled. */
@Component({
  imports: [DeviceConfigurationView],
  template: `
    <holita-device-configuration-view
      state="ready"
      [device]="device"
      [enabled]="true"
      [writesEnabled]="true"
      targetsState="ready"
      [targets]="targets"
      [operations]="[snapshot]"
      [lastSnapshot]="snapshot"
      [backLink]="backLink"
      [reconciling]="true"
    />
  `,
})
class ReconciliationScenario {
  protected readonly device = fixtureDevice;
  protected readonly snapshot: DeviceConfigurationOperation = {
    ...fixtureConfigurationOperation,
    queueIds: [...fixtureConfigurationOperation.queueIds],
    configuration: fixtureConfigurationOperation.configuration
      ? {
          ...fixtureConfigurationOperation.configuration,
          parameters: [...fixtureConfigurationOperation.configuration.parameters],
        }
      : null,
  };
  protected readonly targets = fixtureKarmaCars;
  protected readonly backLink = ['/', 'en', defaultBranchId, 'fleet', 'devices'];
  private readonly view = viewChild.required(DeviceConfigurationView);
  constructor() {
    afterNextRender(() => {
      this.view().form.controls.carId.setValue(this.snapshot.karmaCarId);
    });
  }
}

const meta: Meta<ReconciliationScenario> = {
  title: 'Admin/Fleet/Device configuration states',
  component: ReconciliationScenario,
  decorators: [onFrame],
  tags: ['!autodocs'],
};
export default meta;
type Story = StoryObj<ReconciliationScenario>;

export const ReconciliationNeeded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () =>
        expect(
          canvas.getByText(
            'Checking whether the request was saved. Refresh saved results before submitting again.',
          ),
        ).toBeVisible(),
      { timeout: 10000 },
    );
    await expect(
      canvas.getByRole('button', { name: 'Read selected device settings' }),
    ).toBeDisabled();
    await expect(
      await canvas.findByRole('button', { name: 'Save background change' }),
    ).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Refresh saved results' })).toBeEnabled();
  },
};
