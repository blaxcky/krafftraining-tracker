# Abnahme 2.14.1

Geprüft am 27. September 2026.

Nachtrag: Die Android-Prüfung konnte mit Host-Grafik fortgesetzt werden. Der dabei gefundene Tab-Fehler und die erfolgreiche Abnahme des Updates sind in [verification-2.14.2.md](verification-2.14.2.md) dokumentiert.

## Web und PWA

- `npm run build`: erfolgreich; 26 lokale Assets und 7 offline vorab gespeicherte Fonts geprüft.
- `npm test`: erfolgreich; fünf Regressionstests für vollständige Assets, unkompiliertes Tailwind, fehlende `hidden`-Regel, fehlende Fonts/JavaScript-Dateien und unvollständigen Font-Precache.
- Chrome mit isoliertem Profil, 390 × 844 Pixel: Trainings- und Übungsansicht visuell geprüft. Icons werden als Symbole dargestellt, Navigation bleibt im Bildschirm, keine horizontale Überbreite. Aktives Training und Startansicht sind gegenseitig ausgeblendet.
- Über die Oberfläche: Übung anlegen und bearbeiten, Training starten, Übung per Wischgeste erledigen, Erledigte ein-/ausblenden und Training beenden erfolgreich.
- Neuladen erhält Übungen und Trainingsfortschritt. Offline-Neuladen, Fonts und Beenden des Trainings erfolgreich. Keine JavaScript- oder Konsolenfehler im vollständigen Ablauf.
- Update-Simulation mit bestehendem Training und absichtlich beschädigtem CSS in Cache `v107`: Update über den Hinweis auf `v108` erfolgreich; Styles wiederhergestellt, alter Cache entfernt, Trainingsdaten erhalten. Anschließender Offline-Neustart erfolgreich.

## Android

- `npm run android:sync`: erfolgreich.
- Android-Debug-Build mit JDK 21 und SDK 36: `assembleDebug --offline --no-daemon` erfolgreich.
- Die veröffentlichte APK 2.14.0 enthält bereits kompiliertes Tailwind einschließlich `hidden`, Icon-CSS, Icon-Font und Roboto-Fonts. Ihr gemeldeter Laufzeitfehler ist damit noch nicht erklärt.
- **Android-Laufzeitabnahme offen:** Ein separater, leerer API-36-Testemulator stürzte vor einer stabilen App-Prüfung mit Exit-Code 139 ab. Versucht wurden SwiftShader, SwiftShader ohne Vulkan und deaktivierte GPU. Kein physisches Android-Testgerät angeschlossen.
- Daher keine Behauptung, dass der gemeldete APK-Fehler behoben sei, und kein neuer Android-Release. Vor Veröffentlichung auf einem funktionierenden Emulator oder Gerät die obigen Bedienabläufe sowie App-Neustart, Offline-Start und WebView-Konsole prüfen.

Die Änderung enthält keine Datenbankmigration und löscht keine Trainingsdaten.
