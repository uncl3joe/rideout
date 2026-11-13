# Ride Out Customs – Changelog

Neueste Version oben. v14 und neuer sind exakt dokumentiert, v1 bis v13 sind
die feature-genau rekonstruierte Aufbauphase (Okt/Nov 2026).

## v32 – Längeres Bild-Cache & Speicher-Aufräumen
- Hochgeladene Bilder werden jetzt 30 Tage im Browser gecacht statt nur 1 Stunde (Supabase-Standard). Wer öfter in Shop oder Auktion schaut, lädt dasselbe Bild damit nur noch einmal statt immer wieder. Das drückt den Cached Egress zusätzlich, weil der genau aus Wiederholungsaufrufen entsteht. Gilt für neue Uploads und für die Optimierungs-Funktion aus v31.
- Beim Löschen eines Fahrzeugs oder einer Auktion wird jetzt auch das zugehörige Foto aus dem Speicher entfernt, keine Karteileichen mehr.
- Beim Foto-Tausch im Autohandel wird das alte Bild ebenfalls gelöscht statt liegen zu lassen.
- Kein SQL nötig, rein Code.

## v31 – Bilder verkleinern & Bandbreite sparen
- Fahrzeug- und Auktionsfotos werden ab jetzt schon beim Hochladen im Browser automatisch verkleinert und komprimiert (längste Kante max 1280px, WebP mit Fallback auf JPEG). Aus mehreren MB werden so meist 100 bis 300 KB. Das senkt den Supabase-Verbrauch (Cached Egress) massiv, der zuletzt das 5-GB-Limit des Free-Plans gesprengt hat.
- Neuer Knopf „Alle Bilder jetzt optimieren" im Autohandel-Tab (nur Leitung): verkleinert einmalig auch alle bereits hochgeladenen Fahrzeug- und Auktionsbilder. Das alte Original wird dabei aus dem Speicher gelöscht, die Seite zeigt am Ende wie viel gespart wurde.
- Die öffentlichen Seiten (/shop und /auktion) laden Fotos jetzt erst, wenn sie ins Bild scrollen (lazy loading). Dadurch zieht ein Seitenaufruf nicht mehr automatisch alle Bilder auf einmal.
- Kein SQL nötig, rein Code. Einfach die Zip hochladen. Danach einmal den Optimieren-Knopf drücken, dann ist das Thema erledigt.

## v30 – Ping-Channels & 48-Stunden-Abholfrist
- Der Auktions- und der Fahrzeughandel-Channel sind jetzt reine Ping-Channels. Es gibt kein dauerhaftes Live-Board und keine Archiv-Nachricht mehr. Jeder Ping (Auktionsstart, Erinnerungen, Auktionsende, neues Fahrzeug) verschwindet automatisch nach spätestens 30 Minuten wieder. Die Live-Ansicht und das Mitbieten laufen weiterhin auf /auktion, der Fahrzeughandel auf /shop.
- Dreifache Absicherung beim Aufräumen: zeitlich (nach 30 Minuten), ablösend (eine neue Erinnerung entfernt die vorherige) und beim Abschluss (verkauft, beendet, erledigt oder gelöscht räumt alle Pings des Objekts auf einmal weg). Dafür gibt es die neue Tabelle discord_pings.
- Auktions-Erinnerungen jetzt dreistufig: rund 2 Stunden, 1 Stunde und 15 Minuten vor Ende (vorher nur 1 Stunde und 15 Minuten). Es steht immer nur die aktuellste im Channel.
- Neue 48-Stunden-Abholfrist: Ist eine Auktion mit Gewinner beendet, zeigt die Auktion im Backend einen Countdown „Abholfrist: noch X Std Y Min". Läuft die Frist ab, färbt sich die Karte rot und zeigt „Abgelaufen, nicht abgeholt". Das Fahrzeug kann dann manuell erneut versteigert werden.
- Die Reservierungs-Meldungen im Reservierungs-Channel bleiben unverändert (sie stehen wie gehabt, bis sie erledigt oder abgelaufen sind).
- Neues SQL: update11.sql (Tabelle discord_pings plus reminder_120-Spalten). Bitte vor dem Upload im Supabase SQL-Editor ausführen.

## v29 – Keine Minus-Provision mehr
- Ist der Reingewinn eines Auftrags null oder negativ (z. B. teures Teil wie Motor- und Leistungstuning), bekommt der Mechaniker jetzt 0 Provision statt einer Minus-Provision. Der Reingewinn selbst bleibt unverändert und darf weiterhin negativ sein, die Werkstatt trägt den Verlust.
- Gilt serverseitig beim Speichern und Nachbearbeiten sowie in der Live-Vorschau im Terminal.
- Bereits gespeicherte Aufträge mit Minus-Provision werden per update10.sql einmalig auf 0 gesetzt.

## v28 – Gebotsschritte dynamisch & Mindestgebot gesperrt
- Die Schnell-Buttons richten sich jetzt nach der Mindesterhöhung der jeweiligen Auktion: ein Button mit genau der Mindesterhöhung, einer mit dem Doppelten (z. B. 30.000 ergibt +30.000 und +60.000). Vorher waren sie fix auf +50K und +100K.
- Im freien Feld lässt sich ein Betrag unter dem Mindestgebot nicht mehr absenden, er wird sofort abgewiesen statt erst vom Server. Eine höhere eigene Zahl geht weiterhin.
- Die Mindest-Erhöhung lässt sich im Backend jetzt ab 1.000 einstellen (vorher waren mindestens 50.000 nötig), damit die kleineren Schritte überhaupt möglich sind.

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
