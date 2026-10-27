import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { componentWrapperDecorator, type Meta, type StoryObj } from '@storybook/angular-vite';
import type {
  DeviceConfigurationOperation,
  DeviceParameterMeasurements,
} from '../../fleet/device-operations/device-configuration-types';
import {
  configurationPageFixture,
  configurationMeasurementsFixture,
  configurationStoryStates,
} from '../../../../storybook/device-configuration-fixtures';
import type { WithTypename } from '../../../../storybook/graphql-fixtures';
import { fixtureKarmaCar } from '../../../../storybook/karma-fixtures';
import { defaultBranchId, fixtureTenant } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
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
        Fixed saved snapshot. Device actions are not connected in this story.
      </p>
      <holita-device-management-view
        language="en"
        [car]="car"
        state="ready"
        [branchId]="branchId"
        [enabled]="data().fleetDeviceOperationsEnabled"
        [writesEnabled]="data().fleetDeviceConfigurationWritesEnabled"
        [presets]="data().fleetDeviceParameterPresets"
        [operations]="data().fleetDeviceOperations"
        [lastSnapshot]="data().fleetDeviceConfigurationSnapshot"
        [lastRulesSnapshot]="data().fleetDeviceRulesSnapshot"
        [reconciling]="reconciling()"
        [measurements]="measurements()"
        (requestMeasurements)="measurementOpen.set(true)"
        (closeMeasurements)="measurementOpen.set(false)"
      />
    </div>
  `,
})
class ConfigurationSnapshot {
  readonly scenario = input<string>(configurationStoryStates.confirmed);
  readonly reconciling = input(false);
  readonly measurementState = input<DeviceParameterMeasurements['state'] | 'empty' | null>(null);
  readonly measurementChangeAt = input('2026-10-18T06:43:00.000Z');
  protected readonly measurementOpen = signal(true);
  protected readonly measurements = computed(() => {
    const state = this.measurementState();
    return state && this.measurementOpen() ? configurationMeasurementsFixture(state) : null;
  });
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
    let snapshot = data.fleetDeviceConfigurationSnapshot
      ? operation(data.fleetDeviceConfigurationSnapshot)
      : null;
    if (this.measurementState() && snapshot) {
      const change: DeviceConfigurationOperation = {
        ...snapshot,
        id: '80000000-0000-4000-8000-00000000c108',
        kind: 'UPDATE_INTERVAL',
        phase: 'VERIFY_PARAMETERS',
        parameterId: 718,
        intervalSeconds: 30,
        previousIntervalSeconds: 60,
        completedAt: this.measurementChangeAt(),
      };
      operations.unshift(change);
      snapshot = change;
    }
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
  title: 'Admin/Karma Client/Device settings',
  component: StoryApp,
  tags: ['!autodocs'],
  decorators: [
    componentWrapperDecorator(
      (story) => `
        <p role="note" style="margin: 0; padding: var(--p-app-gutter); background: var(--p-app-frame-background); color: var(--p-text-muted-color)">
          Storybook: примерни данни. Не се изпращат команди към устройства.
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

function snapshot(scenario: string, reconciling = false): NonNullable<Story['render']> {
  return () => ({
    moduleMetadata: { imports: [ConfigurationSnapshot] },
    props: { scenario, reconciling },
    template: '<holita-settings-snapshot [scenario]="scenario" [reconciling]="reconciling" />',
  });
}

export const Review: Story = {
  name: 'Преглед — реален екран с примерни данни',
  args: { url: `/bg/${configured}` },
};
export const English: Story = { render: routeAt(configured) };
export const AnotherTruck: Story = { render: routeAt('karma-client/cars/42/configuration') };
export const FleetUnavailable: Story = {
  render: routeAt(configured),
  parameters: { holita: { signedIn: true, fleetEnabled: false } satisfies StoryFixtures },
};
export const NotRead: Story = { render: snapshot(configurationStoryStates.empty) };
export const WaitingForDevice: Story = { render: snapshot(configurationStoryStates.waiting) };
export const UnknownOutcome: Story = { render: snapshot(configurationStoryStates.unknown) };
export const TimedOut: Story = { render: snapshot(configurationStoryStates.timedOut) };
export const EmptyConfiguration: Story = {
  render: snapshot(configurationStoryStates.emptyConfiguration),
};
export const ReadsDisabled: Story = { render: snapshot(configurationStoryStates.disabled) };
export const WritesDisabled: Story = {
  render: snapshot(configurationStoryStates.writesDisabled),
};
export const ChangeWaiting: Story = { render: snapshot(configurationStoryStates.writeWaiting) };
export const ChangeUncertain: Story = {
  render: snapshot(configurationStoryStates.writeUncertain),
};
export const ChangeFailed: Story = { render: snapshot(configurationStoryStates.writeFailed) };
export const HistoricalSnapshots: Story = { render: snapshot(configurationStoryStates.history) };
function measurements(
  state: DeviceParameterMeasurements['state'] | 'empty',
  changeAt = '2026-10-18T06:43:00.000Z',
): NonNullable<Story['render']> {
  return () => ({
    moduleMetadata: { imports: [ConfigurationSnapshot] },
    props: { measurementState: state, measurementChangeAt: changeAt },
    template:
      '<holita-settings-snapshot [measurementState]="measurementState" [measurementChangeAt]="measurementChangeAt" />',
  });
}

export const Measurements: Story = { render: measurements('ready') };
export const MeasurementsEmpty: Story = { render: measurements('empty') };
export const MeasurementsError: Story = { render: measurements('error') };
export const MeasurementsLoading: Story = { render: measurements('loading') };
export const MeasurementsBeforeChange: Story = {
  render: measurements('ready', '2026-10-18T06:45:00.000Z'),
};
export const ReconciliationNeeded: Story = {
  render: snapshot(configurationStoryStates.confirmed, true),
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
export const TargetError: Story = {
  render: routeAt(configured),
  parameters: {
    holita: {
      signedIn: true,
      scenario: { failures: { AdminKarmaCar: 'network' } },
    } satisfies StoryFixtures,
  },
};
export const Mobile: Story = {
  args: { url: `/bg/${configured}` },
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};
export const Dark: Story = {
  args: { url: `/bg/${configured}` },
  globals: { theme: 'dark' },
};
