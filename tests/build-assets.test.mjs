import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyWeb } from '../scripts/verify-web.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'krafttraining-assets-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(new URL('../www/', import.meta.url), directory, { recursive: true });
  return directory;
}

test('the built web app includes its local and offline assets', async () => {
  const result = await verifyWeb();
  assert.ok(result.fonts >= 7);
});

test('rejects the uncompiled stylesheet previously published by Pages', async (t) => {
  const directory = await fixture(t);
  await writeFile(join(directory, 'css/tailwind.css'), '@tailwind base;\n@tailwind utilities;');
  await assert.rejects(verifyWeb(directory), /Uncompiled Tailwind/);
});

test('rejects CSS without the hidden state utility', async (t) => {
  const directory = await fixture(t);
  await writeFile(join(directory, 'css/tailwind.css'), 'body { margin: 0; }');
  await assert.rejects(verifyWeb(directory), /missing the hidden utility/);
});

test('rejects missing icon fonts and broken local HTML references', async (t) => {
  const directory = await fixture(t);
  await rm(join(directory, 'fonts/material-symbols-outlined.woff2'));
  await assert.rejects(verifyWeb(directory), /Missing or empty asset: \/fonts\/material-symbols-outlined.woff2/);
  await cp(new URL('../www/fonts/material-symbols-outlined.woff2', import.meta.url), join(directory, 'fonts/material-symbols-outlined.woff2'));
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  await writeFile(join(directory, 'index.html'), html.replace('js/app.js', 'js/missing.js'));
  await assert.rejects(verifyWeb(directory), /Missing or empty asset: \/js\/missing.js/);
});

test('rejects fonts omitted from the offline precache', async (t) => {
  const directory = await fixture(t);
  const path = join(directory, 'service-worker.js');
  const worker = await readFile(path, 'utf8');
  await writeFile(path, worker.replace("  './fonts/files/roboto-flex-latin-wght-normal.woff2',\n", ''));
  await assert.rejects(verifyWeb(directory), /Font missing from offline precache/);
});
