// Standard-Inhalt des Werkstatt-Leitfadens. Wird beim ersten Laden angelegt und
// ist danach im Backend (Inhaber) frei editierbar. Reine Datenstruktur.

export const RULES_DEFAULT = {
  title: 'Werkstatt-Leitfaden',
  subtitle: 'Für Praktikanten, Azubis & neue Mitarbeiter',
  funk: '23.08',
  gps: '23.08',
  sections: [
    { title: 'Dienstbeginn', icon: 'radio', blocks: [
      { kind: 'text', text: 'Sobald du eingestempelt bist: Funk auf 23.08 einstellen, GPS auf 23.08 eintragen, dann im Funk kurz begrüßen, damit die Kollegen wissen, dass du im Dienst bist.' },
    ] },
    { title: 'Funkpflicht', icon: 'speech', blocks: [
      { kind: 'text', text: 'Auch bei Pausenbeginn, Pausenende und Dienstende kurz im Funk Bescheid geben.' },
    ] },
    { title: 'Arbeitszeit', icon: 'clock', blocks: [
      { kind: 'text', text: 'Mindestdienstzeit nach dem Einstempeln: 2 Stunden.' },
      { kind: 'text', text: 'Wer vorher ausstempelt, bekommt die Zeit grundsätzlich nicht angerechnet.' },
    ] },
    { title: 'Abwesenheit', icon: 'user', blocks: [
      { kind: 'text', text: 'Länger als 15 Minuten weg: kurz im Funk Bescheid geben, dann ausstempeln. Nach der Rückkehr wieder einstempeln.' },
    ] },
    { title: 'Rechnungen & Übergabe', icon: 'receipt', blocks: [
      { kind: 'callout', tone: 'good', label: 'So läuft es jetzt', text: 'Das Fahrzeug wird dem Kunden übergeben, sobald er den Auftrag bezahlt hat.' },
    ] },
    { title: 'Lager & Verbrauchsmaterial', icon: 'box', blocks: [
      { kind: 'text', text: 'Der Schrank mit Essen und Getränken ist nur für Mitarbeiter. Kunden bekommen bei längeren Wartezeiten aus Kulanz einen Kaffee.' },
      { kind: 'callout', tone: 'hot', label: 'Dokumentieren', text: 'Alles aus dem Lager (außer Alkohol) im E-Mail-Verteiler eintragen: Repkits, Cleankits, Getränke, Essen.' },
    ] },
    { title: 'Privatfahrzeuge', icon: 'car', blocks: [
      { kind: 'callout', tone: 'warn', label: 'Verhalten', text: 'Wir tunen unsere privaten Fahrzeuge nicht, wenn gerade viel los ist (High Life, volle Bude, genug Kunden da). Kundschaft geht vor.' },
    ] },
    { title: 'Feierabend', icon: 'beer', blocks: [
      { kind: 'text', text: 'Alkoholische Getränke müssen nicht im Verteiler eingetragen werden.' },
      { kind: 'text', text: 'Nach Feierabend ist ein wohlverdientes Feierabendbier erlaubt.' },
    ] },
    { title: 'Bestellungen — Repkits & Cleankits', icon: 'cart', wide: true, blocks: [
      { kind: 'callout', tone: 'hot', label: 'Ab 50 Repkits (Großbestellung)', text: 'Keine direkte Herausgabe, erst Bestellung aufnehmen. Beruft sich ein Kunde auf eine Absprache mit Moser oder Enzo, vorher bei einem von beiden bestätigen. Niemals ohne Rücksprache große Mengen rausgeben.' },
      { kind: 'callout', tone: 'good', label: 'Unter 50 Repkits', text: 'Direkt verkaufen, Rechnung erstellen, Ware anschließend herausgeben.' },
    ] },
  ],
  grundregeln: [
    { text: 'Freundlich zu Kunden sein.' },
    { text: 'Rechnungen immer ordentlich erstellen.' },
    { text: 'Bei Unsicherheit lieber einmal mehr nachfragen.' },
    { text: 'Niemals eigenständig Ausnahmen machen.' },
    { text: 'Kein Streit und keine privaten Diskussionen vor laufender Kundschaft.', key: true },
    { text: 'Bei Problemen immer die Werkstattleitung oder einen Chef informieren.' },
  ],
};
