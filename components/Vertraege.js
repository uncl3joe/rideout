'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt } from '@/lib/format';
import { addContract, editContract, deleteContract } from '@/app/manage-actions';

const EMPTY = { name: '', contact: '', status: 'aktiv', date_from: '', date_to: '', deposited: '', notes: '' };

export default function Vertraege({ role }) {
  const admin = role === 'inhaber';
  const [rows, setRows] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(null);

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

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
    if (!f.name.trim()) return flash('Familie/Firma angeben');
    setBusy(true);
    const res = await addContract(f);
    setBusy(false);
    if (!res.ok) return flash('Fehler: ' + res.error);
    setF(EMPTY);
    flash('Vertrag gespeichert ✓');
    load();
  }

  async function saveEdit() {
    if (!edit) return;
    if (!String(edit.name || '').trim()) return flash('Familie/Firma angeben');
    setBusy(true);
    const res = await editContract(edit);
    setBusy(false);
    if (!res.ok) return flash('Fehler: ' + res.error);
    setEdit(null);
    flash('Vertrag gespeichert ✓');
    load();
  }

  async function remove(v) {
    if (!confirm('Vertrag „' + v.name + '" wirklich löschen?')) return;
    const res = await deleteContract({ id: v.id });
    if (!res.ok) return flash('Fehler: ' + res.error);
    flash('Vertrag gelöscht');
    load();
  }

  const formFields = (obj, upd) => (
    <div className="fields">
      <div className="field f3"><label>Familie / Firma</label><input value={obj.name} onChange={(e) => upd('name', e.target.value)} placeholder="z. B. Familie Mahone" /></div>
      <div className="field"><label>Kontakt</label><input value={obj.contact} onChange={(e) => upd('contact', e.target.value)} placeholder="Ansprechpartner / Kennzeichen" /></div>
      <div className="field"><label>Status</label>
        <select value={obj.status} onChange={(e) => upd('status', e.target.value)}>
          <option value="aktiv">Aktiv</option>
          <option value="beendet">Beendet</option>
        </select>
      </div>
      <div className="field"><label>Von</label><input type="date" value={obj.date_from || ''} onChange={(e) => upd('date_from', e.target.value)} /></div>
      <div className="field"><label>Bis</label><input type="date" value={obj.date_to || ''} onChange={(e) => upd('date_to', e.target.value)} /></div>
      <div className="field f3"><label>Eingezahlt</label><input className="num" type="number" min="0" value={obj.deposited} onChange={(e) => upd('deposited', e.target.value)} placeholder="0" /></div>
      <div className="field f3"><label>Notizen</label><textarea value={obj.notes || ''} onChange={(e) => upd('notes', e.target.value)} placeholder="Vereinbarungen, Rabatte, Besonderheiten …" /></div>
    </div>
  );

  return (
    <>
      <div className="vhead">
        <h2>Verträge</h2>
        <span className="vs">{admin ? 'Familien & Firmen' : 'Familien & Firmen (nur Ansicht)'}</span>
      </div>

      <div className="grid">
        {admin && (
          <section className="card">
            <div className="hd"><h2>Neuer Vertrag</h2></div>
            <div className="bd">
              {formFields(f, set)}
              <button className="save" onClick={add} disabled={busy}>Vertrag speichern</button>
            </div>
          </section>
        )}

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
                    {admin && (
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button className="btn" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setEdit({ ...v })}>Bearbeiten</button>
                        <button className="xdel" title="Löschen" onClick={() => remove(v)}>✕</button>
                      </span>
                    )}
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

      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>Vertrag bearbeiten</h3>
            {formFields(edit, (k, val) => setEdit((p) => ({ ...p, [k]: val })))}
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
