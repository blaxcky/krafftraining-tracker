import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const output = join(root, 'www');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const indexHtml = await readFile(join(root, 'index.html'), 'utf8');
const appJavaScript = await readFile(join(root, 'js', 'app.js'), 'utf8');

for (const [file, contents] of [['index.html', indexHtml], ['js/app.js', appJavaScript]]) {
  if (!contents.includes(packageJson.version)) {
    throw new Error(`${file} does not contain package version ${packageJson.version}`);
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(join(output, 'css'), { recursive: true });
await mkdir(join(output, 'fonts', 'files'), { recursive: true });

for (const file of ['index.html', 'manifest.json', 'service-worker.js']) {
  await cp(join(root, file), join(output, file));
}

for (const directory of ['icons', 'js']) {
  await cp(join(root, directory), join(output, directory), { recursive: true });
}

const robotoSource = join(root, 'node_modules', '@fontsource-variable', 'roboto-flex');
await cp(join(robotoSource, 'wght.css'), join(output, 'fonts', 'roboto-flex.css'));

const robotoFiles = await readdir(join(robotoSource, 'files'));
for (const file of robotoFiles.filter((name) => name.endsWith('-wght-normal.woff2'))) {
  await cp(join(robotoSource, 'files', file), join(output, 'fonts', 'files', file));
}
