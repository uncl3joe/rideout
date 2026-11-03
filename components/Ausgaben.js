'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt } from '@/lib/format';

const todayISO = () => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
};

export default function Ausgaben() {
  const [rows, setRows] = useState(null);
  const [d, setD] = useState(todayISO());
  const [b, setB] = useState('');
  const [a, setA] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const sb = createClient();
    const { data } = await sb.from('expenses').select('id, expense_date, description, amount').order('expense_date', { ascending: false });
    setRows(data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const total = useMemo(() => (rows || []).reduce((s, x) => s + x.amount, 0), [rows]);

  async function add() {
    const amount = Math.round(Number(a) || 0);
    if (!b.trim() || amount <= 0) {
      setMsg('Beschreibung und Betrag angeben');
      setTimeout(() => setMsg(''), 2000);
      return;
    }
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from('expenses').insert({ expense_date: d, description: b.trim(), amount });
    setBusy(false);
    if (error) {
      setMsg('Fehler: ' + error.message);
      return;
    }
    setB('');
    setA('');
    setMsg('Ausgabe gebucht ✓');
    setTimeout(() => setMsg(''), 2500);
    load();
  }

  return (
    <>
      <div className="vhead">
        <h2>Ausgaben</h2>
        <span className="vs">Großeinkäufe als eine Zeile</span>
      </div>

      <div className="card">
        <div className="hd"><h2>Neue Ausgabe</h2></div>
        <div className="bd">
          <div className="fields" style={{ gridTemplateColumns: '1fr 1.6fr 1fr auto', marginTop: 0, alignItems: 'end' }}>
            <div className="field"><label>Datum</label><input type="date" value={d} onChange={(e) => setD(e.target.value)} /></div>
            <div className="field"><label>Beschreibung</label><input value={b} onChange={(e) => setB(e.target.value)} placeholder="z. B. Großeinkauf Teile" /></div>
            <div className="field"><label>Betrag</label><input className="num" type="number" min="0" value={a} onChange={(e) => setA(e.target.value)} placeholder="0" /></div>
            <button className="save" style={{ marginTop: 0, width: 'auto', padding: '10px 16px', fontSize: 13 }} onClick={add} disabled={busy}>Hinzufügen</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="hd"><h2>Ausgaben</h2><span className="tag">Gesamt {fmt(total)}</span></div>
        <div className="tw">
          <table className="tbl">
            <tbody>
              <tr><th className="l">Datum</th><th className="l">Beschreibung</th><th>Betrag</th></tr>
              {!rows ? (
                <tr><td className="l" colSpan={3} style={{ color: 'var(--faint)' }}>Lädt …</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="l" colSpan={3} style={{ color: 'var(--faint)' }}>Noch keine Ausgaben.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="l num">{r.expense_date}</td>
                    <td className="l">{r.description}</td>
                    <td className="num">{fmt(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
