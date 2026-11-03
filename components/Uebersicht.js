'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt, numf, periodStartISO, periodLabel, roleBadgeClass, ROLE_LABEL, initials } from '@/lib/format';
import Seg from '@/components/Seg';

const TAX = 0.05;

export default function Uebersicht() {
  const [orders, setOrders] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [period, setPeriod] = useState('woche');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const [o, e, p] = await Promise.all([
        sb.from('orders').select('mechanic_id, order_date, umsatz, material_total, reingewinn, provision'),
        sb.from('expenses').select('expense_date, amount'),
        sb.from('profiles').select('id, name, role'),
      ]);
      if (o.error) setErr(o.error.message);
      setOrders(o.data || []);
      setExpenses(e.data || []);
      setProfiles(p.data || []);
    })();
  }, []);

  const start = periodStartISO(period);

  const data = useMemo(() => {
    if (!orders) return null;
    const o = orders.filter((x) => x.order_date >= start);
    const ex = expenses.filter((x) => x.expense_date >= start);
    const umsatz = o.reduce((s, x) => s + x.umsatz, 0);
    const prov = o.reduce((s, x) => s + x.provision, 0);
    const ausg = ex.reduce((s, x) => s + x.amount, 0);
    const rein = umsatz - ausg;
    const nachProv = rein - prov;
    const steuer = nachProv > 0 ? nachProv * TAX : 0;
    const netto = nachProv - steuer;

    const byMech = {};
    o.forEach((x) => {
      const m = byMech[x.mechanic_id] || (byMech[x.mechanic_id] = { auf: 0, um: 0, prov: 0 });
      m.auf += 1;
      m.um += x.umsatz;
      m.prov += x.provision;
    });
    const prof = (id) => profiles.find((y) => y.id === id);
    const rows = Object.entries(byMech)
      .map(([id, m]) => ({ id, name: prof(id)?.name || '—', role: prof(id)?.role || 'mechaniker', ...m }))
      .sort((a, b) => b.um - a.um);

    return { umsatz, prov, ausg, rein, netto, rows };
  }, [orders, expenses, profiles, start]);

  return (
    <>
      <div className="vhead">
        <h2>Übersicht</h2>
        <span className="vs">Ganze Werkstatt</span>
        <Seg value={period} onChange={setPeriod} />
      </div>

      {err && <div className="soon"><p>Konnte Daten nicht laden: {err}</p></div>}

      {!data ? (
        <div className="soon"><p>Lädt …</p></div>
      ) : (
        <>
          <div className="kpis five">
            <div className="kpi rev"><div className="k">Umsatz</div><div className="v num">{fmt(data.umsatz)}</div></div>
            <div className="kpi"><div className="k">Ausgaben</div><div className="v num">{fmt(data.ausg)}</div></div>
            <div className="kpi"><div className="k">Reingewinn</div><div className="v num">{fmt(data.rein)}</div></div>
            <div className="kpi pro"><div className="k">Provisionen</div><div className="v num">{fmt(data.prov)}</div></div>
            <div className="kpi"><div className="k">Netto (n. Steuer)</div><div className="v num">{fmt(data.netto)}</div></div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="hd">
              <h2>Leistung pro Mechaniker</h2>
              <span className="tag">{periodLabel(period)}</span>
            </div>
            <div className="tw">
              <table className="tbl">
                <tbody>
                  <tr>
                    <th className="l">Mechaniker</th>
                    <th className="l">Rang</th>
                    <th>Aufträge</th>
                    <th>Umsatz</th>
                    <th>Provision</th>
                  </tr>
                  {data.rows.length === 0 ? (
                    <tr><td className="l" colSpan={5} style={{ color: 'var(--faint)' }}>Keine Aufträge in diesem Zeitraum.</td></tr>
                  ) : (
                    data.rows.map((m) => (
                      <tr key={m.id}>
                        <td className="l">
                          <div className="who2"><div className="ava">{initials(m.name)}</div><div>{m.name}</div></div>
                        </td>
                        <td className="l"><span className={'badge ' + roleBadgeClass(m.role)}>{ROLE_LABEL[m.role] || m.role}</span></td>
                        <td className="num">{m.auf}</td>
                        <td className="num umc">{fmt(m.um)}</td>
                        <td className="num pvc">{fmt(m.prov)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
