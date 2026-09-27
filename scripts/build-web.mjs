import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

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

const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || await readFile(join(root, 'config/firebase.json'), 'utf8'));
const allowedConfig = ['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId', 'storageBucket'];
if (Object.keys(firebaseConfig).some(key => !allowedConfig.includes(key))) throw new Error('Unexpected Firebase config field; never include private credentials');
if (Object.keys(firebaseConfig).length && !['apiKey', 'authDomain', 'projectId', 'appId'].every(key => typeof firebaseConfig[key] === 'string' && firebaseConfig[key])) throw new Error('Incomplete Firebase config');
await writeFile(join(output, 'js/firebase-config.js'), `globalThis.FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig)};\n`);
const useEmulators = process.env.FIREBASE_EMULATORS === '1';
if (useEmulators && !String(firebaseConfig.projectId).startsWith('demo-')) throw new Error('Emulator builds require a demo project');
await build({ define: { __FIREBASE_EMULATORS__: String(useEmulators) }, entryPoints: ['js/firestore-sync-entry.mjs'], bundle: true, format: 'iife', target: 'es2020', minify: true, outfile: join(output, 'js/firestore-sync.js') });
