'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt, todayISO } from '@/lib/format';
import { addExpense, editExpense, deleteExpense } from '@/app/manage-actions';

export default function Ausgaben({ role }) {
  const admin = role === 'inhaber';
  const [rows, setRows] = useState(null);
  const [d, setD] = useState(todayISO());
  const [b, setB] = useState('');
  const [a, setA] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(null); // { id, expense_date, description, amount }

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

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
    if (!b.trim() || amount <= 0) return flash('Beschreibung und Betrag angeben');
    setBusy(true);
    const res = await addExpense({ date: d, description: b, amount });
    setBusy(false);
    if (!res.ok) return flash('Fehler: ' + res.error);
    setB('');
    setA('');
    flash('Ausgabe gebucht ✓');
    load();
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true);
    const res = await editExpense({ id: edit.id, date: edit.expense_date, description: edit.description, amount: edit.amount });
    setBusy(false);
    if (!res.ok) return flash('Fehler: ' + res.error);
    setEdit(null);
    flash('Ausgabe gespeichert ✓');
    load();
  }

  async function remove(r) {
    if (!confirm('Ausgabe „' + r.description + '" (' + fmt(r.amount) + ') wirklich löschen?')) return;
    const res = await deleteExpense({ id: r.id });
    if (!res.ok) return flash('Fehler: ' + res.error);
    flash('Ausgabe gelöscht');
    load();
  }

  return (
    <>
      <div className="vhead">
        <h2>Ausgaben</h2>
        <span className="vs">Großeinkäufe als eine Zeile</span>
      </div>

      {admin && (
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
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="hd"><h2>Ausgaben</h2><span className="tag">Gesamt {fmt(total)}</span></div>
        <div className="tw">
          <table className="tbl">
            <tbody>
              <tr><th className="l">Datum</th><th className="l">Beschreibung</th><th>Betrag</th>{admin && <th></th>}</tr>
              {!rows ? (
                <tr><td className="l" colSpan={admin ? 4 : 3} style={{ color: 'var(--faint)' }}>Lädt …</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="l" colSpan={admin ? 4 : 3} style={{ color: 'var(--faint)' }}>Noch keine Ausgaben.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="l num">{r.expense_date}</td>
                    <td className="l">{r.description}</td>
                    <td className="num">{fmt(r.amount)}</td>
                    {admin && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setEdit({ ...r })}>Bearbeiten</button>
                          <button className="xdel" title="Löschen" onClick={() => remove(r)}>✕</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Ausgabe bearbeiten</h3>
            <div className="field"><label>Datum</label><input type="date" value={edit.expense_date} onChange={(e) => setEdit({ ...edit, expense_date: e.target.value })} /></div>
            <div className="field"><label>Beschreibung</label><input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div className="field"><label>Betrag</label><input className="num" type="number" min="0" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={() => setEdit(null)}>Abbrechen</button>
              <button className="save" style={{ marginTop: 0, width: 'auto', padding: '10px 18px' }} onClick={saveEdit} disabled={busy}>{busy ? '…' : 'Speichern'}</button>
            </div>
          </div>
        </div>
      )}

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
