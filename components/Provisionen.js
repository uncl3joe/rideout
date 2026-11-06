'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt, numf, buildPeriods, initials } from '@/lib/format';
import { savePayout } from '@/app/manage-actions';

export default function Provisionen() {
  const weeks = useMemo(() => buildPeriods('woche'), []);
  const [periodKey, setPeriodKey] = useState(() => weeks[0].key);
  const [orders, setOrders] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [pay, setPay] = useState({}); // mechId -> { bonus, paid } für die gewählte Woche
  const [msg, setMsg] = useState('');

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2600);
  }

  async function load() {
    const sb = createClient();
    const [o, p, pay] = await Promise.all([
      sb.from('orders').select('mechanic_id, mechanic_name, order_date, provision'),
      sb.from('profiles').select('id, name'),
      sb.from('provision_payouts').select('mechanic_id, period_key, bonus, paid'),
    ]);
    setOrders(o.data || []);
    setProfiles(p.data || []);
    setPayouts(pay.data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const sel = weeks.find((w) => w.key === periodKey) || weeks[0];

  // pay-Map für die gewählte Woche aus den geladenen Payouts aufbauen.
  useEffect(() => {
    const m = {};
    payouts.filter((x) => x.period_key === periodKey).forEach((x) => {
      m[x.mechanic_id] = { bonus: x.bonus || 0, paid: !!x.paid };
    });
    setPay(m);
  }, [payouts, periodKey]);

  const nameOf = (id) =>
    profiles.find((p) => p.id === id)?.name ||
    (orders || []).find((o) => o.mechanic_id === id)?.mechanic_name ||
    '—';

  const rows = useMemo(() => {
    if (!orders || !sel) return [];
    const base = {};
    orders
      .filter((o) => o.order_date >= sel.startISO && o.order_date < sel.endISO)
      .forEach((o) => {
        const b = base[o.mechanic_id] || (base[o.mechanic_id] = { auf: 0, prov: 0 });
        b.auf += 1;
        b.prov += o.provision || 0;
      });
    // Mechaniker mit Basis-Provision ODER mit erfasstem Bonus/Auszahlung.
    const ids = new Set(Object.keys(base));
    Object.keys(pay).forEach((id) => {
      if ((pay[id].bonus || 0) !== 0 || pay[id].paid) ids.add(id);
    });
    return [...ids]
      .map((id) => {
        const bonus = Number(pay[id]?.bonus || 0);
        const prov = base[id]?.prov || 0;
        return { id, name: nameOf(id), auf: base[id]?.auf || 0, prov, bonus, gesamt: prov + bonus, paid: !!pay[id]?.paid };
      })
      .sort((a, b) => b.gesamt - a.gesamt);
  }, [orders, sel, pay, profiles]);

  const totals = useMemo(() => ({
    prov: rows.reduce((s, r) => s + r.prov, 0),
    bonus: rows.reduce((s, r) => s + r.bonus, 0),
    gesamt: rows.reduce((s, r) => s + r.gesamt, 0),
  }), [rows]);

  async function persist(id, next) {
    setPay((prev) => ({ ...prev, [id]: next }));
    const res = await savePayout({ mechanicId: id, periodKey, bonus: next.bonus, paid: next.paid });
    if (!res.ok) return flash('Fehler: ' + res.error);
    // lokale payouts-Liste aktualisieren, damit der Wochenwechsel konsistent bleibt
    setPayouts((prev) => {
      const rest = prev.filter((x) => !(x.mechanic_id === id && x.period_key === periodKey));
      return [...rest, { mechanic_id: id, period_key: periodKey, bonus: next.bonus, paid: next.paid }];
    });
  }

  function setBonus(id, val) {
    setPay((prev) => ({ ...prev, [id]: { bonus: val === '' ? '' : Math.round(Number(val) || 0), paid: !!prev[id]?.paid } }));
  }
  function commitBonus(id) {
    const cur = pay[id] || { bonus: 0, paid: false };
    persist(id, { bonus: Math.round(Number(cur.bonus) || 0), paid: !!cur.paid });
  }
  function togglePaid(id) {
    const cur = pay[id] || { bonus: 0, paid: false };
    persist(id, { bonus: Math.round(Number(cur.bonus) || 0), paid: !cur.paid });
  }

  function exportCsv() {
    const head = ['Mechaniker', 'Auftraege', 'Basis-Provision', 'Bonus', 'Gesamt', 'Ausbezahlt'];
    const lines = rows.map((r) => [r.name, r.auf, r.prov, r.bonus, r.gesamt, r.paid ? 'ja' : 'nein']);
    lines.push(['GESAMT', '', totals.prov, totals.bonus, totals.gesamt, '']);
    const csv = [head, ...lines]
      .map((row) => row.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';'))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'provisionen_' + periodKey + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="vhead">
        <h2>Provisionen</h2>
        <span className="vs">Wöchentliche Abrechnung</span>
        <select className="psel" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} aria-label="Woche wählen">
          {weeks.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
        </select>
        <button className="btn" style={{ padding: '7px 12px', fontSize: 12.5 }} onClick={exportCsv}>CSV exportieren</button>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="kpi pro"><div className="k">Basis-Provision</div><div className="v num">{fmt(totals.prov)}</div></div>
        <div className="kpi"><div className="k">Bonus / Sonderzahlung</div><div className="v num">{fmt(totals.bonus)}</div></div>
        <div className="kpi rev"><div className="k">Auszuzahlen gesamt</div><div className="v num">{fmt(totals.gesamt)}</div></div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="hd"><h2>Abrechnung</h2><span className="tag">{sel?.label}</span></div>
        <div className="tw">
          <table className="tbl">
            <tbody>
              <tr>
                <th className="l">Mechaniker</th>
                <th>Aufträge</th>
                <th>Basis-Provision</th>
                <th>Bonus</th>
                <th>Gesamt</th>
                <th>Ausbezahlt</th>
              </tr>
              {!orders ? (
                <tr><td className="l" colSpan={6} style={{ color: 'var(--faint)' }}>Lädt …</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="l" colSpan={6} style={{ color: 'var(--faint)' }}>Keine Provisionen in dieser Woche.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={r.paid ? { opacity: 0.7 } : undefined}>
                    <td className="l"><div className="who2"><div className="ava">{initials(r.name)}</div><div>{r.name}</div></div></td>
                    <td className="num">{r.auf}</td>
                    <td className="num pvc">{fmt(r.prov)}</td>
                    <td>
                      <input className="vkin" type="number" value={pay[r.id]?.bonus ?? 0}
                        onChange={(e) => setBonus(r.id, e.target.value)}
                        onBlur={() => commitBonus(r.id)} />
                    </td>
                    <td className="num umc">{fmt(r.gesamt)}</td>
                    <td>
                      <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer', justifyContent: 'center', width: '100%' }}>
                        <input type="checkbox" checked={r.paid} onChange={() => togglePaid(r.id)} />
                        <span style={{ fontSize: 12 }}>{r.paid ? 'ja' : 'offen'}</span>
                      </label>
                    </td>
                  </tr>
                ))
              )}
              {rows.length > 0 && (
                <tr>
                  <td className="l"><b>Gesamt</b></td>
                  <td></td>
                  <td className="num pvc"><b>{fmt(totals.prov)}</b></td>
                  <td className="num"><b>{fmt(totals.bonus)}</b></td>
                  <td className="num umc"><b>{fmt(totals.gesamt)}</b></td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10 }}>
        Basis-Provision kommt automatisch aus den Aufträgen der Woche. Bonus und Haken „ausbezahlt" werden pro Woche gespeichert.
      </div>

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
