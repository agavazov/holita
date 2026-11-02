import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { componentWrapperDecorator, type Meta, type StoryObj } from '@storybook/angular-vite';
import {
  configurationPageFixture,
  configurationStoryStates,
} from '../../../../storybook/device-configuration-fixtures';
import type { WithTypename } from '../../../../storybook/graphql-fixtures';
import { fixtureKarmaCar } from '../../../../storybook/karma-fixtures';
import { defaultBranchId, fixtureTenant } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import type { DeviceConfigurationOperation } from '../../fleet/device-operations/device-configuration-types';
import { DeviceManagementView } from './device-management-view';
import { RuleDraftStore } from './rule-drafts';

/** Saved evidence uses the production view; this wrapper has no send or save implementation. */
@Component({
  selector: 'holita-settings-snapshot',
  imports: [DeviceManagementView],
  providers: [RuleDraftStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-stack" style="padding: var(--p-app-gutter)">
      <p style="color: var(--p-app-canvas-muted-color)">
        {{
          language() === 'bg'
            ? 'Запазен пример. Командите към устройството са изключени.'
            : 'Fixed example snapshot. Device actions are disconnected.'
        }}
      </p>
      <holita-device-management-view
        [language]="language()"
        [car]="car"
        state="ready"
        [branchId]="branchId"
        [enabled]="data().fleetDeviceOperationsEnabled"
        [writesEnabled]="data().fleetDeviceConfigurationWritesEnabled"
        [presets]="data().fleetDeviceParameterPresets"
        [operations]="data().fleetDeviceOperations"
        [lastSnapshot]="data().fleetDeviceConfigurationSnapshot"
        [lastRulesSnapshot]="data().fleetDeviceRulesSnapshot"
      />
    </div>
  `,
})
class ConfigurationSnapshot {
  readonly scenario = input<string>(configurationStoryStates.confirmed);
  protected readonly language = inject(UI_LANGUAGE);
  protected readonly car = fixtureKarmaCar;
  protected readonly branchId = defaultBranchId;
  protected readonly data = computed(() => {
    const data = configurationPageFixture(this.scenario());
    const operation = (
      value: WithTypename<DeviceConfigurationOperation>,
    ): DeviceConfigurationOperation => ({
      ...value,
      queueIds: [...value.queueIds],
      rulesConfiguration: value.rulesConfiguration
        ? {
            ...value.rulesConfiguration,
            rules: value.rulesConfiguration.rules.map((rule) => ({
              ...rule,
              parameterIds: [...rule.parameterIds],
            })),
          }
        : null,
      configuration: value.configuration
        ? { ...value.configuration, parameters: [...value.configuration.parameters] }
        : null,
    });
    const operations = data.fleetDeviceOperations.map(operation);
    const snapshot = data.fleetDeviceConfigurationSnapshot
      ? operation(data.fleetDeviceConfigurationSnapshot)
      : null;
    return {
      ...data,
      fleetDeviceParameterPresets: data.fleetDeviceParameterPresets.map((preset) => ({
        ...preset,
        profileIds: [...preset.profileIds],
      })),
      fleetDeviceOperations: operations,
      fleetDeviceRulesSnapshot: data.fleetDeviceRulesSnapshot
        ? operation(data.fleetDeviceRulesSnapshot)
        : null,
      fleetDeviceConfigurationSnapshot: snapshot,
    };
  });

  constructor() {
    inject(RuleDraftStore).initialize(fixtureTenant.id, fixtureKarmaCar.id);
  }
}

/** The main review runs the real routes and editors against fixed GraphQL responses. */
const meta: Meta<StoryApp> = {
  title: 'Admin/Karma Client/Trucks/Truck/Device settings',
  component: StoryApp,
  tags: ['!autodocs'],
  decorators: [
    componentWrapperDecorator(
      (story) => `
        <p role="note" style="margin: 0; padding: var(--p-app-gutter); background: var(--p-app-frame-background); color: var(--p-text-muted-color)">
          {{ language === 'bg' ? 'Storybook: примерни данни. Не се изпращат команди към устройства.' : 'Storybook: example data. No commands are sent to devices.' }}
        </p>
        ${story}
      `,
    ),
  ],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};
export default meta;
type Story = StoryObj<StoryApp>;

const configured = 'karma-client/cars/41/configuration';

function snapshot(scenario: string): NonNullable<Story['render']> {
  return () => ({
    moduleMetadata: { imports: [ConfigurationSnapshot] },
    props: { scenario },
    template: '<holita-settings-snapshot [scenario]="scenario" />',
  });
}

export const Default: Story = { render: routeAt(configured) };
export const FleetUnavailable: Story = {
  render: routeAt(configured),
  parameters: { holita: { signedIn: true, fleetEnabled: false } satisfies StoryFixtures },
};
export const WaitingForDevice: Story = { render: snapshot(configurationStoryStates.waiting) };
export const EmptyConfiguration: Story = {
  render: snapshot(configurationStoryStates.emptyConfiguration),
};
export const ChangeUncertain: Story = {
  render: snapshot(configurationStoryStates.writeUncertain),
};
export const Loading: Story = {
  render: routeAt(configured),
  parameters: {
    holita: {
      signedIn: true,
      scenario: { failures: { AdminDeviceConfigurationPage: 'pending' } },
    } satisfies StoryFixtures,
  },
};
export const ErrorState: Story = {
  render: routeAt(configured),
  parameters: {
    holita: {
      signedIn: true,
      scenario: { failures: { AdminDeviceConfigurationPage: 'network' } },
    } satisfies StoryFixtures,
  },
};
export const Mobile: Story = {
  render: routeAt(configured),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
