import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Validate the built artifact, never the source tree. Both Pages and Capacitor
// consume this directory, so missing runtime assets must fail the same build.
export async function verifyWeb(directory = 'www') {
  const root = resolve(directory);
  const base = new URL('https://build.invalid/');
  const visited = new Set();
  const fonts = new Set();

  async function check(reference, parent = base) {
    if (reference.startsWith('#')) return;
    const url = new URL(reference, parent);
    if (url.origin !== base.origin) return;
    const pathname = decodeURIComponent(url.pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(`${root}${sep}`)) throw new Error(`Asset escapes build directory: ${reference}`);
    if (visited.has(file)) return;
    visited.add(file);
    const info = await stat(file).catch(() => null);
    if (!info?.isFile() || info.size === 0) throw new Error(`Missing or empty asset: ${pathname}`);

    if (/\.(?:woff2?|ttf|otf)$/.test(pathname)) fonts.add(pathname);
    if (pathname.endsWith('.css')) {
      const css = await readFile(file, 'utf8');
      if (/@tailwind\b/.test(css)) throw new Error(`Uncompiled Tailwind CSS: ${pathname}`);
      for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) {
        await check(match[1], url);
      }
    }
  }

  await check('index.html');
  const html = await readFile(resolve(root, 'index.html'), 'utf8');
  for (const tag of html.matchAll(/<(?:link|script|img|source)\b[^>]*>/gi)) {
    for (const attribute of tag[0].matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      await check(attribute[1]);
    }
  }

  // These are essential even if an accidental HTML edit removes their links.
  for (const asset of ['css/tailwind.css', 'fonts/roboto-flex.css', 'js/icons.js', 'manifest.json', 'service-worker.js']) {
    await check(asset);
  }
  for (const asset of ['index.html', 'js/app.js', 'js/pwa.js', 'service-worker.js']) {
    const source = await readFile(resolve(root, asset), 'utf8');
    if (/material-symbols(?:-outlined|\.css|.*\.woff2)/.test(source)) {
      throw new Error(`Icon font dependency reintroduced in ${asset}; use inline SVG icons`);
    }
  }
  const css = await readFile(resolve(root, 'css/tailwind.css'), 'utf8');
  if (!/\.hidden\s*\{\s*display\s*:\s*none\s*;?\s*\}/.test(css)) {
    throw new Error('Tailwind is missing the hidden utility required for training states and dialogs');
  }

  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  for (const asset of [...(manifest.icons || []), ...(manifest.screenshots || [])]) {
    await check(asset.src);
  }
  if (manifest.start_url) await check(manifest.start_url);

  const worker = await readFile(resolve(root, 'service-worker.js'), 'utf8');
  const precache = worker.match(/const urlsToCache\s*=\s*\[([\s\S]*?)\];/);
  if (!precache) throw new Error('Service worker precache list is missing');
  const cachedPaths = new Set();
  for (const entry of precache[1].matchAll(/['"]([^'"]+)['"]/g)) {
    await check(entry[1]);
    cachedPaths.add(new URL(entry[1], base).pathname);
  }
  for (const font of fonts) {
    if (!cachedPaths.has(font)) throw new Error(`Font missing from offline precache: ${font}`);
  }
  return { assets: visited.size, fonts: fonts.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyWeb(process.argv[2]);
  console.log(`Verified ${result.assets} local assets, including ${result.fonts} offline fonts.`);
}
