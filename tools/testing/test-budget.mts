import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The whole repository keeps at most this many test cases (AGENTS.md, delivery policy).
// Raising it requires the owner's explicit approval.
const budget = 60;

const root = fileURLToPath(new URL('../../', import.meta.url));
const casePattern = /^\s*(?:it|test)(?:\.(?:only|skip|fixme|fail|concurrent))?\s*\(/gm;
const eachPattern = /\b(?:it|test|describe)(?:\.\w+)*\.each\b/;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => /\.(?:spec|test)\.m?ts$/.test(file) && !/^\.(?:tmp|misc)\//.test(file))
  .filter((file) => existsSync(resolve(root, file)));

const counts = files.map((file) => {
  const source = readFileSync(resolve(root, file), 'utf8');
  return { file, cases: source.match(casePattern)?.length ?? 0, each: eachPattern.test(source) };
});
const total = counts.reduce((sum, { cases }) => sum + cases, 0);

for (const { file, cases } of counts) {
  if (cases > 0) {
    console.log(`${String(cases).padStart(3)}  ${file}`);
  }
}
console.log(`${String(total)} of ${String(budget)} test cases`);

const generated = counts.filter(({ each }) => each).map(({ file }) => file);
if (generated.length > 0) {
  console.error(
    `Table-generated tests are not allowed; use one case with an internal table: ${generated.join(', ')}`,
  );
  process.exitCode = 1;
}
if (total > budget) {
  console.error(
    `The test budget is ${String(budget)} cases. Raising it requires the owner's explicit approval.`,
  );
  process.exitCode = 1;
}
