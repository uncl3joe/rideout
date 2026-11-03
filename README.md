# Ride Out Customs – Werkstatt-App

Next.js + Supabase. Phase 1: Login, rollenbasierte Oberfläche und das Terminal
(Rechner), das den Katalog aus deiner Supabase-Datenbank lädt und Aufträge speichert.

---

## Was du brauchst (einmalig)

Aus deinem Supabase-Projekt die zwei Zugangsdaten:
**Supabase → Project Settings → Data API (bzw. API)**
- **Project URL**  →  `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key  →  `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Der anon-Key darf öffentlich sein – die Row Level Security schützt die Daten.

---

## Variante A: Live ins Web mit Vercel (empfohlen, kein lokales Setup nötig)

1. Projekt auf **github.com** hochladen (neues Repo → „upload files" → den Inhalt
   dieses Ordners reinziehen; `node_modules` nicht nötig).
2. Auf **vercel.com** mit GitHub anmelden → **Add New… → Project** → dein Repo
   importieren.
3. Vor dem Deploy unter **Environment Variables** die zwei Werte von oben eintragen
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. **Deploy**. Nach ~1 Minute bekommst du eine URL – das ist deine Live-App.

Danach gilt: eine Änderung im Repo = automatisch neues Deploy.

---

## Variante B: Lokal auf dem eigenen PC (zum Testen/Entwickeln)

Voraussetzung: **Node.js 18+** installiert.

```bash
npm install
cp .env.local.example .env.local      # dann die zwei Werte eintragen
npm run dev
```

Läuft dann auf http://localhost:3000

Deployen geht von hier auch direkt: `npx vercel` (führt dich durch den Login).

---

## Login

Einloggen mit der E-Mail + Passwort, die du in Supabase unter
**Authentication → Users** angelegt hast. Rolle/Rechte kommen automatisch aus der
`profiles`-Tabelle (du bist als `inhaber` gesetzt → du siehst alles).

---

## Struktur

```
app/
  layout.js            Grundgerüst + Schriften
  globals.css          Design (Schwarz/Orange/Blau)
  page.js              Startseite: lädt Nutzer, Rolle, Katalog
  login/page.js        Login-Formular
  actions.js           Server-Action: Auftrag sicher speichern
components/
  Shell.js             Topbar + rollenbasierte Navigation
  Terminal.js          Der Rechner (Katalog, Auto-Anpassung, 30% Provision)
lib/supabase/          Datenbank-Anbindung (Browser + Server)
middleware.js          Session + Schutz (ohne Login -> /login)
```

Jetzt live und an die echte Datenbank angebunden: Mein Terminal, Übersicht
(mit Zeitraum-Umschalter), Statistik, Mitarbeiter (Team + Rang vergeben),
Ausgaben, Verträge, Preise & Katalog (anlegen/bearbeiten/löschen).

Kommt noch: neue Logins direkt in der App anlegen/löschen (braucht einen
zusätzlichen geheimen Schlüssel), und die öffentliche Homepage mit Fahrzeughandel
(Phase 3).
