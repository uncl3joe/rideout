'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deleteListing } from '@/app/tausch-actions';

// Backend-Tab (Leitung): zeigt die aktiven Tausch-Inserate und erlaubt das
// Entfernen. Gelesen wird die oeffentliche Ansicht public_trades (wie auf der
// oeffentlichen Seite), geloescht ueber die geschuetzte Server-Action.
export default function TauschAdmin() {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [armed, setArmed] = useState(null);

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  async function load() {
    const sb = createClient();
    const { data } = await sb
      .from('public_trades')
      .select('id, first_name, last_name, phone, offer_model, offer_image, seek_text, seek_image, created_at, expires_at')
      .order('created_at', { ascending: false });
    setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function remove(l) {
    // Erst „scharf schalten", zweiter Klick loescht – ohne Browser-Dialog.
    if (armed !== l.id) { setArmed(l.id); setTimeout(() => setArmed((a) => (a === l.id ? null : a)), 4000); return; }
    setArmed(null);
    setBusyId(l.id);
    const res = await deleteListing({ id: l.id });
    setBusyId(null);
    if (!res.ok) return flash('Fehler: ' + res.error);
    setRows((prev) => prev.filter((x) => x.id !== l.id));
    flash('Inserat entfernt');
  }

  const dateStr = (s) => { try { return new Date(s).toLocaleDateString('de-DE'); } catch { return ''; } };

  return (
    <>
      <div className="vhead"><h2>Tauschbörse</h2><span className="vs">Inserate moderieren</span></div>

      <div className="card">
        <div className="hd"><h2>Aktive Inserate</h2><span className="tag">{rows ? rows.length : 0}</span></div>
        <div className="bd" style={{ fontSize: 13, color: 'var(--mut)', paddingBottom: 4 }}>
          Alle öffentlich sichtbaren Inserate. Inserate laufen 30 Tage und verschwinden danach von selbst. Zum Entfernen zweimal auf „Entfernen" klicken.
        </div>

        {!rows ? (
          <div className="soon"><p>Lädt …</p></div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '0 16px 16px', color: 'var(--faint)', fontSize: 13 }}>Aktuell keine aktiven Inserate.</div>
        ) : (
          <div className="tw">
            <table className="tbl">
              <tbody>
                <tr><th className="l">Foto</th><th className="l">Biete</th><th className="l">Von</th><th className="l">Telefon</th><th className="l">Sucht</th><th>Eingestellt</th><th></th></tr>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td className="l">
                      <div className="ta-av">
                        {l.offer_image
                          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.offer_image} alt={l.offer_model} />
                          : <span>🚗</span>}
                      </div>
                    </td>
                    <td className="l"><b>{l.offer_model}</b></td>
                    <td className="l">{[l.first_name, l.last_name].filter(Boolean).join(' ')}</td>
                    <td className="l" style={{ fontVariantNumeric: 'tabular-nums' }}>{l.phone}</td>
                    <td className="l" style={{ maxWidth: 240, color: 'var(--mut)' }}>{l.seek_text}</td>
                    <td className="num">{dateStr(l.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn"
                        style={armed === l.id ? { padding: '6px 10px', fontSize: 12, borderColor: 'var(--bad)', color: 'var(--bad)' } : { padding: '6px 10px', fontSize: 12 }}
                        disabled={busyId === l.id}
                        onClick={() => remove(l)}
                      >
                        {busyId === l.id ? '…' : (armed === l.id ? 'Wirklich?' : 'Entfernen')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
