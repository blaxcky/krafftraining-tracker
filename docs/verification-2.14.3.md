# Schriftunabhängige Icons: 2.14.3

Der Screenshot aus 2.14.2 zeigt geladene Layout-Styles, aber ausgeschriebene Icon-Ligaturen wie `fitness_center`, `ios_share` und `local_fire_department`. Die bisherige Android-Abnahme auf einer funktionierenden WebView deckte diesen Fehlerzustand nicht ab. Die konkrete Ursache des Font-Ausfalls auf dem Benutzergerät bleibt unbekannt; die betroffene Abhängigkeit wurde vollständig entfernt.

Alle 19 verwendeten Material-Symbol-Formen sind jetzt SVG-Pfade. Statische Icons stehen direkt im HTML, dynamische Icons und Zustandswechsel verwenden `js/icons.js`. Es gibt keine Icon-Schrift, keine Ligaturtexte und keine externen SVG-Verweise. Die bisherigen Formen, Farben und Größen bleiben erhalten. Lizenz und Konvertierung sind unter `icons/` dokumentiert.

## Abnahme am 27. September 2026

- Build, Capacitor-Sync, Android-Debug-Build und acht Regressionstests erfolgreich. Die Tests verhindern die Wiedereinführung der Icon-Schrift, prüfen alle statischen Formen gegen den dynamischen Renderer sowie die Trainings-/Update-Zustände.
- Chrome bei 390 × 844 Pixeln: kompletter Trainingsablauf, Übung anlegen/bearbeiten, Wischgeste, Erledigte ein-/ausblenden, Datenerhalt und Offline-Neuladen erfolgreich.
- Derselbe Browser-Bedienablauf mit absichtlich blockierten WOFF2-Dateien, erzwungener Systemschrift und deaktivierten Ligaturen: Icons weiterhin sichtbar; keine ausgeschriebenen Icon-Namen, keine horizontale Überbreite. Die absichtlich verursachten Font-Netzwerkfehler wurden im Test getrennt von App-Fehlern behandelt.
- Android 16/API 36, System WebView 133.0.6943.137, 412 CSS-Pixel: sämtliche Webfont-Definitionen entfernt (`document.fonts.size = 0`), Systemschrift erzwungen und Ligaturen abgeschaltet. SVG-Icons und vollständiger Trainingsablauf funktionieren weiterhin. Die Umschaltung des Sichtbarkeitsicons erzeugt weiter SVG-Pfade, keinen Text.
- Echter Android-Prozessneustart ohne aktive Netzwerkverbindung: gespeicherte Übung und abgeschlossene Trainingsübung erhalten; Icons sichtbar; Training lässt sich mit bestätigtem Dialog beenden.
- APK-Inhalt geprüft: `js/icons.js` vorhanden, weder Icon-WOFF2 noch Icon-Font-CSS enthalten.
- PWA-Update mit den tatsächlichen Assets aus Release 2.14.2 und bestehendem Training: Wechsel von v109/Icon-Schrift auf v110/SVG erfolgreich, Trainingsdaten erhalten, anschließender Offline-Neustart erfolgreich.

Version 2.14.3, Android-VersionCode 2014003, PWA-Cache v110. Keine Datenbankmigration und keine Änderung von Paket-ID oder Signierung.
