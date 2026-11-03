'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { numf, periodStartISO, periodLabel } from '@/lib/format';
import Seg from '@/components/Seg';

export default function Statistik() {
  const [items, setItems] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [period, setPeriod] = useState('woche');
  const [mech, setMech] = useState('');

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const [it, p] = await Promise.all([
        sb.from('order_items').select('service_name, category, qty, unit_material, orders(order_date, mechanic_id)'),
        sb.from('profiles').select('id, name'),
      ]);
      setItems(it.data || []);
      setProfiles(p.data || []);
    })();
  }, []);

  const start = periodStartISO(period);

  const agg = useMemo(() => {
    if (!items) return null;
    const rows = items.filter(
      (x) => x.orders && x.orders.order_date >= start && (!mech || x.orders.mechanic_id === mech)
    );
    const svc = {};
    const cat = {};
    rows.forEach((x) => {
      svc[x.service_name] = (svc[x.service_name] || 0) + x.qty;
      cat[x.category] = (cat[x.category] || 0) + x.qty;
    });
    const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 9);
    return { svc: top(svc), cat: top(cat), total: rows.length };
  }, [items, start, mech]);

  const bars = (rows, blu) => {
    if (!rows || !rows.length) return <div style={{ color: 'var(--faint)', fontSize: 13 }}>Keine Daten in diesem Zeitraum.</div>;
    const max = rows[0][1] || 1;
    return (
      <div className="bar">
        {rows.map(([n, c]) => (
          <div className={'brow' + (blu ? ' blu' : '')} key={n}>
            <span className="bn">{n}</span>
            <span className="bt"><i style={{ width: Math.round((c / max) * 100) + '%' }} /></span>
            <span className="bc">{numf(c)}×</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="vhead">
        <h2>Statistik</h2>
        <span className="vs">Teile &amp; Leistungen</span>
        <Seg value={period} onChange={setPeriod} />
      </div>

      <div className="field" style={{ maxWidth: 280, marginBottom: 16 }}>
        <label htmlFor="stMech">Mechaniker</label>
        <select id="stMech" value={mech} onChange={(e) => setMech(e.target.value)}>
          <option value="">Alle Mechaniker</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {!agg ? (
        <div className="soon"><p>Lädt …</p></div>
      ) : (
        <div className="grid">
          <div className="card">
            <div className="hd"><h2>Top Leistungen</h2><span className="tag">{periodLabel(period)}</span></div>
            <div className="bd">{bars(agg.svc, false)}</div>
          </div>
          <div className="card">
            <div className="hd"><h2>Nach Kategorie</h2><span className="tag">{periodLabel(period)}</span></div>
            <div className="bd">{bars(agg.cat, true)}</div>
          </div>
        </div>
      )}
    </>
  );
}
