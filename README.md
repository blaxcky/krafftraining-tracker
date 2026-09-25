# Krafttraining Tracker

Der Tracker läuft weiterhin als PWA und zusätzlich als native Android-App auf Basis von Capacitor. Alle Web-Assets, Schriftarten und Icons werden in die APK gebündelt; nur optionale Webhook- und E-Mail-Funktionen benötigen eine Netzwerkverbindung.

## Lokal entwickeln

Voraussetzungen: Node.js 22+, JDK 21 und ein Android SDK mit API 36.

```bash
npm ci
npm run build
npm run android:debug
```

Die Debug-APK liegt anschließend unter `android/app/build/outputs/apk/debug/app-debug.apk`. Änderungen am Web-Code werden mit `npm run android:sync` in das Android-Projekt kopiert.

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

1. Die Versionsnummer in `package.json`, `js/app.js` und `index.html` gemeinsam erhöhen.
2. Den Service-Worker-Cache in `service-worker.js` erhöhen.
3. Änderungen committen und einen passenden Tag pushen, zum Beispiel:

   ```bash
   git tag v2.14.0
   git push origin v2.14.0
   ```

Der Workflow `.github/workflows/android-release.yml` baut daraus eine signierte Universal-APK und veröffentlicht sie zusammen mit einer SHA-256-Prüfsumme im GitHub Release.

In Obtainium als Quelle diese Repository-URL hinzufügen:

```text
https://github.com/blaxcky/krafftraining-tracker
```

Paket-ID: `com.blaxcky.krafttrainingtracker`
