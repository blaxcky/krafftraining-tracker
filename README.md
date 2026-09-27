# Krafttraining Tracker

Der Tracker läuft weiterhin als PWA und zusätzlich als native Android-App auf Basis von Capacitor. Alle Web-Assets, Schriftarten und Icons werden in die APK gebündelt; nur optionale Webhook- und E-Mail-Funktionen benötigen eine Netzwerkverbindung.

UI-Icons sind direkt eingebettete SVG-Pfade und benötigen keine Icon-Schrift oder Schriftligaturen. Statische Icons stehen in `index.html`, dynamische Icons werden mit `AppIcons.render` und `AppIcons.set` aus `js/icons.js` erzeugt. Die Formen stammen aus Material Symbols Outlined (Google, Apache-2.0); Lizenz und Konvertierungshinweise stehen unter `icons/`.

## Lokal entwickeln

Für die Web-Vorschau: Node.js 22+ und Python 3. Für Android zusätzlich JDK 21 und ein Android SDK mit API 36.

```bash
npm ci
npm run build
npm test
npm run preview
```

Die Vorschau läuft unter `http://localhost:8080`. Ausschließlich `www` ausliefern: Im Quellordner enthält `css/tailwind.css` noch Build-Anweisungen, und die lokalen Fonts werden erst beim Build kopiert. Nach Änderungen erneut `npm run build` ausführen. `npm run verify:web` prüft das gebaute Verzeichnis auf kompilierte Styles, die notwendige `hidden`-Regel, lokale Asset-Verweise und vollständig vorab zwischengespeicherte Fonts.

Mit `npm run android:debug` wird die Android-App gebaut.

Die Debug-APK liegt anschließend unter `android/app/build/outputs/apk/debug/app-debug.apk`. Änderungen am Web-Code werden mit `npm run android:sync` in das Android-Projekt kopiert.

## PWA veröffentlichen und prüfen

GitHub Pages muss unter **Settings → Pages → Build and deployment → Source** auf **GitHub Actions** stehen. Der Workflow `.github/workflows/deploy.yml` baut den Branch `codex-complete-redesign` und veröffentlicht ausschließlich `www`. Pull Requests prüfen den Build, veröffentlichen aber nicht. Der Workflow kann auf diesem Branch auch manuell gestartet werden.

Vor einer Veröffentlichung beide Ansichten bei schmalem Bildschirm prüfen: Icons und Abstände, Navigation, Übungen anlegen/bearbeiten, Training starten, abhaken, Erledigte ausblenden und Training beenden. Nach einem Neustart müssen Übungen und ein laufendes Training erhalten bleiben. Nach vollständiger Service-Worker-Installation offline neu laden und Fonts sowie Bedienung prüfen. Mit einem bestehenden PWA-Stand den Update-Hinweis annehmen und sicherstellen, dass Styles aktualisiert werden und Trainingsdaten erhalten bleiben.

Die APK zusätzlich in einer echten Android-Laufzeit prüfen, einschließlich Styles, Fonts, JavaScript-Fehlern, Trainingsbedienung, Neustart und Offline-Start. Ein erfolgreicher Web-Build ersetzt diese Abnahme nicht. Ohne Android-Abnahme kein Android-Release veröffentlichen.

## Signierung einmalig einrichten

Android akzeptiert Updates nur, wenn jede APK mit demselben Schlüssel signiert ist. Vor dem ersten Release deshalb den Schlüssel erzeugen und als GitHub-Secrets hinterlegen:

```bash
gh auth login
./scripts/configure-android-signing.sh
```

Der Schlüssel liegt danach ausschließlich unter `.signing/krafttraining-release.jks` und ist durch `.gitignore` ausgeschlossen. Eine sichere externe Sicherung ist zwingend: Geht dieser Schlüssel verloren, kann keine bestehende Installation mehr aktualisiert werden.

Der Workflow erwartet diese Repository-Secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## GitHub Release und Obtainium

1. Die Versionsnummer in `package.json`, `package-lock.json`, `js/app.js` und `index.html` gemeinsam erhöhen.
2. Den Service-Worker-Cache in `service-worker.js` erhöhen.
3. Änderungen committen und einen passenden Tag pushen, zum Beispiel:

   ```bash
   git tag v2.14.3
   git push origin v2.14.3
   ```

Der Workflow `.github/workflows/android-release.yml` baut daraus eine signierte Universal-APK und veröffentlicht sie zusammen mit einer SHA-256-Prüfsumme im GitHub Release.

In Obtainium als Quelle diese Repository-URL hinzufügen:

```text
https://github.com/blaxcky/krafftraining-tracker
```

Paket-ID: `com.blaxcky.krafttrainingtracker`
