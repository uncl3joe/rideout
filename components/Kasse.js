'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt, isoWeekRange } from '@/lib/format';

const TAX = 0.05;

export default function Kasse() {
  const [orders, setOrders] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [payouts, setPayouts] = useState([]);

  async function load() {
    const sb = createClient();
    const [o, e, p] = await Promise.all([
      sb.from('orders').select('mechanic_id, order_date, umsatz, provision'),
      sb.from('expenses').select('amount'),
      sb.from('provision_payouts').select('mechanic_id, period_key, bonus, paid'),
    ]);
    setOrders(o.data || []);
    setExpenses(e.data || []);
    setPayouts(p.data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const k = useMemo(() => {
    if (!orders) return null;
    const umsatz = orders.reduce((s, o) => s + (o.umsatz || 0), 0);
    const ausgaben = expenses.reduce((s, x) => s + (x.amount || 0), 0);
    const allProv = orders.reduce((s, o) => s + (o.provision || 0), 0);

    // Tatsächlich ausbezahlte Provisionen: Basis (Provision der Aufträge in der
    // jeweiligen Woche) + Bonus, aber nur für als "ausbezahlt" markierte Wochen.
    let paidBase = 0;
    let paidBonus = 0;
    payouts.filter((x) => x.paid).forEach((x) => {
      const r = isoWeekRange(x.period_key);
      const base = r
        ? orders
            .filter((o) => o.mechanic_id === x.mechanic_id && o.order_date >= r.startISO && o.order_date < r.endISO)
            .reduce((s, o) => s + (o.provision || 0), 0)
        : 0;
      paidBase += base;
      paidBonus += x.bonus || 0;
    });
    const paidProv = paidBase + paidBonus;

    // Offene Provisionen = aufgelaufene Basis-Provision, die noch nicht ausbezahlt ist.
    const offeneProv = Math.max(0, allProv - paidBase);
    const realisiert = umsatz - ausgaben - paidProv;
    const steuer = realisiert > 0 ? Math.round(realisiert * TAX) : 0;
    const kassenstand = realisiert - steuer;
    return { umsatz, ausgaben, allProv, paidProv, offeneProv, realisiert, steuer, kassenstand };
  }, [orders, expenses, payouts]);

  const Row = ({ label, value, op, strong, sub }) => (
    <tr style={strong ? { fontWeight: 700 } : undefined}>
      <td className="l" style={{ color: sub ? 'var(--mut)' : undefined }}>{op ? op + ' ' : ''}{label}</td>
      <td className="num" style={{ color: value < 0 ? 'var(--bad, #e5484d)' : undefined }}>{fmt(value)}</td>
    </tr>
  );

  return (
    <>
      <div className="vhead">
        <h2>Kassenstand</h2>
        <span className="vs">Was wirklich in der Kassa liegt</span>
      </div>

      {!k ? (
        <div className="soon"><p>Lädt …</p></div>
      ) : (
        <>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            <div className="kpi rev"><div className="k">Kassenstand</div><div className="v num">{fmt(k.kassenstand)}</div></div>
            <div className="kpi pro"><div className="k">Offene Provisionen</div><div className="v num">{fmt(k.offeneProv)}</div></div>
            <div className="kpi"><div className="k">Steuer-Rücklage (5%)</div><div className="v num">{fmt(k.steuer)}</div></div>
          </div>

          <div className="card" style={{ marginTop: 18, maxWidth: 560 }}>
            <div className="hd"><h2>Rechnung</h2><span className="tag">gesamt</span></div>
            <div className="tw">
              <table className="tbl">
                <tbody>
                  <Row label="Umsatz (alle Aufträge)" value={k.umsatz} op="+" />
                  <Row label="Ausgaben (Großeinkäufe)" value={-k.ausgaben} op="−" />
                  <Row label="Ausbezahlte Provisionen (inkl. Bonus)" value={-k.paidProv} op="−" />
                  <Row label="Realisierter Gewinn" value={k.realisiert} strong />
                  <Row label="Steuer-Rücklage (5%)" value={-k.steuer} op="−" />
                  <Row label="Kassenstand" value={k.kassenstand} strong />
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 10, maxWidth: 560 }}>
            Offene Provisionen ({fmt(k.offeneProv)}) sind noch nicht ausbezahlt und darum noch nicht aus der Kassa raus.
            Die Steuer-Rücklage sind 5% vom realisierten Gewinn. Wenn du die Steuer anders rechnen willst, sag Bescheid.
          </div>
        </>
      )}
    </>
  );
}
