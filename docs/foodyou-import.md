# Übergabe an den FoodYou-Importer

## Verbindung

- Firebase-Projekt: `krafttraining-59773`
- Firestore-Datenbank: `(default)`
- Firebase Authentication: E-Mail/Passwort. Dasselbe Benutzerkonto wie in der Trainings-App verwenden; maßgeblich ist dessen UID, nicht eine E-Mail-Adresse als Dokument-ID.
- FoodYou erhält eine eigene Firebase-App-Registrierung für seine Plattform im selben Projekt. Keine separate Benutzerdatenbank und kein zweites Firebase-Projekt anlegen.
- Collection zum Lesen: `users/{currentUser.uid}/trainingSessions`.

## Gespeichertes Dokument

Dokument-ID = `sessionId`. Ein Dokument entspricht genau einem abgeschlossenen Training. Krafttraining und Cardio stehen zusammen in diesem einen atomar gespeicherten Dokument:

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

Zusätzlich existiert `receivedAt` als Firestore-Timestamp (Serverzeitpunkt der ersten Übertragung). Die Start-/Endzeitpunkte sind UTC-ISO-Strings. `activityDate` ist das beim Start gespeicherte lokale Datum und bestimmt den Buchungstag; weder Empfangsdatum noch aktuelles Gerätedatum verwenden.

`strengthKcal` und `cardioKcal` sind nichtnegative Ganzzahlen in kcal. Keine Umrechnung auf Basis von Gewicht, Dauer oder Übungsanzahl durchführen. Das Dokument enthält keine einzelne Übung, keine Lebensmitteldaten und keine dritte Gesamtkalorienbuchung. Abgeschlossene Dokumente sind in Schema v1 unveränderlich.

## Import ohne Doppelzählung

1. Collection der angemeldeten UID beobachten; anfangs auch vorhandene Dokumente laden. Unbekannte Schema-Versionen ablehnen und sichtbar melden.
2. Dokument-ID, `sessionId`, Quelle, Datum und nichtnegative ganzzahlige Werte prüfen.
3. Für `strengthKcal > 0` einen Verbrauchseintrag **Krafttraining** mit Import-ID `krafttraining-tracker:{sessionId}:strength` anlegen/upserten.
4. Für `cardioKcal > 0` einen Verbrauchseintrag **Cardio** mit Import-ID `krafttraining-tracker:{sessionId}:cardio` anlegen/upserten.
5. Beide Upserts in einer lokalen Datenbanktransaktion ausführen. Einen Unique Constraint auf `(firebaseProjectId, firebaseUid, importId)` verwenden. Ein zusätzlicher Importbeleg gehört in dieselbe Transaktion.
6. Tagesverbrauch aus diesen eindeutigen Einträgen berechnen. Niemals bei einem Listener-Ereignis erneut auf einen Tageszähler addieren.
7. Kontowechsel beendet den alten Listener und trennt die importierten Daten nach Projekt/UID. Nicht allein nach Datum oder Kaloriensumme deduplizieren: mehrere Trainings am selben Tag sind legitim.

0 kcal → kein Eintrag für diese Kategorie. Sind beide Werte 0, wird kein Verbrauch gebucht. Ein solcher 0-kcal-Testabschluss wurde bereits im echten Projekt gespeichert und darf die Tagesbilanz nicht verändern.

Verbrauchseinträge müssen in FoodYou getrennt von Ernährungseinträgen gespeichert werden; keine negativen Lebensmittel als Ersatz verwenden. Ein Firestore-Sync-Status bestätigt nur den Serverempfang. FoodYou zeigt seinen eigenen erfolgreichen Import an.

## Abnahmetests für FoodYou

- Dasselbe Dokument fünfmal empfangen → weiterhin höchstens zwei Verbrauchseinträge.
- App-Neustart/Listener-Neustart → keine zusätzlichen Kalorien.
- Absturz zwischen den beiden Kategorien → lokale Transaktion hinterlässt kein halb importiertes Paar.
- Zwei verschiedene Trainings-IDs am selben Tag → beide zählen.
- Krafttraining allein, Cardio allein und beide 0 → jeweils richtige Anzahl Einträge.
- Training über Mitternacht, verspäteter Offline-Sync und Zeitzonenwechsel → Buchung weiterhin unter `activityDate`.
- Anderes Firebase-Konto → keine Vermischung bestehender Einträge.
- Unbekannte Schema-Version oder ungültige Daten → keine Buchung, sichtbarer Fehler.

Referenz und weitere technische Details: `docs/firestore-sync.md`; reine Referenzabbildung: `importEntries()` in `js/sync-core.mjs`.
