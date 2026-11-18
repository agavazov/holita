/** @type {import("prettier").Config} */
const config = {
  printWidth: 100,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: 'discocan/apps/admin/src/**/*.html',
      options: { parser: 'angular' },
    },
  ],
};

export default config;
