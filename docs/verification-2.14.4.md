# Prüfung des Entwicklungsstands 2.14.4

Release 2.14.4 ist vom Nutzer freigegeben. Die Firebase-Web-Konfiguration für `krafttraining-59773` ist eingetragen. Produktive Anmeldung und ein 0-kcal-Abschluss wurden in der Browser-Vorschau bestätigt. FoodYou wird separat entwickelt.

## Durchgeführt

- Build mit lokal gebündeltem Firebase-SDK und Asset-Prüfung; Node-Tests für Assets, Icons und Sync-Speicher.
- Firestore Emulator Suite: paralleles Anlegen derselben ID, erneute Zustellung nach angenommenem Absturz, unveränderte Empfangszeit, Konfliktablehnung, kein Zugriff für fremde/anonyme Benutzer, keine Updates/Löschungen, ungültige Felder und Werte, getrennte Kategorien einschließlich 0 kcal.
- Browser mit 412 px Breite und Touch: sichtbares Entsperren, Plus/Minus ab 68 kg, beide Zusatzgewichte einschließlich Kaskade, Persistenz nach Reload, Wischen zum Erledigen, Training beenden, E-Mail-/Passwort-Anmeldung, ausdrückliche Kontozuordnung, Sync und Wiederholung. Offline abschließen, offline neu laden und online nachholen. Keine JavaScript-Laufzeitfehler oder horizontales Seitenüberlaufen.
- Android-Emulator API 36, WebView 133: Debug-APK, echte Touch-Ereignisse für dieselben Gewichtsbuttons, Persistenz, Wischen, Trainingsabschluss und Anmeldung/Sync gegen lokale Auth-/Firestore-Emulatoren.
- Android offline: bestehende Emulator-Verbindungen geschlossen, Flugmodus/WLAN aus; sechs Abschlüsse vorgemerkt. Nach Prozessbeendigung und Kaltstart waren alle sechs Aufträge vorhanden. Nach Wiederverbindung alle bestätigt.
- Lokaler Gradle-Debug-Build erfolgreich.

## Gewichtsbutton-Ursache

Die Wischbehandlung setzte Pointer Capture auch beim Start auf einem Button oder Checkbox-Label. Dadurch konnten nachfolgende Klicks auf dem Kartencontainer landen. Steuerelemente verlassen nun die Wischbehandlung vor Pointer Capture. Die bestehende Bearbeitungssperre bleibt erhalten; ein sichtbar beschrifteter Button ersetzt die versteckte Entsperrfunktion des kcal-Badges.

## Produktiver Verbindungstest

- Anmeldung durch den Nutzer direkt im Dialog; keine Zugangsdaten ausgelesen oder gespeichert.
- Ein leerer Trainingsabschluss mit 0 kcal in beiden Kategorien wurde vom echten Firestore-Server bestätigt.
- Nach manuellem erneutem Sync und Neuladen bleiben Anmeldung, bestätigter Status und genau ein Abschluss in der lokalen Historie erhalten. Eine separate serverseitige Dokumentzählung wurde dabei nicht durchgeführt; parallele Wiederholungen und Transaktionskonflikte wurden zuvor gegen den Firestore-Emulator getestet.
- Das 0-kcal-Dokument verbleibt als Testabschluss; der FoodYou-Importer darf daraus keinen Kalorieneintrag erzeugen.

## Abgrenzung

- Authentication, Datenbank und veröffentlichte Regeln wurden vom Nutzer bestätigt. Die öffentliche Authentication-Konfiguration antwortet mit HTTP 200; ein nicht angemeldeter Firestore-Lesezugriff wird mit HTTP 403 / PERMISSION_DENIED abgewiesen. Das bestätigt noch nicht die vollständigen Regeln für angemeldete Nutzer. Anmeldung und Übertragung mit einem Nutzerkonto wurden anschließend in der lokalen Browser-Vorschau erfolgreich geprüft.
- FoodYou-Importer und Verbrauchsdatenmodell. Repository `blaxcky/FoodYou` wurde bei Commit `35ab8f1` lesend geprüft; dort wurde nichts geändert.
- Ende-zu-Ende-Abnahme mit FoodYou und realem Testkonto; insbesondere eindeutige Verbrauchseinträge nach wiederholten Importen und Kontowechsel.
- Der FoodYou-Importer wird separat entwickelt und blockiert auf ausdrücklichen Nutzerwunsch nicht die Veröffentlichung der Trainings-App.

Die Emulator-Prüfungen verwenden ausschließlich synthetische Daten und ersetzen nicht die Abnahme auf dem ursprünglichen Nutzergerät.
