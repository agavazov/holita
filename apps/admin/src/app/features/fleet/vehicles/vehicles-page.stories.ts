import type { Meta, StoryObj } from '@storybook/angular-vite';
import { HttpBackend } from '@angular/common/http';
import type { Type } from '@angular/core';
import { defaultBranchId } from '../../../../storybook/session-fixtures';
import { routeAt, StoryApp, type StoryFixtures } from '../../../../storybook/story-config';
import {
  fixtureVehicle,
  DelayedVehiclesLiveBackend,
  EmptyVehiclesBackend,
} from '../../../../storybook/vehicles-fixtures';
import type { FixtureHttpBackend } from '../../../../storybook/graphql-fixtures';
import { AdminWorkspace } from '../../../workspace/admin-workspace';
import { FleetWorkspace } from '../fleet-workspace';
import { VehicleEditorPage } from './vehicle-editor-page';
import { VehicleProfilePage } from './vehicle-profile-page';

/** Real routes, page adapters, scoped Apollo clients and the shared Storybook presentation. */
const meta: Meta = {
  title: 'Admin/Fleet/Vehicles',
  tags: ['!autodocs'],
  parameters: { holita: { signedIn: true } satisfies StoryFixtures },
};

export default meta;
type Story = StoryObj;
const path = `${defaultBranchId}/fleet/vehicles`;

function routed(suffix = '', backend?: Type<FixtureHttpBackend>): NonNullable<Story['render']> {
  const render = routeAt(path + suffix);
  return () => ({
    ...render(),
    applicationConfig: { providers: backend ? [{ provide: HttpBackend, useClass: backend }] : [] },
    moduleMetadata: {
      imports: [StoryApp, AdminWorkspace, FleetWorkspace, VehicleEditorPage, VehicleProfilePage],
    },
    template: '<holita-story-app [url]="url" />',
  });
}

export const Default: Story = {
  render: routed(),
};

export const DelayedLiveData: Story = {
  name: 'Delayed live data',
  render: routed('', DelayedVehiclesLiveBackend),
};

export const Empty: Story = {
  render: routed('', EmptyVehiclesBackend),
};

export const Narrow: Story = {
  render: routed(),
  globals: { viewport: { value: 'mobile375', isRotated: false } },
};

export const Edit: Story = {
  render: routed(`/${fixtureVehicle.id}/edit?keep=storybook#vehicles`),
};

export const ErrorState: Story = {
  name: 'Error',
  render: routed(),
  parameters: {
    holita: { scenario: { failures: { AdminVehicles: 'network' } } } satisfies StoryFixtures,
  },
};
