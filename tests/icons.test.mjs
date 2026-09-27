import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import '../js/icons.js';

test('static icons contain the same font-independent paths as the renderer', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const icons = [...html.matchAll(/<svg\b[^>]*data-icon="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/g)];
  assert.ok(icons.length > 0);
  for (const [, name, contents] of icons) {
    const path = contents.match(/<path d="([^"]+)"/);
    assert.ok(path, `${name} must have a path before JavaScript runs`);
    assert.ok(AppIcons.render(name).includes(`d="${path[1]}"`), `${name} differs from the shared renderer`);
  }
});

test('all training and update icon states have SVG artwork instead of ligature text', () => {
  for (const name of ['fitness_center', 'local_fire_department', 'done', 'restart_alt', 'celebration', 'visibility', 'visibility_off', 'system_update', 'autorenew']) {
    const markup = AppIcons.render(name, 'text-base');
    assert.match(markup, /^<svg\b/);
    assert.match(markup, /<path d="[ML][^"]+"/);
    assert.match(markup, /aria-hidden="true"/);
    assert.doesNotMatch(markup, new RegExp(`>${name}<`));
    assert.doesNotMatch(markup, /<text|<image|<use|font-family|url\(/);
  }
});
