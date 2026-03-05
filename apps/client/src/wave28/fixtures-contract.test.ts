import fs from 'fs/promises';
import path from 'path';
import {
  validateWave28PolyDecomp,
  validateWave28SignalPolyProjection,
} from './validators';

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  const root = path.resolve(process.cwd(), 'dev-docs/wave28');

  const projectionGood = JSON.parse(await fs.readFile(path.resolve(root, 'ui-projection.good.json'), 'utf8'));
  const decompGood = JSON.parse(await fs.readFile(path.resolve(root, 'ui-decomp.good.json'), 'utf8'));
  const projectionBadAuthority = JSON.parse(await fs.readFile(path.resolve(root, 'ui-projection.bad-authority.json'), 'utf8'));

  const goodProjectionResult = await validateWave28SignalPolyProjection(projectionGood);
  if (!goodProjectionResult.ok) fail(`projection good fixture invalid: ${goodProjectionResult.error}`);

  const goodDecompResult = await validateWave28PolyDecomp(decompGood);
  if (!goodDecompResult.ok) fail(`decomp good fixture invalid: ${goodDecompResult.error}`);

  const badProjectionResult = await validateWave28SignalPolyProjection(projectionBadAuthority);
  if (badProjectionResult.ok) fail('bad-authority fixture unexpectedly validated');
  const msg = badProjectionResult.error.toLowerCase();
  if (!(msg.includes('authority') && msg.includes('advisory'))) {
    fail(`bad-authority fixture rejected with wrong class: ${badProjectionResult.error}`);
  }

  console.log('ok client wave28 fixtures contract');
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(2);
});
