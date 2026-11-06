'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt, numf, buildPeriods, initials } from '@/lib/format';
import { editOrder, deleteOrder } from '@/app/manage-actions';
import Seg from '@/components/Seg';

export default function Auftraege({ role }) {
  const canEdit = role === 'inhaber';
  const [orders, setOrders] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [services, setServices] = useState([]);
  const [gran, setGran] = useState('woche');
  const [periodKey, setPeriodKey] = useState(() => buildPeriods('woche')[0].key);
  const [mech, setMech] = useState('');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(null); // { id, customer, orderDate, screenshotSum, items:[{name,qty}] }
  const [busy, setBusy] = useState(false);

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2800);
  }

  async function load() {
    const sb = createClient();
    const [o, p, s] = await Promise.all([
      sb.from('orders').select('id, mechanic_id, mechanic_name, customer, order_date, umsatz, reingewinn, provision, screenshot_sum').order('order_date', { ascending: false }).order('id', { ascending: false }),
      sb.from('profiles').select('id, name'),
      sb.from('services').select('name, vk').eq('active', true).order('vk', { ascending: false }),
    ]);
    setOrders(o.data || []);
    setProfiles(p.data || []);
    setServices(s.data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const opts = useMemo(() => buildPeriods(gran), [gran]);
  const sel = opts.find((o) => o.key === periodKey) || opts[0];
  function changeGran(g) {
    setGran(g);
    setPeriodKey(buildPeriods(g)[0].key);
  }

  const nameOf = (o) => o.mechanic_name || profiles.find((p) => p.id === o.mechanic_id)?.name || '—';
  const vkOf = (name) => services.find((s) => s.name === name)?.vk || 0;

  const rows = useMemo(() => {
    if (!orders || !sel) return [];
    const qq = q.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.order_date >= sel.startISO &&
        o.order_date < sel.endISO &&
        (!mech || o.mechanic_id === mech) &&
        (!qq || (o.customer || '').toLowerCase().includes(qq) || nameOf(o).toLowerCase().includes(qq))
    );
  }, [orders, sel, mech, q, profiles]);

  const sums = useMemo(() => {
    const um = rows.reduce((s, o) => s + (o.umsatz || 0), 0);
    const re = rows.reduce((s, o) => s + (o.reingewinn || 0), 0);
    const pr = rows.reduce((s, o) => s + (o.provision || 0), 0);
    const np = re - pr;
    return { um, re, pr, np, n: rows.length };
  }, [rows]);

  async function openEdit(o) {
    const sb = createClient();
    const { data } = await sb.from('order_items').select('service_name, qty').eq('order_id', o.id);
    setEdit({
      id: o.id,
      name: nameOf(o),
      customer: o.customer || '',
      orderDate: o.order_date,
      screenshotSum: o.screenshot_sum || '',
      items: (data || []).map((x) => ({ name: x.service_name, qty: x.qty })),
    });
  }

  const previewSum = useMemo(() => {
    if (!edit) return 0;
    return edit.items.reduce((s, it) => s + vkOf(it.name) * (parseInt(it.qty, 10) || 0), 0);
  }, [edit, services]);

  function setItemQty(idx, qty) {
    setEdit((e) => ({ ...e, items: e.items.map((it, i) => (i === idx ? { ...it, qty } : it)) }));
  }
  function removeItem(idx) {
    setEdit((e) => ({ ...e, items: e.items.filter((_, i) => i !== idx) }));
  }
  function addItem(name) {
    if (!name) return;
    setEdit((e) => {
      const ex = e.items.find((it) => it.name === name);
      if (ex) return { ...e, items: e.items.map((it) => (it.name === name ? { ...it, qty: (parseInt(it.qty, 10) || 0) + 1 } : it)) };
      return { ...e, items: [...e.items, { name, qty: 1 }] };
    });
  }

  async function saveEdit() {
    if (!edit) return;
    const items = edit.items
      .map((it) => ({ name: it.name, qty: Math.max(1, parseInt(it.qty, 10) || 1) }))
      .filter((it) => it.name);
    if (!items.length) return flash('Mindestens eine Position nötig.');
    setBusy(true);
    const res = await editOrder({
      id: edit.id,
      customer: edit.customer,
      orderDate: edit.orderDate,
      screenshotSum: Number(edit.screenshotSum) || 0,
      items,
    });
    setBusy(false);
    if (!res.ok) return flash('Fehler: ' + res.error);
    setEdit(null);
    flash('Auftrag gespeichert ✓');
    load();
  }

  async function removeOrder(o) {
    if (!confirm('Auftrag von ' + nameOf(o) + ' am ' + o.order_date + ' wirklich löschen?')) return;
    const res = await deleteOrder({ id: o.id });
    if (!res.ok) return flash('Fehler: ' + res.error);
    flash('Auftrag gelöscht');
    load();
  }

  return (
    <>
      <div className="vhead">
        <h2>Aufträge</h2>
        <span className="vs">{canEdit ? 'Alle Aufträge bearbeiten & löschen' : 'Alle Aufträge (nur Ansicht)'}</span>
        <Seg value={gran} onChange={changeGran} />
        <select className="psel" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} aria-label="Zeitraum wählen">
          {opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div className="fields" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: 560, marginTop: 0, marginBottom: 14 }}>
        <div className="field">
          <label>Mechaniker</label>
          <select value={mech} onChange={(e) => setMech(e.target.value)}>
            <option value="">Alle Mechaniker</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Suche (Kunde)</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kundenname …" />
        </div>
      </div>

      <div className="card">
        <div className="hd">
          <h2>{sel?.label}</h2>
          <span className="tag">{sums.n} Aufträge · Umsatz {fmt(sums.um)}</span>
        </div>
        <div className="tw">
          <table className="tbl">
            <tbody>
              <tr>
                <th className="l">Datum</th>
                <th className="l">Mechaniker</th>
                <th className="l">Kunde</th>
                <th>Umsatz</th>
                <th>Reingewinn</th>
                <th>Provision</th>
                <th>Rein. n. Prov.</th>
                {canEdit && <th></th>}
              </tr>
              {!orders ? (
                <tr><td className="l" colSpan={canEdit ? 8 : 7} style={{ color: 'var(--faint)' }}>Lädt …</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="l" colSpan={canEdit ? 8 : 7} style={{ color: 'var(--faint)' }}>Keine Aufträge in diesem Zeitraum.</td></tr>
              ) : (
                rows.map((o) => (
                  <tr key={o.id}>
                    <td className="l num">{o.order_date}</td>
                    <td className="l"><div className="who2"><div className="ava">{initials(nameOf(o))}</div><div>{nameOf(o)}</div></div></td>
                    <td className="l">{o.customer || '—'}</td>
                    <td className="num umc">{fmt(o.umsatz)}</td>
                    <td className="num">{fmt(o.reingewinn)}</td>
                    <td className="num pvc">{fmt(o.provision)}</td>
                    <td className="num">{fmt((o.reingewinn || 0) - (o.provision || 0))}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(o)}>Bearbeiten</button>
                          <button className="xdel" title="Löschen" onClick={() => removeOrder(o)}>✕</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
              {rows.length > 0 && (
                <tr>
                  <td className="l"><b>Gesamt</b></td>
                  <td></td>
                  <td></td>
                  <td className="num umc"><b>{fmt(sums.um)}</b></td>
                  <td className="num"><b>{fmt(sums.re)}</b></td>
                  <td className="num pvc"><b>{fmt(sums.pr)}</b></td>
                  <td className="num"><b>{fmt(sums.np)}</b></td>
                  {canEdit && <td></td>}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <div className="modal-backdrop" onClick={() => setEdit(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>Auftrag bearbeiten</h3>
            <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 10 }}>{edit.name}</div>

            <div className="fields" style={{ gridTemplateColumns: '1.4fr 1fr 1fr', marginTop: 0 }}>
              <div className="field"><label>Kunde</label><input value={edit.customer} onChange={(e) => setEdit({ ...edit, customer: e.target.value })} placeholder="Kunde (Kennzeichen)" /></div>
              <div className="field"><label>Datum</label><input type="date" value={edit.orderDate} onChange={(e) => setEdit({ ...edit, orderDate: e.target.value })} /></div>
              <div className="field"><label>Screenshot-Summe (optional)</label><input className="num" type="number" min="0" value={edit.screenshotSum} onChange={(e) => setEdit({ ...edit, screenshotSum: e.target.value })} placeholder="0" /></div>
            </div>

            <div className="lbl" style={{ marginTop: 12 }}>Positionen</div>
            <div className="tw" style={{ maxHeight: 280, overflow: 'auto' }}>
              <table className="tbl">
                <tbody>
                  <tr><th className="l">Leistung</th><th style={{ width: 90 }}>Anzahl</th><th style={{ width: 40 }}></th></tr>
                  {edit.items.length === 0 ? (
                    <tr><td className="l" colSpan={3} style={{ color: 'var(--faint)' }}>Keine Positionen.</td></tr>
                  ) : (
                    edit.items.map((it, i) => (
                      <tr key={i}>
                        <td className="l">{it.name}</td>
                        <td><input className="vkin" type="number" min="1" value={it.qty} onChange={(e) => setItemQty(i, e.target.value)} /></td>
                        <td><button className="xdel" title="Entfernen" onClick={() => removeItem(i)}>✕</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <label>Position hinzufügen</label>
              <select value="" onChange={(e) => addItem(e.target.value)}>
                <option value="">+ Leistung wählen …</option>
                {services.map((s) => <option key={s.name} value={s.name}>{s.name} ({numf(s.vk)} $)</option>)}
              </select>
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 10 }}>
              Katalog-Summe ca. <b>{fmt(previewSum)}</b>. Mit Screenshot-Summe wird exakt darauf skaliert. Provision wird serverseitig neu gerechnet.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={() => setEdit(null)}>Abbrechen</button>
              <button className="save" style={{ marginTop: 0, width: 'auto', padding: '10px 18px' }} onClick={saveEdit} disabled={busy}>
                {busy ? '…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
