import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { componentWrapperDecorator, type Meta, type StoryObj } from '@storybook/angular-vite';
import {
  configurationPageFixture,
  configurationStoryStates,
} from '../../../../storybook/device-configuration-fixtures';
import type { WithTypename } from '../../../../storybook/graphql-fixtures';
import { fixtureKarmaCar } from '../../../../storybook/karma-fixtures';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import { UI_LANGUAGE } from '../../../ui/ui-language';
import type { DeviceConfigurationOperation } from '../../fleet/device-operations/device-configuration-types';
import { DeviceManagementView } from './device-management-view';
import { RuleDraftStore, type RuleDraft } from './rule-drafts';
import { KarmaCarHeader } from '../car-header/karma-car-header';
import { DeviceRuleReview } from '../../fleet/device-operations/device-rule-review';
import en from './i18n/en.json';
import bg from './i18n/bg.json';

/** Saved evidence uses the production view; this wrapper has no send or save implementation. */
@Component({
  selector: 'holita-settings-snapshot',
  imports: [DeviceManagementView, KarmaCarHeader, DeviceRuleReview],
  providers: [RuleDraftStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="app-view"
      style="padding: var(--p-app-gutter); background: var(--p-app-frame-background)"
    >
      <holita-karma-car-header
        [language]="language()"
        [carId]="car.id"
        [carNumber]="car.carNumber"
        [title]="text().deviceSettings"
      />
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
        [readSequence]="scenario() === states.reading ? 'parameters' : null"
      />
      @if (review()) {
        <holita-device-rule-review
          [draft]="reviewDraft"
          [branchId]="branchId"
          [target]="car"
          [rulesBaseline]="data().fleetDeviceRulesSnapshot"
          [parameterBaseline]="data().fleetDeviceConfigurationSnapshot"
          [unavailable]="false"
          [expressionLabel]="'ABS/EBS Amber Warning Signal ' + text().greaterThan + ' 20'"
          [previousExpressionLabel]="'ABS/EBS Amber Warning Signal ' + text().greaterThan + ' 10'"
        />
      }
    </div>
  `,
})
class ConfigurationSnapshot {
  readonly scenario = input<string>(configurationStoryStates.confirmed);
  readonly review = input(false);
  protected readonly states = configurationStoryStates;
  protected readonly text = computed(() => (this.language() === 'bg' ? bg : en));
  protected readonly reviewDraft: RuleDraft = {
    id: 'story-review',
    ruleId: 1,
    name: 'Rule 1',
    expression: '[718] > 20',
    trueEvent: 1001,
    falseEvent: 1002,
    debounce: 1000,
  };
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
}

/** The production settings view and editors with fixed evidence and disconnected outputs. */
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

function snapshot(scenario: string, review = false): NonNullable<Story['render']> {
  return () => ({
    moduleMetadata: { imports: [ConfigurationSnapshot] },
    props: { scenario, review },
    template: '<holita-settings-snapshot [scenario]="scenario" [review]="review" />',
  });
}

export const Default: Story = { render: snapshot(configurationStoryStates.confirmed) };
export const Reading: Story = { render: snapshot(configurationStoryStates.reading) };
export const Empty: Story = { render: snapshot(configurationStoryStates.emptyConfiguration) };
export const DispatchOff: Story = { render: snapshot(configurationStoryStates.dispatchOff) };
export const ReviewBeforeSend: Story = {
  render: snapshot(configurationStoryStates.confirmed, true),
};
export const Waiting: Story = { render: snapshot(configurationStoryStates.waiting) };
export const Failed: Story = { render: snapshot(configurationStoryStates.failed) };
export const UncertainOutcome: Story = {
  render: snapshot(configurationStoryStates.writeUncertain),
};
