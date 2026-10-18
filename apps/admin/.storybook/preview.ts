import { applicationConfig, type Decorator, type Preview } from '@storybook/angular-vite';
import { brands } from '../src/app/theme/brands';
import { densities } from '../src/app/theme/densities';
import { appTheme } from '../src/app/theme/theme-choice';
import {
  STORY_GLOBALS,
  applyStoryGlobals,
  prepareStory,
  readStoryFixtures,
  storyThemeChoice,
  storybookApplicationConfig,
} from '../src/storybook/story-config';

/**
 * Builds the application providers from the toolbar globals. Changing a global changes the module
 * metadata key, so the renderer bootstraps the story again with the new brand, density, theme
 * and language instead of patching a running application.
 */
const holitaApplication: Decorator = (story, context) => {
  applyStoryGlobals(context.globals);
  const choice = storyThemeChoice(context.globals);
  const fixtures = readStoryFixtures(context.parameters['holita']);
  const result = applicationConfig(
    storybookApplicationConfig(choice, { fleetEnabled: fixtures.fleetEnabled ?? true }),
  )(story, context);
  const key = [choice.brand, choice.density, context.globals['theme'], context.globals['locale']]
    .map(String)
    .join('/');
  return {
    ...result,
    moduleMetadata: {
      ...result.moduleMetadata,
      providers: [
        ...(result.moduleMetadata?.providers ?? []),
        { provide: STORY_GLOBALS, useValue: key },
      ],
    },
  };
};

const preview: Preview = {
  decorators: [holitaApplication],
  globalTypes: {
    theme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Interface language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'bg', title: 'Български' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
    brand: {
      description: 'Brand variant (the application uses appTheme)',
      toolbar: {
        title: 'Brand',
        icon: 'paintbrush',
        items: Object.values(brands).map((brand) => ({ value: brand.name, title: brand.title })),
        dynamicTitle: true,
      },
    },
    density: {
      description: 'Density (the application uses appTheme)',
      toolbar: {
        title: 'Density',
        icon: 'component',
        items: Object.values(densities).map((density) => ({
          value: density.name,
          title: density.title,
        })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
    locale: 'bg',
    brand: appTheme.brand,
    density: appTheme.density,
  },
  parameters: {
    layout: 'fullscreen',
    viewport: {
      options: {
        desktop1440: {
          name: 'Desktop 1440',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
        tablet768: {
          name: 'Tablet 768',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet',
        },
        mobile375: {
          name: 'Mobile 375',
          styles: { width: '375px', height: '812px' },
          type: 'mobile',
        },
      },
    },
    // Accessibility violations fail story tests; the PrimeUI license banner is not ours.
    a11y: { test: 'error', context: { exclude: ['#p-license-host'] } },
  },
  beforeEach: ({ globals, parameters }) => {
    prepareStory(parameters['holita'], globals);
  },
};

export default preview;
