import { spawn } from 'node:child_process';
import { access, mkdir, writeFile } from 'node:fs/promises';

// Sequential: existing runners own their browser/server and close both in finally.
const runners = [
  ['Manaus local', 'scripts/browser-test.mjs'],
  ['Manaus aerial', 'scripts/manaus-surface-browser.mjs'],
  ['Solar / Sun / landing / D1 / U1', 'scripts/space-hardening-browser.mjs'],
  ['U2 Andromeda', 'scripts/galaxy-runtime-browser.mjs'],
  ['U3 production hypercruise', 'scripts/hypercruise-browser.mjs'],
];
const results = [];
await mkdir('artifacts', { recursive: true });
for (const [name, script] of runners) {
  // Missing U3 must fail visibly: this command cannot claim a partial gate passed.
  await access(script);
  console.log(`Regression: ${name}`);
  const started = Date.now();
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit', env: { ...process.env,
        DR_MANAUS_TEST_PORT: process.env.DR_MANAUS_TEST_PORT ?? '4193',
        DR_MANAUS_SURFACE_PORT: process.env.DR_MANAUS_SURFACE_PORT ?? '4194' },
    });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
  results.push({ name, script, exitCode, durationS: (Date.now() - started) / 1000 });
  await writeFile('artifacts/regression-browser.json', JSON.stringify(results, null, 2));
  if (exitCode !== 0) throw new Error(`${name} failed (${exitCode})`);
}
console.log('All browser regression checkpoints passed.');
