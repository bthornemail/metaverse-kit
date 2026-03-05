import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import {
  initialWave28PanelState,
  ingestWave28PanelArtifact,
} from './panel-model';

async function main() {
  const root = path.resolve(process.cwd(), 'dev-docs/wave28');
  const projection = JSON.parse(await fs.readFile(path.join(root, 'ui-projection.good.json'), 'utf8'));
  const decomp = JSON.parse(await fs.readFile(path.join(root, 'ui-decomp.good.json'), 'utf8'));
  const badProjection = JSON.parse(await fs.readFile(path.join(root, 'ui-projection.bad-authority.json'), 'utf8'));
  const residual = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'dev-docs/wave27/pointer-sync.residual.fail.v0.json'), 'utf8'));

  let state = initialWave28PanelState();

  state = await ingestWave28PanelArtifact(state, projection, 'ui-projection.good.json');
  assert.equal(state.activeTab, 'signal');
  assert.equal(state.projection?.v, 'wave28.signal_poly_projection.v0');

  state = await ingestWave28PanelArtifact(state, decomp, 'ui-decomp.good.json');
  assert.equal(state.activeTab, 'decompose');
  assert.equal(state.decomp?.v, 'wave28.poly_decomp.v0');
  assert.equal(state.projection?.poly_decomp_digest, state.decomp?.digest);

  state = await ingestWave28PanelArtifact(state, residual, 'pointer-sync.residual.fail.v0.json');
  assert.equal(state.activeTab, 'residual');
  assert.equal(state.residual?.v, 'wave27.pointer_sync_residual.v0');

  await assert.rejects(
    () => ingestWave28PanelArtifact(state, badProjection, 'ui-projection.bad-authority.json'),
    /authority must be advisory/
  );

  await assert.rejects(
    () => ingestWave28PanelArtifact(state, { v: 'wave17.conflict_bundle.v0' }, 'wrong-artifact.json'),
    /unsupported artifact version/
  );

  console.log('ok client wave28 panel interaction smoke');
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(2);
});
