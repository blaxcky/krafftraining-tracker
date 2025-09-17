# Repository Guidelines

## Project Structure & Module Organization
- `index.html` hosts the main PWA shell and Tailwind configuration script.
- `js/` contains application logic split into `app.js` (UI + events), `storage.js` (IndexedDB persistence), and `pwa.js` (service worker registration).
- `service-worker.js` implements offline caching; keep cache version in sync with front-end changes.
- `icons/` and `manifest.json` hold PWA assets; update when shipping new icon sets.

## Build, Test, and Development Commands
- Serve locally with `python3 -m http.server 8080` (or any static server) from the repo root to test PWA features.
- Regenerate icons via `python create_icons.py` after updating source SVGs.
- No automated build pipeline currently; all assets ship as committed.

## Coding Style & Naming Conventions
- JavaScript is plain ES modules: prefer descriptive function names (`renderTrainingExercises`), camelCase variables, and 2-space indentation.
- Keep markup additions Tailwind-friendly; reuse existing utility classes where possible.
- Inline SVGs should follow the existing `h-5 w-5` sizing and inherit color via `currentColor`.

## Testing Guidelines
- Manual testing is required: start a training session, toggle exercises, verify IndexedDB persistence using browser devtools.
- When adding UI states, test both `index.html` (exercise management) and the active training view.
- Document any new manual test steps in PR descriptions until automated tests are introduced.

## Commit & Pull Request Guidelines
- Use concise, imperative commit subjects (e.g., "Add checkbox toggle for completed exercises").
- Include summary bullets when a commit spans multiple areas (UI + storage).
- PRs should describe user-facing changes, list manual test steps, and attach screenshots/GIFs for UI tweaks.
- Bump the version badge in `js/app.js` and `index.html` when shipping features; note the new version in the PR body.

## Security & Configuration Tips
- Avoid introducing third-party scripts without review; all remote assets load over HTTPS.
- Update `CACHE_NAME` in `service-worker.js` whenever cached assets change to prevent stale deployments.
- Do not commit personal training data; IndexedDB content stays client-side.
