// Packages application source for a Veracode static scan: source + manifests only, no tests or mocks.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

mkdirSync('reports', { recursive: true });
rmSync('reports/veracode-upload.zip', { force: true });
execFileSync(
  'zip',
  ['-r', '-q', 'reports/veracode-upload.zip', 'src', 'package.json', 'pnpm-lock.yaml', '-x', 'src/mocks/*', 'src/test/*', '*/__tests__/*'],
  { stdio: 'inherit' },
);
console.log('Wrote reports/veracode-upload.zip');
