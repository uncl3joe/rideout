// Gemeinsame Helfer für Formatierung, Rollen und Zeiträume.

export const fmt = (n) => Math.round(n || 0).toLocaleString('de-DE') + ' $';
export const numf = (n) => Math.round(n || 0).toLocaleString('de-DE');

export const ROLE_LABEL = {
  praktikant: 'Praktikant',
  mechaniker: 'Mechaniker',
  manager: 'Manager',
  werkstattleitung: 'Werkstattleitung',
  inhaber: 'Inhaber',
};

export const ROLES = ['praktikant', 'mechaniker', 'manager', 'werkstattleitung', 'inhaber'];

export function initials(name) {
  return (
    String(name || '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || '–'
  );
}

export const roleBadgeClass = (role) =>
  ({ inhaber: 'inh', werkstattleitung: 'lei', manager: 'lei', mechaniker: 'mec', praktikant: 'pra' }[role] || 'mec');

export const PERIODS = [
  ['heute', 'Heute'],
  ['woche', 'Woche'],
  ['monat', 'Monat'],
  ['jahr', 'Jahr'],
];

export const periodLabel = (p) => (PERIODS.find((x) => x[0] === p) || [, p])[1];

// Startdatum (YYYY-MM-DD) des gewählten Zeitraums, zum Filtern echter Daten.
export function periodStartISO(p) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === 'heute') {
    /* heute 00:00 */
  } else if (p === 'woche') {
    const dow = (d.getDay() + 6) % 7; // Montag = 0
    d.setDate(d.getDate() - dow);
  } else if (p === 'monat') {
    d.setDate(1);
  } else if (p === 'jahr') {
    d.setMonth(0, 1);
  }
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}
