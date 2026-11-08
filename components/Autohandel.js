'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { setVehicleStatus, deleteVehicle, deleteReservation, markReservationHandled } from '@/app/shop-admin-actions';

const fmt = (n) => Math.round(n || 0).toLocaleString('de-DE') + ' $';
const STATUS = [
  ['verfuegbar', 'Verfügbar'],
  ['reserviert', 'Reserviert'],
  ['verkauft', 'Verkauft'],
];
const stLabel = (s) => (STATUS.find((x) => x[0] === s) || [, s])[1];

export default function Autohandel({ role, userId, myName }) {
  const [vehicles, setVehicles] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [team, setTeam] = useState([]);
  const [nf, setNf] = useState({ model: '', price: '', seller_id: userId || '', reserve_24h: false });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  }

  async function loadAll() {
    const sb = createClient();
    const [v, r, t] = await Promise.all([
      sb.from('vehicles').select('id, model, price, seller_id, seller_name, status, image_url, reserve_24h').order('created_at', { ascending: false }),
      sb.from('reservations').select('id, customer_name, customer_contact, handled, created_at, vehicles(model)').order('created_at', { ascending: false }),
      sb.from('profiles').select('id, name').order('name'),
    ]);
    setVehicles(v.data || []);
    setReservations(r.data || []);
    setTeam(t.data || []);
  }
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadPhoto(f) {
    const sb = createClient();
    const path = Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const { error } = await sb.storage.from('vehicles').upload(path, f, { upsert: false });
    if (error) throw error;
    return sb.storage.from('vehicles').getPublicUrl(path).data.publicUrl;
  }

  async function addVehicle() {
    if (!nf.model.trim()) return flash('Modell angeben.');
    setBusy(true);
    try {
      let image_url = null;
      if (file) image_url = await uploadPhoto(file);
      const seller = team.find((t) => t.id === nf.seller_id);
      const sb = createClient();
      const { error } = await sb.from('vehicles').insert({
        model: nf.model.trim(),
        price: Math.max(0, Math.round(Number(nf.price) || 0)),
        seller_id: nf.seller_id || null,
        seller_name: seller ? seller.name : myName,
        status: 'verfuegbar',
        image_url,
        reserve_24h: !!nf.reserve_24h,
      });
      if (error) throw error;
      setNf({ model: '', price: '', seller_id: userId || '', reserve_24h: false });
      setFile(null);
      flash('Fahrzeug angelegt ✓');
      loadAll();
    } catch (e) {
      flash('Fehler: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  function setLocal(id, field, value) {
    setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  }
  async function commit(id, field, value) {
    const sb = createClient();
    const val = field === 'price' ? Math.max(0, Math.round(Number(value) || 0)) : value;
    const { error } = await sb.from('vehicles').update({ [field]: val }).eq('id', id);
    if (error) flash('Fehler: ' + error.message);
    else flash('Gespeichert ✓');
  }
  // Status serverseitig setzen. Bei "verfügbar"/"verkauft" wird die offene
  // Reservierung samt Discord-Meldung automatisch entfernt.
  async function changeStatus(id, status) {
    setLocal(id, 'status', status);
    const res = await setVehicleStatus({ vehicleId: id, status });
    if (!res.ok) return flash('Fehler: ' + res.error);
    flash('Status gespeichert ✓');
    loadAll(); // Reservierungen können sich geändert haben
  }
  async function replacePhoto(id, f) {
    if (!f) return;
    try {
      const url = await uploadPhoto(f);
      const sb = createClient();
      await sb.from('vehicles').update({ image_url: url }).eq('id', id);
      setLocal(id, 'image_url', url);
      flash('Foto aktualisiert ✓');
    } catch (e) {
      flash('Fehler: ' + (e.message || e));
    }
  }
  async function delVehicle(id, model) {
    if (!confirm('„' + model + '" wirklich löschen?')) return;
    const res = await deleteVehicle({ vehicleId: id });
    if (!res.ok) return flash('Fehler: ' + res.error);
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    flash('Fahrzeug gelöscht');
  }

  // Erledigt markieren entfernt auch die Discord-Reservierungsmeldung.
  async function markHandled(r) {
    const res = await markReservationHandled({ reservationId: r.id });
    if (!res.ok) return flash('Fehler: ' + res.error);
    setReservations((prev) => prev.map((x) => (x.id === r.id ? { ...x, handled: true } : x)));
  }
  async function delReservation(id) {
    const res = await deleteReservation({ reservationId: id });
    if (!res.ok) return flash('Fehler: ' + res.error);
    setReservations((prev) => prev.filter((x) => x.id !== id));
  }

  const openRes = reservations.filter((r) => !r.handled);

  return (
    <>
      <div className="vhead">
        <h2>Autohandel</h2>
        <span className="vs">Fahrzeuge verwalten · öffentliche Seite unter /shop</span>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="hd"><h2>Fahrzeug anlegen</h2></div>
        <div className="bd">
          <div className="fields" style={{ gridTemplateColumns: '1.4fr .8fr 1fr auto auto auto', marginTop: 0, alignItems: 'end' }}>
            <div className="field"><label>Modell</label><input value={nf.model} onChange={(e) => setNf({ ...nf, model: e.target.value })} placeholder="z. B. Pfister Comet" /></div>
            <div className="field"><label>Preis</label><input className="num" type="number" min="0" value={nf.price} onChange={(e) => setNf({ ...nf, price: e.target.value })} placeholder="0" /></div>
            <div className="field"><label>Verkäufer</label>
              <select value={nf.seller_id} onChange={(e) => setNf({ ...nf, seller_id: e.target.value })}>
                <option value="">— wählen —</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="field"><label>Foto</label><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} /></div>
            <div className="field" style={{ minWidth: 150 }}>
              <label>Reservierung 24 h</label>
              <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', height: 38, fontSize: 12.5, color: 'var(--mut)', cursor: 'pointer' }}>
                <input type="checkbox" checked={nf.reserve_24h} onChange={(e) => setNf({ ...nf, reserve_24h: e.target.checked })} />
                läuft nach 24 h ab
              </label>
            </div>
            <button className="save" style={{ marginTop: 0, width: 'auto', padding: '10px 16px', fontSize: 13 }} onClick={addVehicle} disabled={busy}>
              {busy ? '…' : 'Anlegen'}
            </button>
          </div>
        </div>
      </div>

      {openRes.length > 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: 'var(--accent-soft)' }}>
          <div className="hd"><h2>Neue Reservierungen</h2><span className="tag">{openRes.length} offen</span></div>
          <div>
            {openRes.map((r) => (
              <div className="vert" key={r.id}>
                <div className="r1">
                  <span className="vn">{r.vehicles?.model || 'Fahrzeug'}</span>
                  <span className="st a">reserviert</span>
                </div>
                <div className="meta">
                  <span>Kunde: <b>{r.customer_name}</b></span>
                  <span>Kontakt: <b>{r.customer_contact}</b></span>
                  <span>{new Date(r.created_at).toLocaleString('de-DE')}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn" onClick={() => markHandled(r)}>Als erledigt markieren</button>
                  <button className="xdel" onClick={() => delReservation(r.id)} title="Löschen">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!vehicles ? (
        <div className="soon"><p>Lädt …</p></div>
      ) : (
        <div className="card">
          <div className="hd"><h2>Alle Fahrzeuge</h2><span className="tag">{vehicles.length}</span></div>
          <div className="tw">
            <table className="tbl">
              <tbody>
                <tr>
                  <th className="l">Foto</th>
                  <th className="l">Modell</th>
                  <th>Preis</th>
                  <th className="l">Verkäufer</th>
                  <th className="l">Status</th>
                  <th>24 h</th>
                  <th></th>
                </tr>
                {vehicles.length === 0 ? (
                  <tr><td className="l" colSpan={7} style={{ color: 'var(--faint)' }}>Noch keine Fahrzeuge.</td></tr>
                ) : (
                  vehicles.map((v) => (
                    <tr key={v.id}>
                      <td className="l">
                        <label className="veh-thumb" title="Foto ändern">
                          {v.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.image_url} alt="" />
                          ) : (
                            <span>＋</span>
                          )}
                          <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && replacePhoto(v.id, e.target.files[0])} />
                        </label>
                      </td>
                      <td className="l">
                        <input className="rolesel" style={{ width: 160 }} value={v.model}
                          onChange={(e) => setLocal(v.id, 'model', e.target.value)} onBlur={(e) => commit(v.id, 'model', e.target.value)} />
                      </td>
                      <td>
                        <input className="vkin" type="number" min="0" value={v.price}
                          onChange={(e) => setLocal(v.id, 'price', e.target.value)} onBlur={(e) => commit(v.id, 'price', e.target.value)} />
                      </td>
                      <td className="l" style={{ color: 'var(--mut)' }}>{v.seller_name || '—'}</td>
                      <td className="l">
                        <select className="rolesel" value={v.status}
                          onChange={(e) => changeStatus(v.id, e.target.value)}>
                          {STATUS.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={!!v.reserve_24h} title="Reservierung läuft nach 24 h ab"
                          onChange={(e) => { setLocal(v.id, 'reserve_24h', e.target.checked); commit(v.id, 'reserve_24h', e.target.checked); }} />
                      </td>
                      <td><button className="xdel" title="Löschen" onClick={() => delVehicle(v.id, v.model)}>✕</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
