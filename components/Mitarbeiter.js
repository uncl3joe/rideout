'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createMechanic, deleteMechanic } from '@/app/admin-actions';
import { fmt, ROLES, ROLE_LABEL, roleBadgeClass, initials } from '@/lib/format';

export default function Mitarbeiter({ role }) {
  const admin = role === 'inhaber';
  const [profiles, setProfiles] = useState(null);
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [nf, setNf] = useState({ name: '', email: '', password: '', role: 'mechaniker' });

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  }

  async function load() {
    const sb = createClient();
    const [p, o] = await Promise.all([
      sb.from('profiles').select('id, name, role').order('name'),
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
    if (error) return flash('Fehler: ' + error.message);
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, role: newRole } : p)));
    flash('Rang geändert ✓');
  }

  function editName(id, value) {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, name: value } : p)));
  }
  async function commitName(id, value) {
    const sb = createClient();
    const { error } = await sb.from('profiles').update({ name: value.trim() }).eq('id', id);
    if (error) flash('Fehler: ' + error.message);
    else flash('Name gespeichert ✓');
  }

  async function add() {
    if (!nf.name.trim() || !nf.email.trim() || !nf.password) return flash('Name, E-Mail und Passwort angeben.');
    setBusy(true);
    const res = await createMechanic(nf);
    setBusy(false);
    if (!res.ok) return flash('Fehler: ' + res.error);
    setNf({ name: '', email: '', password: '', role: 'mechaniker' });
    flash('Mitarbeiter angelegt ✓');
    load();
  }

  async function remove(id, name) {
    if (!confirm('„' + (name || 'Mitarbeiter') + '" wirklich löschen? Der Login wird endgültig entfernt.')) return;
    const res = await deleteMechanic({ id });
    if (!res.ok) return flash('Fehler: ' + res.error);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    flash('Mitarbeiter gelöscht');
  }

  const rights = [
    ['Eigenes Terminal', 'alle Ränge'],
    ['Verträge', 'Manager, Werkstattleitung, Inhaber'],
    ['Autohandel (Phase 3)', 'Manager, Werkstattleitung, Inhaber'],
    ['Übersicht + Statistik', 'Werkstattleitung, Inhaber'],
    ['Mitarbeiter + Ausgaben', 'Werkstattleitung, Inhaber'],
    ['Mitarbeiter verwalten + Katalog', 'Inhaber'],
  ];

  return (
    <>
      <div className="vhead">
        <h2>Mitarbeiter</h2>
        <span className="vs">Team, Ränge &amp; Rechte</span>
      </div>

      {admin && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="hd"><h2>Mitarbeiter anlegen</h2><span className="tag">nur Inhaber</span></div>
          <div className="bd">
            <div className="fields" style={{ gridTemplateColumns: '1.2fr 1.4fr 1fr 1fr auto', marginTop: 0, alignItems: 'end' }}>
              <div className="field"><label>Name</label><input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="Vor- und Nachname" /></div>
              <div className="field"><label>E-Mail (Login)</label><input type="email" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} placeholder="name@roc.at" /></div>
              <div className="field"><label>Passwort</label><input value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} placeholder="min. 6 Zeichen" /></div>
              <div className="field"><label>Rang</label>
                <select value={nf.role} onChange={(e) => setNf({ ...nf, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <button className="save" style={{ marginTop: 0, width: 'auto', padding: '10px 16px', fontSize: 13 }} onClick={add} disabled={busy}>
                {busy ? '…' : 'Anlegen'}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>
              Der Mitarbeiter meldet sich dann mit dieser E-Mail und dem Passwort an. Du kannst Namen und Rang jederzeit unten ändern.
            </div>
          </div>
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
                    {admin && <th></th>}
                  </tr>
                  {profiles.map((p) => (
                    <tr key={p.id}>
                      <td className="l">
                        <div className="who2">
                          <div className="ava">{initials(p.name)}</div>
                          {admin ? (
                            <input className="rolesel" style={{ width: 180 }} value={p.name || ''}
                              onChange={(e) => editName(p.id, e.target.value)}
                              onBlur={(e) => commitName(p.id, e.target.value)} />
                          ) : (
                            <div>{p.name || '—'}</div>
                          )}
                        </div>
                      </td>
                      <td className="l">
                        {admin ? (
                          <select className="rolesel" value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}>
                            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                          </select>
                        ) : (
                          <span className={'badge ' + roleBadgeClass(p.role)}>{ROLE_LABEL[p.role] || p.role}</span>
                        )}
                      </td>
                      <td className="num">{agg[p.id]?.auf || 0}</td>
                      <td className="num umc">{fmt(agg[p.id]?.um || 0)}</td>
                      {admin && <td><button className="xdel" title="Löschen" onClick={() => remove(p.id, p.name)}>✕</button></td>}
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
                    <tr key={r[0]}><td className="l">{r[0]}</td><td className="l" style={{ color: 'var(--mut)' }}>{r[1]}</td></tr>
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
