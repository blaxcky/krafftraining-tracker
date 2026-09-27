# Firestore-Synchronisierung (Schnittstelle v1)

## Stand und Einrichtung

Die Trainings-App speichert abgeschlossene Sessions lokal und überträgt sie an Firestore. Die öffentliche Web-Konfiguration für `krafttraining-59773` ist in `config/firebase.json` eingetragen. Der Nutzer hat Authentication, Datenbank und veröffentlichte Zugriffsregeln bestätigt. Die öffentliche Projektkonfiguration ist erreichbar und Firestore weist unangemeldetes Lesen ab. Eine Anmeldung durch den Nutzer und die echte Übertragung eines 0-kcal-Abschlusses wurden in der Browser-Vorschau erfolgreich geprüft. Die Einrichtung in Firebase erfolgte durch den Nutzer. Der Nutzer hat die Veröffentlichung der Trainings-App als v2.14.4 freigegeben; FoodYou wird separat entwickelt.

1. Im vorhandenen Firebase-Projekt eine **Web-App** registrieren und deren öffentliche Konfiguration kopieren. Benötigt: `apiKey`, `authDomain`, `projectId`, `appId`.
2. Firestore-Datenbank anlegen. Authentication → Anmeldemethode **E-Mail/Passwort** aktivieren. Das gemeinsame Konto unter Authentication → Users anlegen. Beide Apps verwenden dasselbe Projekt und dieselbe UID. Die Trainings-App bietet Anmeldung und Passwort-Zurücksetzen, keine öffentliche Registrierung.
3. Öffentliche Konfiguration in `config/firebase.json` eintragen oder beim Build als JSON in `FIREBASE_CONFIG` übergeben. GitHub Actions verwendet die Repository-Variable `FIREBASE_CONFIG`. Keine Service-Account-Schlüssel oder Passwörter eintragen.
4. `firestore.rules` zunächst in einer Testumgebung prüfen. Für ein leeres Projekt: `npx firebase deploy --only firestore:rules --project DEINE_PROJEKT_ID`. Bei vorhandenen Regeln die neue Collection-Regel in die bestehenden Regeln integrieren, nicht fremde Regeln überschreiben. Überlappende breite Zugriffsregeln dürfen diesen Schutz nicht aufheben.
5. `npm run android:sync` bzw. `npm run build` ausführen. Das Firebase-SDK wird lokal gebündelt und mit der PWA vorab zwischengespeichert.
6. In der App anmelden. Vorher ohne Konto abgeschlossene Trainings ausdrücklich dem angezeigten Konto zuordnen. Bereits gebundene Trainings wechseln bei einer Abmeldung oder einem Kontowechsel niemals den Besitzer.

Ohne Netzwerk darf Training beendet werden. Erst bestätigter Serverempfang heißt „Mit Firestore synchronisiert“. Die Übertragung erfolgt bei geöffnetem Prozess; nach vollständigem Schließen beim nächsten Start. Offene Fehler bei Zugriff oder Konflikten werden nicht endlos wiederholt; „Jetzt synchronisieren“ versucht sie erneut.

## Dokumentvertrag

Pfad: `users/{uid}/trainingSessions/{sessionId}`. Dokumente sind nach Anlage unveränderlich. Wiederholungen lesen und vergleichen denselben Datensatz in einer Firestore-Transaktion. Bei abweichendem Inhalt wird nichts überschrieben.

```json
{
  "schemaVersion": 1,
  "source": "krafttraining-tracker",
  "sessionId": "86aa75c0-0686-4e8c-8b31-750c13409d23",
  "startedAt": "2026-09-27T21:50:00.000Z",
  "endedAt": "2026-09-28T00:30:00.000Z",
  "activityDate": "2026-09-27",
  "timeZone": "Europe/Vienna",
  "strengthKcal": 210,
  "cardioKcal": 120
}
```

`receivedAt` kommt als Firestore **Timestamp** vom Server hinzu. `startedAt`/`endedAt` sind UTC-ISO-Strings; `activityDate` wird beim Trainingsstart in dessen lokaler Zeitzone eingefroren. Bei bereits laufenden älteren Sessions wird die aktuell bekannte Gerätezeitzone verwendet, da bisher keine gespeichert wurde. Die UUID wird einmal gespeichert und niemals beim Wiederholen neu erzeugt.

`strengthKcal`: nur erledigte Übungen; offene, übersprungene Übungen und Überschriften zählen nicht. `cardioKcal`: alle beim Abschluss vorhandenen Cardio-Einträge. Beide Werte sind nichtnegative sichere Ganzzahlen. Keine Übungsnamen, Gewichte oder personenbezogenen Kontodaten im Payload. Zwei Kategorien werden in einem Dokument atomar angelegt, auch wenn eine oder beide 0 kcal haben.

## Vertrag für die Kalorien-App

- Ausschließlich Collection der angemeldeten UID lesen; Änderungen per Firestore-Listener oder erneuter Abfrage einlesen. Jede Wiederholung muss erlaubt sein.
- Schema, Quelle, UUID, Datum und Kalorien prüfen. Unbekannte Schema-Versionen nicht importieren, sondern anzeigen.
- Pro Kategorie mit mehr als 0 kcal einen **Verbrauchseintrag**, keinen Ernährungseintrag, erzeugen. Importkennung: `krafttraining-tracker:{sessionId}:strength` bzw. `krafttraining-tracker:{sessionId}:cardio`.
- Importkennung pro Firebase-Projekt und UID mit einem Unique Constraint absichern. Beide Kategorien und einen optionalen Importbeleg in **einer lokalen Datenbanktransaktion** upserten. Bei Prozessabbruch vor Commit bleibt nichts Halbimportiertes zurück. Nach Commit darf Wiederholung nichts addieren.
- Tagesverbrauch aus den eindeutigen Einträgen berechnen. Kein `total += neueKalorien` bei Listener-Ereignissen, kein Datum als alleinige ID. Mehrere Trainings am selben Tag sind legitim.
- Für 0 kcal keinen Verbrauchseintrag anlegen. Gesamtverbrauch nicht als dritte Kategorie importieren. Schema v1 erlaubt keine nachträgliche Änderung abgeschlossener Trainings.
- Beim Kontowechsel importierte Daten getrennt halten. Einen lokalen Datensatz niemals anhand gleicher Trainings-ID eines anderen Kontos ersetzen.
- Der Nutzer darf erkennen, wann FoodYou die Übernahme abgeschlossen hat. Der Status der Trainings-App bestätigt nur Firestore.

Die Referenzabbildung `importEntries()` in `js/sync-core.mjs` und die Tests zeigen die stabilen Schlüssel. Sie ersetzen nicht den tatsächlichen FoodYou-Importer.

## FoodYou-Befund

Untersucht: `blaxcky/FoodYou`, Commit `35ab8f1` (3.4.8). Im untersuchten Stand gibt es weder Firebase-Abhängigkeiten noch ein erkennbares Trainingsverbrauchsmodell. `ManualDiaryEntry` gehört zum Ernährungstagebuch und enthält `NutritionFacts` und `mealId`; es ist deshalb kein geeignetes Ziel für verbrannte Kalorien.

FoodYou benötigt eine eigene Verbrauchstabelle mit Konto-/Projektzuordnung und eindeutiger Importkennung, ein Repository/Importer mit atomarem Upsert, Firebase-Anmeldung sowie eine Einbindung des Verbrauchs in seine Tagesbilanz. Das liegt im FoodYou-Repository und wurde hier nicht implementiert. Ohne diese Ergänzung werden Dokumente in Firestore noch nicht automatisch von FoodYou eingelesen. Keine negativen Lebensmittel als Umgehung eintragen.

## Lokale Daten und Fehlerfälle

Aktive Trainings bleiben unter `current`. Abschlussaufträge liegen im vorhandenen IndexedDB-Store `training` unter `sync:{sessionId}`. Abschluss und Entfernen von `current` erfolgen in derselben Transaktion. Änderungen von Übungen/Cardio verwenden ebenfalls atomare Lese-/Schreibtransaktionen, damit späte Ereignisse kein abgeschlossenes Training wiederherstellen.

Die Warteschlange ist nicht auf fünf Einträge beschränkt; die Oberfläche zeigt lediglich die letzten fünf Abschlüsse. Alte localStorage-Backups und E-Mail-/Webhook-Einstellungen bleiben erhalten, werden aber nicht automatisch importiert oder weiter verwendet. Kein Datenbank-Versionswechsel. Aktuelle Trainings und neue Übertragungsaufträge sind weiterhin lokale Daten; eine Deinstallation oder das Löschen von App-Daten entfernt noch nicht synchronisierte Aufträge.

## Wiederholbare Prüfung

```bash
npm ci
npm run build
npm test
npm run test:firestore
```

Für Browser/Android-Integration ausschließlich Demo-Emulatoren:

```bash
npx firebase emulators:start --project demo-training-sync --only auth,firestore
```

In einem zweiten Terminal:

```bash
FIREBASE_CONFIG='{"apiKey":"demo-api-key","authDomain":"demo-training-sync.firebaseapp.com","projectId":"demo-training-sync","appId":"demo-app"}' FIREBASE_EMULATORS=1 npm run android:sync
npm run preview
```

Browser: `npx playwright install chromium`, dann `node tests/browser/sync.cjs`. Alternativ `CHROME_PATH=/pfad/zu/chrome` setzen. Für Android die Debug-APK bauen und ausschließlich auf einem separaten Testemulator (`emulator-5580`) installieren, `adb reverse tcp:8180 tcp:8180` und `adb reverse tcp:9199 tcp:9199` setzen, App öffnen und `NATIVE=1 node tests/browser/sync.cjs` ausführen. Der Test erstellt synthetische Übungen/Konten. Niemals auf einem persönlichen Gerät mit echten Daten ausführen.

Die Debug-Variante erlaubt HTTP ausschließlich zu `127.0.0.1` für die Emulatoren; Release enthält diese Android-Ausnahme nicht. Emulator-Routing wird nur mit `FIREBASE_EMULATORS=1` eingebaut und verlangt eine `demo-`-Projekt-ID. Vor einem normalen Build diese Variable weglassen; anschließend erneut `npm run android:sync` ausführen.

Die Android-Abnahme mit lokalen Firebase-Emulatoren einschließlich Anmeldung und Offline-Kaltstart/Nachholen ist erfolgt; die produktive Anmeldung/Übertragung wurde ergänzend im Browser geprüft. Der Ende-zu-Ende-Test mit FoodYou einschließlich doppelter Listener-Ereignisse und Kontowechsel erfolgt bei dessen separater Entwicklung. Prüfprotokoll: `docs/verification-2.14.4.md`.

Android-Kaltstartprüfung: Nach dem erfolgreichen Android-Anmeldetest `ADB_PATH=/pfad/zum/adb node tests/browser/native-offline.cjs` ausführen. Der Test unterbricht ausschließlich auf `emulator-5580` die Verbindungen, beendet sechs synthetische Trainings, startet den Prozess neu und prüft die spätere Übertragung.
