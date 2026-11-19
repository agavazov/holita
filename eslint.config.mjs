import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import nx from '@nx/eslint-plugin';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';

export default tseslint.config(
  {
    ignores: [
      '.tmp/**',
      '.misc/**',
      '.credentials/**',
      'discocan/docs/erm-resources/starlink-online-protocol/authenticated/**',
      '.references/**',
      '.volumes/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-dev/**',
      '**/dist-*/**',
      'apps/erm-server/live/**',
      'apps/erm-server/live-api/**',
      'discocan/apps/erm-server/live/**',
      'discocan/apps/erm-server/live-api/**',
      '**/coverage/**',
      'test-results/**',
      'playwright-report/**',
      'discocan/apps/*/src/generated/**',
      'osnova/apps/*/src/generated/**',
      'holita/apps/*/src/generated/**',
      'holita/packages/*/src/generated/**',
      'osnova/packages/ui/src/app/generated/**',
      '.nx/**',
      '**/.angular/**',
    ],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{ts,mts}'],
    plugins: { '@nx': nx },
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          banTransitiveDependencies: true,
          depConstraints: [
            { sourceTag: 'type:app', notDependOnLibsWithTags: ['type:app'] },
            { sourceTag: 'product:osnova', onlyDependOnLibsWithTags: ['product:osnova'] },
            {
              sourceTag: 'product:discocan',
              onlyDependOnLibsWithTags: ['product:discocan', 'product:osnova'],
            },
            {
              sourceTag: 'product:holita',
              onlyDependOnLibsWithTags: ['product:holita', 'product:osnova'],
            },
          ],
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: [
      'osnova/apps/core/**/*.ts',
      'discocan/apps/{fleet,erm-server,device-server}/**/*.ts',
      'holita/apps/commerce/**/*.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    files: [
      'discocan/apps/admin/**/*.ts',
      'holita/apps/{admin,backoffice,sales,storefront}/**/*.ts',
      'holita/packages/operator/**/*.ts',
      'osnova/packages/ui/**/*.ts',
    ],
    languageOptions: { globals: globals.browser },
    extends: [angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    files: [
      'discocan/apps/admin/**/*.html',
      'holita/apps/{admin,backoffice,sales,storefront}/**/*.html',
      'holita/packages/operator/**/*.html',
      'osnova/packages/ui/**/*.html',
    ],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
  eslintConfigPrettier,
  {
    rules: {
      curly: ['error', 'all'],
    },
  },
);
