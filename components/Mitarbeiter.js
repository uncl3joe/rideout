'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createMechanic, deleteMechanicPlaceholder, setMechanicActive, setProvisionRate } from '@/app/admin-actions';
import { fmt, ROLES, ROLE_LABEL, roleBadgeClass, initials } from '@/lib/format';

export default function Mitarbeiter({ role, myId }) {
  const admin = role === 'inhaber';
  const [profiles, setProfiles] = useState(null);
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showFormer, setShowFormer] = useState(false);
  const [nf, setNf] = useState({ name: '', email: '', password: '', role: 'mechaniker' });

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  }

  async function load() {
    const sb = createClient();
    const [p, o] = await Promise.all([
      sb.from('profiles').select('id, name, role, active, archived, provision_rate').order('name'),
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

  const visible = useMemo(() => {
    if (!profiles) return null;
    return profiles.filter((p) => (showFormer ? true : p.active !== false));
  }, [profiles, showFormer]);

  const formerCount = useMemo(() => (profiles || []).filter((p) => p.active === false).length, [profiles]);

  const statusOf = (p) => (p.archived ? 'Ehemalig' : p.active === false ? 'Inaktiv' : 'Aktiv');

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

  function editRate(id, pct) {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, provision_rate: pct === '' ? '' : Number(pct) / 100 } : p)));
  }
  async function commitRate(id, pct) {
    const r = Math.min(100, Math.max(0, Math.round(Number(pct) || 0))) / 100;
    const res = await setProvisionRate({ id, rate: r });
    if (!res.ok) return flash('Fehler: ' + res.error);
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, provision_rate: r } : p)));
    flash('Provisionssatz gespeichert ✓');
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

  async function toggleActive(p) {
    const res = await setMechanicActive({ id: p.id, active: p.active === false });
    if (!res.ok) return flash('Fehler: ' + res.error);
    flash(p.active === false ? 'Mitarbeiter aktiviert ✓' : 'Mitarbeiter deaktiviert');
    load();
  }

  async function removePlaceholder(p) {
    if (!confirm('„' + (p.name || 'Mitarbeiter') + '" endgültig löschen? Der Login wird gesperrt und die E-Mail wieder freigegeben, die Zahlen bleiben als Platzhalter erhalten.')) return;
    const res = await deleteMechanicPlaceholder({ id: p.id });
    if (!res.ok) return flash('Fehler: ' + res.error);
    flash(res.emailFreed ? 'Gelöscht ✓ E-Mail ist wieder frei' : 'Gelöscht (E-Mail konnte nicht freigegeben werden)');
    load();
  }

  const rights = [
    ['Eigenes Terminal', 'alle Ränge'],
    ['Aufträge ansehen', 'Werkstattleitung, Inhaber'],
    ['Verträge ansehen', 'Manager, Werkstattleitung, Inhaber'],
    ['Autohandel', 'Manager, Werkstattleitung, Inhaber'],
    ['Übersicht + Statistik', 'Werkstattleitung, Inhaber'],
    ['Aufträge / Ausgaben / Verträge bearbeiten', 'nur Inhaber'],
    ['Ausgaben + Provisionen', 'nur Inhaber'],
    ['Mitarbeiter verwalten + Katalog', 'nur Inhaber'],
  ];

  const pct = (r) => (r === '' || r == null ? '' : Math.round(Number(r) * 100));

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
              Der Mitarbeiter meldet sich mit dieser E-Mail und dem Passwort an. Name, Rang und Provisionssatz kannst du unten jederzeit ändern.
            </div>
          </div>
        </div>
      )}

      {!visible ? (
        <div className="soon"><p>Lädt …</p></div>
      ) : (
        <>
          <div className="card">
            <div className="hd">
              <h2>Team</h2>
              <span className="tag">{visible.length} angezeigt{formerCount ? ' · ' + formerCount + ' ehemalig' : ''}</span>
            </div>

            {formerCount > 0 && (
              <div style={{ padding: '2px 16px 10px' }}>
                <label style={{ fontSize: 12.5, color: 'var(--mut)', display: 'inline-flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showFormer} onChange={(e) => setShowFormer(e.target.checked)} />
                  Ehemalige / deaktivierte anzeigen
                </label>
              </div>
            )}

            <div className="tw">
              <table className="tbl">
                <tbody>
                  <tr>
                    <th className="l">Name</th>
                    <th className="l">Rang</th>
                    {admin && <th>Provision %</th>}
                    <th>Aufträge</th>
                    <th>Umsatz gesamt</th>
                    <th className="l">Status</th>
                    {admin && <th></th>}
                  </tr>
                  {visible.map((p) => {
                    const inactive = p.active === false;
                    const self = p.id === myId;
                    return (
                      <tr key={p.id} style={inactive ? { opacity: 0.6 } : undefined}>
                        <td className="l">
                          <div className="who2">
                            <div className="ava">{initials(p.name)}</div>
                            {admin && !inactive ? (
                              <input className="rolesel" style={{ width: 170 }} value={p.name || ''}
                                onChange={(e) => editName(p.id, e.target.value)}
                                onBlur={(e) => commitName(p.id, e.target.value)} />
                            ) : (
                              <div>{p.name || '—'}</div>
                            )}
                          </div>
                        </td>
                        <td className="l">
                          {admin && !inactive ? (
                            <select className="rolesel" value={p.role} onChange={(e) => changeRole(p.id, e.target.value)}>
                              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                            </select>
                          ) : (
                            <span className={'badge ' + roleBadgeClass(p.role)}>{ROLE_LABEL[p.role] || p.role}</span>
                          )}
                        </td>
                        {admin && (
                          <td>
                            {inactive ? (
                              <span style={{ color: 'var(--faint)' }}>{pct(p.provision_rate)}%</span>
                            ) : (
                              <input className="vkin" type="number" min="0" max="100" value={pct(p.provision_rate)}
                                onChange={(e) => editRate(p.id, e.target.value)}
                                onBlur={(e) => commitRate(p.id, e.target.value)} />
                            )}
                          </td>
                        )}
                        <td className="num">{agg[p.id]?.auf || 0}</td>
                        <td className="num umc">{fmt(agg[p.id]?.um || 0)}</td>
                        <td className="l">
                          <span className={'badge ' + (p.archived ? 'pra' : inactive ? 'mec' : 'lei')}>{statusOf(p)}</span>
                        </td>
                        {admin && (
                          <td>
                            {self ? (
                              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>du</span>
                            ) : p.archived ? (
                              <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>gelöscht</span>
                            ) : (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                {inactive ? (
                                  <button className="btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => toggleActive(p)}>Aktivieren</button>
                                ) : (
                                  <button className="btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => toggleActive(p)}>Deaktivieren</button>
                                )}
                                <button className="xdel" title="Löschen (Platzhalter, E-Mail wird frei)" onClick={() => removePlaceholder(p)}>✕</button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
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
