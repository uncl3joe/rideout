'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { numf } from '@/lib/format';

export default function Katalog() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [nf, setNf] = useState({ name: '', category: '', vk: '', material: '' });
  const [msg, setMsg] = useState('');

  async function load() {
    const sb = createClient();
    const { data } = await sb.from('services').select('id, name, category, vk, material').order('category').order('vk', { ascending: false });
    setRows(data || []);
  }
  useEffect(() => {
    load();
  }, []);

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

  const cats = useMemo(() => [...new Set((rows || []).map((r) => r.category))], [rows]);
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return (rows || []).filter((r) => r.name.toLowerCase().includes(s) || (r.category || '').toLowerCase().includes(s));
  }, [rows, q]);

  function setField(id, field, value) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function commit(id, field, value) {
    const v = Math.max(0, Math.round(Number(value) || 0));
    const sb = createClient();
    const { error } = await sb.from('services').update({ [field]: v }).eq('id', id);
    if (error) flash('Fehler: ' + error.message);
    else flash('Gespeichert ✓');
  }

  async function addService() {
    const name = nf.name.trim();
    if (!name) {
      flash('Name angeben');
      return;
    }
    const sb = createClient();
    const { error } = await sb.from('services').insert({
      name,
      category: nf.category.trim() || 'Sonstiges',
      vk: Math.max(0, Math.round(Number(nf.vk) || 0)),
      material: Math.max(0, Math.round(Number(nf.material) || 0)),
    });
    if (error) {
      flash(error.message.includes('duplicate') ? '„' + name + '" gibt es schon' : 'Fehler: ' + error.message);
      return;
    }
    setNf({ name: '', category: '', vk: '', material: '' });
    flash('„' + name + '" angelegt ✓');
    load();
  }

  async function del(id, name) {
    const sb = createClient();
    const { error } = await sb.from('services').delete().eq('id', id);
    if (error) flash('Fehler: ' + error.message);
    else {
      setRows((prev) => prev.filter((r) => r.id !== id));
      flash(name + ' entfernt');
    }
  }

  return (
    <>
      <div className="vhead">
        <h2>Preise &amp; Katalog</h2>
        <span className="vs">Leistungen &amp; Teile pflegen — Änderungen wirken sofort im Rechner</span>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="hd"><h2>Leistung / Teil anlegen</h2></div>
        <div className="bd">
          <div className="fields" style={{ gridTemplateColumns: '1.6fr 1fr .8fr .8fr auto', marginTop: 0, alignItems: 'end' }}>
            <div className="field"><label>Name</label><input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="z. B. Keramik-Versiegelung" /></div>
            <div className="field"><label>Kategorie</label>
              <input list="katCats" value={nf.category} onChange={(e) => setNf({ ...nf, category: e.target.value })} placeholder="wählen / neu" />
              <datalist id="katCats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="field"><label>Verkauf</label><input className="num" type="number" min="0" value={nf.vk} onChange={(e) => setNf({ ...nf, vk: e.target.value })} placeholder="0" /></div>
            <div className="field"><label>Material</label><input className="num" type="number" min="0" value={nf.material} onChange={(e) => setNf({ ...nf, material: e.target.value })} placeholder="0" /></div>
            <button className="save" style={{ marginTop: 0, width: 'auto', padding: '10px 16px', fontSize: 13 }} onClick={addService}>Anlegen</button>
          </div>
        </div>
      </div>

      <div className="field" style={{ maxWidth: 320, marginBottom: 14 }}>
        <label>Suchen</label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Leistung suchen …" />
      </div>

      <div className="card">
        <div className="hd"><h2>Alle Leistungen</h2><span className="tag">{rows ? rows.length : 0} Einträge</span></div>
        <div className="tw">
          <table className="tbl">
            <tbody>
              <tr>
                <th className="l">Leistung</th>
                <th className="l">Kategorie</th>
                <th>Material (EK)</th>
                <th>Verkauf</th>
                <th></th>
              </tr>
              {!rows ? (
                <tr><td className="l" colSpan={5} style={{ color: 'var(--faint)' }}>Lädt …</td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="l">{r.name}</td>
                    <td className="l" style={{ color: 'var(--mut)' }}>{r.category}</td>
                    <td>
                      <input className="vkin" type="number" min="0" value={r.material}
                        onChange={(e) => setField(r.id, 'material', e.target.value)}
                        onBlur={(e) => commit(r.id, 'material', e.target.value)} />
                    </td>
                    <td>
                      <input className="vkin" type="number" min="0" value={r.vk}
                        onChange={(e) => setField(r.id, 'vk', e.target.value)}
                        onBlur={(e) => commit(r.id, 'vk', e.target.value)} />
                    </td>
                    <td><button className="xdel" title="Entfernen" onClick={() => del(r.id, r.name)}>✕</button></td>
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
