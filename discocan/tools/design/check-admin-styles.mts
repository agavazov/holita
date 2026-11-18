import { readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const app = 'discocan/apps/admin/src/app';
const exceptions = [
  {
    file: `${app}/ui/location-map/location-map.scss`,
    property: 'font-size',
    value: '2rem',
    reason: 'Map marker icon',
  },
  {
    file: `${app}/features/auth/login.scss`,
    property: 'font-size',
    value: 'clamp(2rem, 4vw, 3.5rem)',
    reason: 'Responsive sign-in heading',
  },
  {
    file: `${app}/features/control-center/device-console.ts`,
    property: 'font-family',
    value: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    reason: 'Device console output',
  },
  {
    file: `${app}/features/fleet/live-dashboard/live-truck-list.scss`,
    property: 'box-shadow',
    value: '0 0 0 3px color-mix(in srgb, var(--p-app-tone-success-solid) 30%, transparent)',
    reason: 'Live marker ring',
  },
  {
    file: `${app}/features/fleet/live-dashboard/live-truck-map.scss`,
    property: 'border-radius',
    value: '1rem',
    reason: 'Map overlay shape',
  },
  {
    file: `${app}/features/fleet/live-dashboard/live-truck-map.scss`,
    property: 'border-radius',
    value: '2rem',
    reason: 'Map overlay pill',
  },
  {
    file: `${app}/ui/table-panel/table-panel.scss`,
    property: 'margin-block-start',
    value: '-1px',
    reason: 'Align refresh bar with border',
  },
];
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
let failures = 0;
function fail(file: string, source: string, offset: number, message: string): void {
  const line = source.slice(0, offset).split('\n').length;
  console.error(`${file}:${String(line)}: ${message}`);
  failures++;
}
const all = files(app);
for (const file of all) {
  if (
    file.includes('/theme/') ||
    !['.scss', '.html', '.ts'].includes(extname(file)) ||
    file.endsWith('.spec.ts')
  ) {
    continue;
  }
  const source = readFileSync(file, 'utf8');
  const blocks: { text: string; offset: number }[] = [];
  if (file.endsWith('.scss')) {
    blocks.push({ text: source, offset: 0 });
  } else {
    const pattern = file.endsWith('.ts')
      ? /styles\s*:\s*([`'"])([\s\S]*?)\1/g
      : /\sstyle="([^"]*)"/g;
    for (const match of source.matchAll(pattern)) {
      const value = (file.endsWith('.ts') ? match[2] : match[1]) ?? '';
      blocks.push({ text: value, offset: match.index + match[0].indexOf(value) });
    }
  }
  for (const block of blocks) {
    for (const match of block.text.matchAll(
      /\.app-dark\b|--(?:surface-[\w-]+|text-color[\w-]*)|#[\da-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/g,
    )) {
      fail(file, source, block.offset + match.index, `forbidden style ${match[0]}`);
    }
    const declarations = /(?:^|[;{])\s*([\w-]+)\s*:\s*([^;{}\n]+)/g;
    for (const match of block.text.matchAll(declarations)) {
      const property = match[1] ?? '';
      const value = (match[2] ?? '').trim();
      if (
        /^(?:color|background(?:-color)?|border(?:-[\w-]+)?-color|fill|stroke)$/.test(property) &&
        /\b(?:red|green|blue|black|white|gray|grey|yellow|orange|purple|pink|cyan|magenta)\b/i.test(
          value.replace(/var\([^)]*\)/g, ''),
        )
      ) {
        fail(file, source, block.offset + match.index, `${property}: ${value}`);
      }
      if (
        !/^(?:font-size|font-family|(?:padding|margin)(?:-[\w-]+)?|(?:row-|column-)?gap|border-radius|box-shadow)$/.test(
          property,
        )
      ) {
        continue;
      }
      if (
        exceptions.some(
          (entry) => entry.file === file && entry.property === property && entry.value === value,
        )
      ) {
        continue;
      }
      const vars = [...value.matchAll(/var\((--[\w-]+)/g)].map((item) => item[1] ?? '');
      const remainder = value.replace(/var\(--[\w-]+\)/g, '');
      const lengths = [
        ...remainder.matchAll(
          /(?:^|[^\w.-])(-?(?:\d*\.)?\d+)(px|rem|em|vw|vh|vmin|vmax|pt|ch|ex|%)/g,
        ),
      ];
      const badLength = lengths.some(
        (item) =>
          item[2] !== '%' &&
          !(item[1] === '1' && item[2] === 'px') &&
          !(property === 'border-radius' && item[1] === '999' && item[2] === 'px') &&
          Number(item[1]) !== 0,
      );
      const spacing = /^(?:padding|margin|(?:row-|column-)?gap)/.test(property);
      const badToken = spacing && vars.some((name) => !name.startsWith('--p-app-'));
      const badFont =
        property === 'font-family' &&
        vars.length === 0 &&
        !/^(inherit|initial|unset|revert|revert-layer)$/.test(value);
      if (badLength || badToken || badFont) {
        fail(file, source, block.offset + match.index, `${property}: ${value}`);
      }
    }
  }
}
if (failures) {
  process.exitCode = 1;
} else {
  console.log('Admin styles pass.');
}
