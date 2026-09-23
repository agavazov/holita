import preset from '../../jest.preset.mjs';

export default { ...preset, rootDir: import.meta.dirname, displayName: 'gateway' };
