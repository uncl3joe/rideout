'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt, ROLES, ROLE_LABEL, roleBadgeClass, initials } from '@/lib/format';

export default function Mitarbeiter({ role }) {
  const admin = role === 'inhaber';
  const [profiles, setProfiles] = useState(null);
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState('');

  async function load() {
    const sb = createClient();
    const [p, o] = await Promise.all([
      sb.from('profiles').select('id, name, role, active').order('name'),
      sb.from('orders').select('mechanic_id, umsatz'),
    ]);
    setProfiles(p.data || []);
    setOrders(o.data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const agg = useMemo(() => {
    const m = {};
    orders.forEach((o) => {
      const a = m[o.mechanic_id] || (m[o.mechanic_id] = { auf: 0, um: 0 });
      a.auf += 1;
      a.um += o.umsatz;
    });
    return m;
  }, [orders]);

  async function changeRole(id, newRole) {
    const sb = createClient();
    const { error } = await sb.from('profiles').update({ role: newRole }).eq('id', id);
    if (error) {
      setMsg('Fehler: ' + error.message);
      return;
    }
    setMsg('Rang geändert ✓');
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role: newRole } : p)));
    setTimeout(() => setMsg(''), 2500);
  }

  const rights = [
    ['Eigenes Terminal', 'alle Ränge'],
    ['Verträge', 'Manager, Werkstattleitung, Inhaber'],
    ['Autohandel (Phase 3)', 'Manager, Werkstattleitung, Inhaber'],
    ['Übersicht + Statistik', 'Werkstattleitung, Inhaber'],
    ['Mitarbeiter + Ausgaben', 'Werkstattleitung, Inhaber'],
    ['Rang vergeben + Katalog pflegen', 'Inhaber'],
  ];

  return (
    <>
      <div className="vhead">
        <h2>Mitarbeiter</h2>
        <span className="vs">Team &amp; Rechte</span>
      </div>

      {admin && (
        <div className="soon" style={{ textAlign: 'left', padding: '16px 18px', marginBottom: 18 }}>
          <p style={{ margin: 0 }}>
            <b>Neuen Login anlegen:</b> aktuell legst du neue Mitarbeiter in Supabase unter
            {' '}<b>Authentication → Users</b> an (wie bei dir) und vergibst ihnen hier den Rang.
            Das „Anlegen/Löschen direkt hier" bauen wir als nächsten kleinen Schritt ein.
          </p>
        </div>
      )}

      {!profiles ? (
        <div className="soon"><p>Lädt …</p></div>
      ) : (
        <>
          <div className="card">
            <div className="hd"><h2>Team</h2><span className="tag">{profiles.length} Mitarbeiter</span></div>
            <div className="tw">
              <table className="tbl">
                <tbody>
                  <tr>
                    <th className="l">Name</th>
                    <th className="l">Rang</th>
                    <th>Aufträge</th>
                    <th>Umsatz gesamt</th>
                  </tr>
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td className="l">
                        <div className="who2"><div className="ava">{initials(p.name)}</div><div>{p.name || '—'}</div></div>
                      </td>
                      <td className="l">
                        {admin ? (
                          <select className="rolesel" value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}>
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={'badge ' + roleBadgeClass(p.role)}>{ROLE_LABEL[p.role] || p.role}</span>
                        )}
                      </td>
                      <td className="num">{agg[p.id]?.auf || 0}</td>
                      <td className="num umc">{fmt(agg[p.id]?.um || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="hd"><h2>Rollen &amp; Rechte</h2><span className="tag">wer darf was</span></div>
            <div className="tw">
              <table className="tbl">
                <tbody>
                  <tr><th className="l">Funktion</th><th className="l">Wer darf</th></tr>
                  {rights.map((r) => (
                    <tr key={r[0]}>
                      <td className="l">{r[0]}</td>
                      <td className="l" style={{ color: 'var(--mut)' }}>{r[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
