'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt, buildPeriods, roleBadgeClass, ROLE_LABEL, initials } from '@/lib/format';
import Seg from '@/components/Seg';

const TAX = 0.05;

export default function Uebersicht({ role }) {
  // Kassen-Zahlen (Ausgaben/Reingewinn/Netto) und fremde Provisionen nur für die Leitungsebene.
  const canMoney = ['manager', 'werkstattleitung', 'inhaber'].includes(role);
  const [orders, setOrders] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [gran, setGran] = useState('woche');
  const [periodKey, setPeriodKey] = useState(() => buildPeriods('woche')[0].key);
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

  const opts = useMemo(() => buildPeriods(gran), [gran]);
  const sel = opts.find((o) => o.key === periodKey) || opts[0];
  function changeGran(g) {
    setGran(g);
    setPeriodKey(buildPeriods(g)[0].key);
  }

  const data = useMemo(() => {
    if (!orders || !sel) return null;
    const inRange = (d) => d >= sel.startISO && d < sel.endISO;
    const o = orders.filter((x) => inRange(x.order_date));
    const ex = expenses.filter((x) => inRange(x.expense_date));
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
  }, [orders, expenses, profiles, sel]);

  return (
    <>
      <div className="vhead">
        <h2>Übersicht</h2>
        <span className="vs">Ganze Werkstatt</span>
        <Seg value={gran} onChange={changeGran} />
        <select className="psel" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} aria-label="Zeitraum wählen">
          {opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {err && <div className="soon"><p>Konnte Daten nicht laden: {err}</p></div>}

      {!data ? (
        <div className="soon"><p>Lädt …</p></div>
      ) : (
        <>
          <div className={'kpis ' + (canMoney ? 'five' : '')} style={canMoney ? undefined : { gridTemplateColumns: '1fr', maxWidth: 260 }}>
            <div className="kpi rev"><div className="k">Umsatz</div><div className="v num">{fmt(data.umsatz)}</div></div>
            {canMoney && <div className="kpi"><div className="k">Ausgaben</div><div className="v num">{fmt(data.ausg)}</div></div>}
            {canMoney && <div className="kpi"><div className="k">Reingewinn</div><div className="v num">{fmt(data.rein)}</div></div>}
            {canMoney && <div className="kpi pro"><div className="k">Provisionen</div><div className="v num">{fmt(data.prov)}</div></div>}
            {canMoney && <div className="kpi"><div className="k">Netto (n. Steuer)</div><div className="v num">{fmt(data.netto)}</div></div>}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="hd">
              <h2>Leistung pro Mechaniker</h2>
              <span className="tag">{sel?.label}</span>
            </div>
            <div className="tw">
              <table className="tbl">
                <tbody>
                  <tr>
                    <th className="l">Mechaniker</th>
                    <th className="l">Rang</th>
                    <th>Aufträge</th>
                    <th>Umsatz</th>
                    {canMoney && <th>Provision</th>}
                  </tr>
                  {data.rows.length === 0 ? (
                    <tr><td className="l" colSpan={canMoney ? 5 : 4} style={{ color: 'var(--faint)' }}>Keine Aufträge in diesem Zeitraum.</td></tr>
                  ) : (
                    data.rows.map((m) => (
                      <tr key={m.id}>
                        <td className="l"><div className="who2"><div className="ava">{initials(m.name)}</div><div>{m.name}</div></div></td>
                        <td className="l"><span className={'badge ' + roleBadgeClass(m.role)}>{ROLE_LABEL[m.role] || m.role}</span></td>
                        <td className="num">{m.auf}</td>
                        <td className="num umc">{fmt(m.um)}</td>
                        {canMoney && <td className="num pvc">{fmt(m.prov)}</td>}
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
