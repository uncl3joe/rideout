// Gemeinsame Helfer fuer die Bieter-Sperren. Wird sowohl serverseitig
// (Server-Actions, Sperrpruefung) als auch im Browser (Bieter-Check) genutzt,
// damit ein Wert ueberall gleich normalisiert wird.

export const BAN_KINDS = ['ic', 'discord', 'ip', 'device'];

export const BAN_LABEL = {
  ic: 'IC-Name',
  discord: 'Discord',
  ip: 'IP-Adresse',
  device: 'Browser',
};

// Normalisiert einen Wert fuer Speicherung und Vergleich.
// IC-Name und Discord case-insensitiv (Leerzeichen zusammengefasst),
// IP und Browser-Kennung exakt wie gespeichert (nur getrimmt).
export function normBanValue(kind, value) {
  const v = String(value || '').replace(/\s+/g, ' ').trim();
  if (kind === 'ip' || kind === 'device') return v;
  return v.toLowerCase();
}

// Schluessel fuer eine Sperre, zum Nachschlagen in einem Set.
export function banKey(kind, value) {
  return kind + ':' + normBanValue(kind, value);
}
