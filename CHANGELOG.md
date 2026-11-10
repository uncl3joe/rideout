# Ride Out Customs – Changelog

Neueste Version oben. v14 und neuer sind exakt dokumentiert, v1 bis v13 sind
die feature-genau rekonstruierte Aufbauphase (Okt/Nov 2026).

## v27 – Erinnerungen räumen sich selbst auf
- Sobald die 15-Minuten-Erinnerung kommt, verschwindet die vorherige 1-Stunden-Erinnerung aus dem Channel.
- Sobald die Auktion beendet ist, verschwindet auch die 15-Minuten-Erinnerung. Es steht also immer nur die aktuellste Erinnerung da.
- Wird eine Auktion gelöscht oder auf „Erledigt" gesetzt, werden eventuell noch stehende Erinnerungen ebenfalls entfernt.

## v26 – Auktions-Nachrichten zusammengefasst & Archiv
- Der Start-Ping steckt jetzt in derselben Nachricht wie die Auktion, nicht mehr als zweite Nachricht. Beim Löschen oder Erledigen verschwindet damit alles gemeinsam.
- Beendete Auktionen bleiben jetzt als Archiv im Live-Auktionen-Channel stehen (Gewinner weiterhin ersichtlich) und werden nicht mehr automatisch nach einer Stunde gelöscht.
- Neuer „Erledigt"-Knopf im Backend-Auktions-Tab: damit entfernt der Ersteller eine beendete Auktion aus dem Channel, sobald das Fahrzeug an den Bieter übergeben ist.

## v25 – Discord-Benachrichtigungen für Bürger & Fahrzeughandel
- Die Bürgergruppe wird im Discord jetzt bei jedem Auktionsstart markiert, dann rund 1 Stunde und noch einmal rund 15 Minuten vor Ende erinnert und beim Beenden kurz markiert.
- Neue Fahrzeuge erscheinen jetzt wie eine Auktion als Nachricht im Fahrzeughandel-Channel, mit Bild und Ping an die Fahrzeughandel-Rolle. Beim Verkauf oder Löschen des Fahrzeugs verschwindet die Nachricht wieder aus dem Channel (eigener Webhook, eigene Rolle).
- Der Aufräum-/Erinnerungs-Takt läuft jetzt verlässlich alle 5 Minuten direkt aus der Datenbank (Supabase pg_cron) statt über den schwankenden GitHub-Takt. Dadurch beenden sich Auktionen und laufen Reservierungen auch pünktlicher ab.
- Jede Erinnerung geht nur einmal raus, auch wenn der Job doppelt läuft. Rein additive Änderung, laufende Auktionen bleiben unberührt.

## v24 – Anbieter in der Auktion & erweiterte Übersicht
- In der Live-Auktion steht jetzt der Anbieter dabei, auf der Homepage und in der Discord-Meldung: bei einem Teamfahrzeug der Name des Mitarbeiters, bei einem Kundenfahrzeug der Kundenname.
- Übersicht: die Tabelle „Leistung pro Mechaniker" zeigt jetzt Umsatz, Reingewinn, Provision und Reingewinn nach Provision, sichtbar für alle Rollen.
- Rein additive Änderung, laufende Auktionen laufen ohne Unterbrechung weiter, kein neues SQL nötig.

## v23 – Discord-Aufräumen, Kundenauktionen & Reservierungs-Hinweis
- Beim Anlegen einer Auktion lässt sich jetzt der Anbieter wählen: entweder das Fahrzeug eines Teammitglieds oder ein Kundenfahrzeug (freier Name). Der Anbieter steht bei jeder Auktion im Backend.
- Beendete Auktionen bleiben noch eine Stunde im Live-Auktionen-Channel sichtbar und werden dann automatisch daraus gelöscht.
- Eine im Backend gelöschte Auktion verschwindet sofort aus dem Channel.
- Reservierungs-Meldungen im Discord verschwinden jetzt automatisch, sobald das Fahrzeug im Backend wieder auf „verfügbar" oder „verkauft" gesetzt, die Reservierung gelöscht oder als erledigt markiert wird.
- Beim Reservieren sieht der Kunde jetzt, wenn ein Fahrzeug nur 24 Stunden reserviert wird (bei normalen Reservierungen bleibt es wie bisher).

## v22 – Auktion in Discord & Shop-Feinschliff
- Fahrzeughandel: großer oranger Button oben rechts direkt zu den Live-Auktionen.
- Pro Browser nur noch eine offene Reservierung gleichzeitig, mit Hinweis-Banner.
- Auktion: Mindest-Erhöhung ab 50.000, Schnell-Buttons +50K und +100K (statt +10K).
- Öffentliche Live-Auktion in Discord: eine Nachricht je Auktion, die sich bei jedem Gebot selbst aktualisiert (Höchstgebot, letzte Gebote, Restzeit), plus Nachricht bei Start und Ende.

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
