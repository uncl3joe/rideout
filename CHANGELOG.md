# Ride Out Customs – Changelog

Neueste Version oben. v14 und neuer sind exakt dokumentiert, v1 bis v13 sind
die feature-genau rekonstruierte Aufbauphase (Okt/Nov 2026).

## v21 – Changelog automatisch nach Discord
- Projekt-Changelog (diese Datei) eingeführt, mit der kompletten Historie.
- Neue Versionen werden ab jetzt automatisch in einen Discord-Channel gepostet.

## v20 – 24-Stunden-Reservierung & Live-Auktion
- Fahrzeuge können als „Reservierung läuft nach 24 h ab" markiert werden. Nach Ablauf wird das Auto automatisch wieder frei, die Reservierung verschwindet und die Discord-Meldung wird gelöscht.
- Neue Live-Auktion mit eigener öffentlicher Seite /auktion: Gebote in Echtzeit, Schnell-Buttons +10K und +50K sowie freies Gebot, 30-Sekunden-Nachfrist nach Ablauf.
- Öffentlich sichtbar nur IC-Name und Gebot, der Discord-Name nur im Backend.
- Backend-Tab Auktion (Leitungsebene): anlegen, Gebote mit Discord-Name einsehen, Gebote streichen, Auktion beenden. Discord-Meldung bei Start und Ende.
- Automatischer Aufräum-Job (alle 15 Minuten) für Reservierungen und Auktionen.

## v19 – Leserechte für das Team
- Übersicht, Aufträge, Statistik und Provisionen sind jetzt für Mechaniker, Manager, Werkstattleitung und Inhaber sichtbar. Praktikant sieht weiterhin nur das Terminal.
- Ausgaben, Reingewinn und Netto in der Übersicht sowie fremde Provisionen sehen nur Manager, WL und Inhaber.
- Der Mechaniker sieht bei den Provisionen nur die eigene Zeile.
- Rechte-Tabelle im Mitarbeiter-Tab vollständig aktualisiert.

## v18 – Sortierung der Aufträge
- Aufträge werden nach dem tatsächlichen Eingangszeitpunkt sortiert (neueste oben), die Uhrzeit wird mit angezeigt.

## v17 – Datum & KI-Erkennung
- Das Datum wird beim Speichern immer frisch genommen, auch wenn der Tab lange offen war (Fix für Aufträge, die scheinbar verschwunden sind).
- KI-Erkennung von Kundenname und Kennzeichen verbessert (Zeichen wie I, L, 1 und O, 0 werden sorgfältiger gelesen).
- Aufträge-Tab mit „Alle anzeigen" und Aktualisieren-Button.

## v16 – Kassenstand & Auftrags-Spalten
- Löschen eines Mitarbeiters gibt die E-Mail wieder frei, der Datensatz bleibt als Platzhalter erhalten.
- Neuer Kassenstand-Tab (nur Inhaber).
- Aufträge mit vier Spalten: Umsatz, Reingewinn, Provision und Reingewinn nach Provision, plus Summenzeile.

## v15 – Rechte, Bearbeiten & Provisionen
- Ausgaben nur noch Inhaber, Verträge nur vom Inhaber bearbeitbar, Löschen überall nur Inhaber.
- Neuer Aufträge-Tab mit Bearbeiten und Löschen.
- Mitarbeiter: Provisionssatz pro Mechaniker, Deaktivieren und Löschen als Platzhalter, Filter für Ehemalige.
- Neuer Provisionen-Tab (Abrechnung pro Kalenderwoche, Bonus, „ausbezahlt", CSV-Export).
- KI schließt jetzt alle Mitarbeiternamen als Kunde oder Kennzeichen aus.
- Mechaniker-Name wird am Auftrag mitgespeichert, damit die Zahlen auch nach dem Löschen stehen bleiben.

## v14 – Bugfixes
- Datums-Bug behoben: Aufträge nach Mitternacht landeten durch UTC am Vortag, jetzt überall lokale Zeit.
- KI nahm den eigenen IC-Namen als Kunde, der Mitarbeitername wird jetzt ausgeschlossen.
- Kompletter Durchgang durch den Code auf weitere Fehler.

## v1–v13 – Aufbauphase (Okt/Nov 2026, rekonstruiert)
- **v1** – Fundament: Supabase-Datenbank mit allen Tabellen, Rechten und den 103 Leistungen, erster Inhaber-Account.
- **v2** – App live: Next.js-App auf Vercel, Login, internes Terminal mit katalogbasierter Berechnung, Aufträge in der Datenbank.
- **v3** – KI-Auslesung der Rechnungs-Screenshots über Google Gemini (gleiche Modell-Kette wie im alten Google-Sheet).
- **v4** – Rollensystem von Praktikant bis Inhaber mit rollenabhängiger Navigation.
- **v5** – Reiche rechte Spalte im Terminal (Heute, Meine Übersicht, Meistverkauft).
- **v6** – Mitarbeiterverwaltung (anlegen, Rang ändern, löschen) und Passwort selbst ändern.
- **v7** – Echtes ROC-Logo in hoher Auflösung in Kopfzeile und Login.
- **v8** – Fahrzeughandel-Backend: Autohandel-Verwaltung mit Foto-Upload.
- **v9** – Öffentlicher Shop unter /shop (ohne Login) mit Reservieren-Button.
- **v10** – Discord-Benachrichtigung bei neuer Reservierung.
- **v11** – Reservierungs-Verwaltung im Backend (erledigt-Haken, löschen).
- **v12** – Screenshot zusammenführen: mehrere Aufnahmen ergänzen die Liste, Doppelte werden erkannt (für lange Rechnungen und HD mit mehreren Seiten).
- **v13** – Zeitraum-Auswahl mit konkreter Kalenderwoche, Monat und Jahr in Übersicht und Statistik.
