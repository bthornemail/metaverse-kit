import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Wave28Panel from '../components/Wave28Panel';

function mustContain(haystack: string, needle: string) {
  assert.equal(haystack.includes(needle), true, `missing expected text: ${needle}`);
}

async function main() {
  const html = renderToStaticMarkup(
    React.createElement(Wave28Panel, {
      projectionPathHint: 'dev-docs/wave28/signal-poly-projection.v0.json',
    })
  );

  mustContain(html, 'data-testid=\"wave28-panel\"');
  mustContain(html, 'data-testid=\"wave28-load-file\"');
  mustContain(html, 'data-testid=\"wave28-load-url\"');
  mustContain(html, 'data-testid=\"wave28-tab-signal-poly\"');
  mustContain(html, 'data-testid=\"wave28-tab-decomposition\"');
  mustContain(html, 'data-testid=\"wave28-tab-residual\"');

  console.log('ok client wave28 panel render smoke');
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(2);
});
