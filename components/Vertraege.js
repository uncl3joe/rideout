'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt } from '@/lib/format';

export default function Vertraege() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ name: '', contact: '', status: 'aktiv', date_from: '', date_to: '', deposited: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const sb = createClient();
    const { data } = await sb
      .from('contracts')
      .select('id, name, contact, date_from, date_to, deposited, status, notes')
      .order('created_at', { ascending: false });
    setRows(data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function add() {
    if (!f.name.trim()) {
      setMsg('Familie/Firma angeben');
      setTimeout(() => setMsg(''), 2000);
      return;
    }
    setBusy(true);
    const sb = createClient();
    const { error } = await sb.from('contracts').insert({
      name: f.name.trim(),
      contact: f.contact.trim(),
      status: f.status,
      date_from: f.date_from || null,
      date_to: f.date_to || null,
      deposited: Math.round(Number(f.deposited) || 0),
      notes: f.notes.trim(),
    });
    setBusy(false);
    if (error) {
      setMsg('Fehler: ' + error.message);
      return;
    }
    setF({ name: '', contact: '', status: 'aktiv', date_from: '', date_to: '', deposited: '', notes: '' });
    setMsg('Vertrag gespeichert ✓');
    setTimeout(() => setMsg(''), 2500);
    load();
  }

  return (
    <>
      <div className="vhead">
        <h2>Verträge</h2>
        <span className="vs">Familien &amp; Firmen</span>
      </div>

      <div className="grid">
        <section className="card">
          <div className="hd"><h2>Neuer Vertrag</h2></div>
          <div className="bd">
            <div className="fields">
              <div className="field f3"><label>Familie / Firma</label><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="z. B. Familie Mahone" /></div>
              <div className="field"><label>Kontakt</label><input value={f.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Ansprechpartner / Kennzeichen" /></div>
              <div className="field"><label>Status</label>
                <select value={f.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="aktiv">Aktiv</option>
                  <option value="beendet">Beendet</option>
                </select>
              </div>
              <div className="field"><label>Von</label><input type="date" value={f.date_from} onChange={(e) => set('date_from', e.target.value)} /></div>
              <div className="field"><label>Bis</label><input type="date" value={f.date_to} onChange={(e) => set('date_to', e.target.value)} /></div>
              <div className="field f3"><label>Eingezahlt</label><input className="num" type="number" min="0" value={f.deposited} onChange={(e) => set('deposited', e.target.value)} placeholder="0" /></div>
              <div className="field f3"><label>Notizen</label><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Vereinbarungen, Rabatte, Besonderheiten …" /></div>
            </div>
            <button className="save" onClick={add} disabled={busy}>Vertrag speichern</button>
          </div>
        </section>

        <section className="card">
          <div className="hd"><h2>Verträge</h2><span className="tag">{rows ? rows.length : 0} Verträge</span></div>
          <div>
            {!rows ? (
              <div className="bd" style={{ color: 'var(--faint)', fontSize: 13 }}>Lädt …</div>
            ) : rows.length === 0 ? (
              <div className="bd" style={{ color: 'var(--faint)', fontSize: 13 }}>Noch keine Verträge.</div>
            ) : (
              rows.map((v) => (
                <div className="vert" key={v.id}>
                  <div className="r1">
                    <span className="vn">{v.name}</span>
                    <span className={'st ' + (v.status === 'aktiv' ? 'a' : 'e')}>{v.status === 'aktiv' ? 'Aktiv' : 'Beendet'}</span>
                  </div>
                  <div className="meta">
                    <span>Kontakt: <b>{v.contact || '—'}</b></span>
                    <span>Laufzeit: <b>{v.date_from || '—'} – {v.date_to || 'offen'}</b></span>
                    <span>Eingezahlt: <b>{fmt(v.deposited)}</b></span>
                  </div>
                  {v.notes && <div className="note">{v.notes}</div>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
