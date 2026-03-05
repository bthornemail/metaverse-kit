import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import {
  validateWave27Residual,
  validateWave28SignalPolyProjection,
  validateWave28PolyDecomp,
} from './validators';

async function main() {
  const root = path.resolve(process.cwd(), 'dev-docs/wave28');
  const projection = JSON.parse(await fs.readFile(path.join(root, 'signal-poly-projection.v0.json'), 'utf8'));
  const decomp = JSON.parse(await fs.readFile(path.join(root, 'poly-decomp.v0.json'), 'utf8'));
  const residual = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'dev-docs/wave27/pointer-sync.residual.fail.v0.json'), 'utf8'));

  const okProjection = await validateWave28SignalPolyProjection(projection);
  assert.equal(okProjection.ok, true, okProjection.ok ? '' : okProjection.error);

  const okDecomp = await validateWave28PolyDecomp(decomp);
  assert.equal(okDecomp.ok, true, okDecomp.ok ? '' : okDecomp.error);

  const badAuthority = { ...projection, authority: 'authoritative' };
  const bad = await validateWave28SignalPolyProjection(badAuthority);
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.match(bad.error, /authority must be advisory/);
  }

  const unknownKey = { ...projection, extra_key: 'x' };
  const badKeyset = await validateWave28SignalPolyProjection(unknownKey);
  assert.equal(badKeyset.ok, false);
  if (!badKeyset.ok) {
    assert.match(badKeyset.error, /keyset mismatch/);
  }

  const badVersion = { ...projection, v: 'wave28.signal_poly_projection.vX' };
  const badV = await validateWave28SignalPolyProjection(badVersion);
  assert.equal(badV.ok, false);
  if (!badV.ok) {
    assert.match(badV.error, /version mismatch/);
  }

  const badDigest = { ...projection, digest: `sha256:${'0'.repeat(64)}` };
  const badD = await validateWave28SignalPolyProjection(badDigest);
  assert.equal(badD.ok, false);
  if (!badD.ok) {
    assert.match(badD.error, /digest mismatch/);
  }

  const residualTypeMismatch = { ...residual, turn_project_id: 'wave27.turn_project.unknown.v0' };
  const badResidual = await validateWave27Residual(residualTypeMismatch);
  assert.equal(badResidual.ok, false);
  if (!badResidual.ok) {
    assert.match(badResidual.error, /turn_project_id mismatch/);
  }

  console.log('ok client wave28 validator test');
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(2);
});
