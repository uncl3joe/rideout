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

// ---- Konkrete Zeiträume (KW / Monat / Jahr) zum Auswählen ----
const MONTHS_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// ISO-Kalenderwoche (Woche beginnt Montag; KW 1 enthält den ersten Donnerstag).
function isoWeek(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day + 3); // nächster Donnerstag
  const firstThu = new Date(t.getFullYear(), 0, 4);
  const fd = (firstThu.getDay() + 6) % 7;
  firstThu.setDate(firstThu.getDate() - fd + 3);
  const week = 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * 86400000));
  return { year: t.getFullYear(), week };
}
function isoWeekMonday(year, week) {
  const firstThu = new Date(year, 0, 4);
  const fd = (firstThu.getDay() + 6) % 7;
  const mon1 = new Date(year, 0, 4 - fd);
  return addDays(mon1, (week - 1) * 7);
}

// Liste auswählbarer Zeiträume je Granularität, jeweils mit [startISO, endISO).
export function buildPeriods(gran) {
  const now = new Date();
  const out = [];
  if (gran === 'heute') {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    out.push({ key: 'heute', label: 'Heute', startISO: ymd(s), endISO: ymd(addDays(s, 1)) });
  } else if (gran === 'woche') {
    for (let i = 0; i < 16; i++) {
      const { year, week } = isoWeek(addDays(now, -7 * i));
      const mon = isoWeekMonday(year, week);
      out.push({
        key: year + '-W' + week,
        label: (i === 0 ? 'Diese Woche · ' : '') + 'KW ' + week + ' · ' + year,
        startISO: ymd(mon),
        endISO: ymd(addDays(mon, 7)),
      });
    }
  } else if (gran === 'monat') {
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        key: d.getFullYear() + '-M' + d.getMonth(),
        label: MONTHS_FULL[d.getMonth()] + ' ' + d.getFullYear(),
        startISO: ymd(d),
        endISO: ymd(new Date(d.getFullYear(), d.getMonth() + 1, 1)),
      });
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const y = now.getFullYear() - i;
      out.push({ key: '' + y, label: '' + y, startISO: ymd(new Date(y, 0, 1)), endISO: ymd(new Date(y + 1, 0, 1)) });
    }
  }
  return out;
}
