import {
  applicationConfig,
  componentWrapperDecorator,
  moduleMetadata,
  type Decorator,
  type Preview,
} from '@storybook/angular-vite';
import { brands } from '../src/app/theme/brands';
import { densities } from '../src/app/theme/densities';
import { appTheme } from '../src/app/theme/theme-choice';
import {
  STORY_GLOBALS,
  applyStoryGlobals,
  loadStoryLicense,
  prepareStory,
  readStoryFixtures,
  storyThemeChoice,
  storybookApplicationConfig,
} from '../src/storybook/story-config';
import { storyToastImports, storyToastTemplate } from '../src/storybook/toast';

/** The local PrimeUI key is read once per Storybook page. */
let license: Promise<string | undefined> | undefined;

/**
 * Builds the application providers from the toolbar globals. Changing a global changes the module
 * metadata key, so the renderer bootstraps the story again with the new brand, density and theme
 * instead of patching a running application.
 */
const holitaApplication: Decorator = (story, context) => {
  applyStoryGlobals(context.globals);
  const choice = storyThemeChoice(context.globals);
  const fixtures = readStoryFixtures(context.parameters['holita']);
  const primeUiLicense: unknown = context.loaded['primeUiLicense'];
  const result = applicationConfig(
    storybookApplicationConfig(choice, {
      fleetEnabled: fixtures.fleetEnabled ?? true,
      ...(typeof primeUiLicense === 'string' ? { primeUiLicense } : {}),
    }),
  )(story, context);
  const key = [choice.brand, choice.density, context.globals['theme']].map(String).join('/');
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
  decorators: [
    holitaApplication,
    moduleMetadata({ imports: storyToastImports }),
    componentWrapperDecorator((story) => `${storyToastTemplate}${story}`),
  ],
  loaders: [async () => ({ primeUiLicense: await (license ??= loadStoryLicense()) })],
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
    brand: appTheme.brand,
    density: appTheme.density,
  },
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: {
        order: [
          'Start here',
          'Admin',
          ['Fleet', ['Vehicles']],
          'Design System',
          ['Foundations', 'Patterns', 'Shell', 'PrimeNG coverage'],
        ],
      },
    },
    viewport: {
      options: {
        desktop1440: {
          name: 'Desktop 1440',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
        desktop1024: {
          name: 'Desktop 1024',
          styles: { width: '1024px', height: '768px' },
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
    // The Accessibility panel skips the PrimeUI license banner, which is not ours.
    a11y: { context: { exclude: ['#p-license-host'] } },
  },
  beforeEach: ({ globals, parameters }) => {
    prepareStory(parameters['holita'], globals);
  },
};

export default preview;
