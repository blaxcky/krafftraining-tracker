# Android-Korrektur und Abnahme 2.14.2

Geprüft am 27. September 2026 in einem separaten Android-16/API-36-Emulator mit Android System WebView 133.0.6943.137, 412 CSS-Pixeln Breite und leeren, synthetischen Testdaten. Der Emulator läuft stabil mit `-gpu host -feature -Vulkan`; Softwaregrafik verursachte die zuvor dokumentierten Host-Abstürze.

## Reproduzierter Fehler und Korrektur

Nach Bedienung des Übungsdialogs wurde der Tab-Viewport in der Android-WebView horizontal verschoben: `tab-panels.scrollLeft` betrug etwa 36,95 CSS-Pixel, obwohl die Tab-Transformation bereits bei null stand. Dadurch wurden links Inhalte abgeschnitten und rechts Teile des Nachbartabs sichtbar. `overflow: hidden` lässt programmgesteuertes Scrollen durch Fokus/`scrollIntoView` weiterhin zu.

Der Tab-Viewport verwendet jetzt `overflow: clip`, mit dem bisherigen `hidden` als Fallback für ältere Browser. Die einzelnen Tabs bleiben vertikal scrollbar. Derselbe Bedienablauf und ein zusätzlich erzwungener horizontaler Scrollversuch ergeben jetzt `scrollLeft = 0` und eine korrekt ausgerichtete Übungsansicht.

Das vollständige Fehlerbild mit ausgeschriebenen Icon-Namen war in der unveränderten Release-APK 2.14.0 nicht reproduzierbar. Der hier nachgewiesene native Fehler ist die seitliche Verschiebung. Das Update enthält zusätzlich die in 2.14.1 korrigierte Font-Familie und die gemeinsamen Build-Prüfungen für lokale Styles/Fonts.

## Erfolgreiche Prüfungen

- Web-Build, fünf Asset-Regressionstests, Capacitor-Sync und Android-Debug-Build.
- Installation der Debug-APK 2.14.2 als Update über die Testinstallation 2.14.1: gespeicherte Übung bleibt erhalten.
- Android-WebView: Capacitor-Nativmodus aktiv, beide Fonts geladen, kein PWA-Service-Worker, keine horizontale Überbreite, Startansicht und aktives Training gegenseitig ausgeblendet.
- Übungen anlegen (2.14.1), nach dem Update bearbeiten, Training starten, per Wischgeste erledigen, Erledigte ein-/ausblenden und Trainingsfortschritt nach Neuladen erhalten. Keine JavaScript- oder Konsolenfehler im Ablauf.
- Regression: Dialog bedienen und Tab-Viewport programmgesteuert horizontal scrollen; Übungsansicht bleibt links bei null.
- Echter Prozess-Neustart im Flugmodus ohne aktive Android-Netzwerkverbindung: Fonts, Übungen und erledigtes Training bleiben erhalten. Training lässt sich offline mit bestätigtem Dialog beenden. `navigator.onLine` bleibt in dieser WebView trotz systemseitig fehlendem Netzwerk auf `true`; geprüft wurde daher zusätzlich Androids Netzwerkstatus.
- PWA in Chrome bei 390 × 844 Pixeln: derselbe Trainingsablauf, korrigierte Tab-Position, Datenerhalt und Offline-Nutzung erfolgreich.

Keine Datenbankmigration, keine Änderung der Paket-ID und keine Löschung von Benutzerdaten. Version 2.14.2 verwendet Android-VersionCode 2014002 und PWA-Cache v109.
