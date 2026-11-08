'use client';

import { useEffect, useMemo, useState } from 'react';
import { reserveVehicle } from '@/app/shop-actions';

const fmt = (n) => Math.round(n || 0).toLocaleString('de-DE') + ' $';
const STATUS = {
  verfuegbar: ['Verfügbar', 'st-free'],
  reserviert: ['Reserviert', 'st-res'],
  verkauft: ['Verkauft', 'st-sold'],
};
const SORTS = [
  ['neu', 'Neueste'],
  ['preis_auf', 'Preis aufsteigend'],
  ['preis_ab', 'Preis absteigend'],
  ['modell', 'Modell A–Z'],
];

export default function Shop({ vehicles }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('neu');
  const [detail, setDetail] = useState(null);
  const [reserve, setReserve] = useState(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const [localStatus, setLocalStatus] = useState({});
  const [blocked, setBlocked] = useState(null);

  const statusOf = (v) => localStatus[v.id] || v.status;

  // Nur eine offene Reservierung pro Browser. Wir merken uns das reservierte
  // Fahrzeug lokal und sperren weitere Reservierungen, solange es reserviert ist.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('roc_reservation');
      if (!raw) return setBlocked(null);
      const saved = JSON.parse(raw);
      const v = vehicles.find((x) => x.id === saved.id);
      if (v && v.status === 'reserviert') setBlocked({ model: saved.model || v.model });
      else {
        localStorage.removeItem('roc_reservation');
        setBlocked(null);
      }
    } catch {
      /* localStorage evtl. nicht verfügbar */
    }
  }, [vehicles]);

  const list = useMemo(() => {
    let v = vehicles.slice();
    const s = q.trim().toLowerCase();
    if (s) v = v.filter((x) => x.model.toLowerCase().includes(s) || (x.seller_name || '').toLowerCase().includes(s));
    if (sort === 'preis_auf') v.sort((a, b) => a.price - b.price);
    else if (sort === 'preis_ab') v.sort((a, b) => b.price - a.price);
    else if (sort === 'modell') v.sort((a, b) => a.model.localeCompare(b.model));
    else v.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return v;
  }, [vehicles, q, sort]);

  async function submitReserve() {
    if (!name.trim() || !contact.trim()) return setErr('Bitte Name und Kontakt angeben.');
    setBusy(true);
    setErr('');
    const res = await reserveVehicle({ vehicleId: reserve.id, name, contact });
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setLocalStatus((m) => ({ ...m, [reserve.id]: 'reserviert' }));
    try {
      localStorage.setItem('roc_reservation', JSON.stringify({ id: reserve.id, model: reserve.model }));
    } catch {
      /* egal */
    }
    setBlocked({ model: reserve.model });
    setDone({ seller: res.seller, model: reserve.model });
    setReserve(null);
    setDetail(null);
    setName('');
    setContact('');
  }

  const badge = (v) => {
    const [l, c] = STATUS[statusOf(v)] || STATUS.verfuegbar;
    return <span className={'status-badge ' + c}>{l}</span>;
  };

  return (
    <div className="shop">
      <header className="shop-top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" className="shop-logo" alt="Ride Out Customs" />
        <a
          href="/auktion"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#ff7a1a',
            color: '#111',
            fontWeight: 800,
            fontSize: 15,
            padding: '13px 22px',
            borderRadius: 12,
            textDecoration: 'none',
            boxShadow: '0 6px 20px rgba(255,122,26,.40)',
          }}
        >
          🔨 Zu den Live-Auktionen →
        </a>
      </header>

      <div className="shop-hero">
        <h1>Dein <span>Ride</span> wartet.</h1>
        <p>Handgepflegte Rides, frisch aus unserer Halle.<br />Jetzt aussuchen und in Sekunden reservieren.</p>
      </div>

      <div className="shop-wrap">
        {blocked && (
          <div style={{ background: 'rgba(255,122,26,.12)', border: '1px solid #ff7a1a', borderRadius: 12, padding: '14px 16px', marginBottom: 16, color: '#ffce9e', fontSize: 14 }}>
            <b style={{ color: '#ff7a1a' }}>Du hast schon eine offene Reservierung für {blocked.model}.</b>
            <br />
            Du kannst erst wieder ein Fahrzeug reservieren, wenn diese abgeschlossen ist.
          </div>
        )}
        <div className="shop-bar">
          <input className="shop-search" placeholder="Fahrzeug oder Verkäufer suchen …" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {list.length === 0 ? (
          <div className="shop-empty">Aktuell keine Fahrzeuge im Angebot. Schau bald wieder vorbei! 🏁</div>
        ) : (
          <div className="veh-grid">
            {list.map((v) => (
              <div className="veh-card" key={v.id} onClick={() => setDetail(v)}>
                <div className="veh-img">
                  {v.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.image_url} alt={v.model} />
                  ) : (
                    <div className="veh-noimg">🏎️</div>
                  )}
                  {badge(v)}
                </div>
                <div className="veh-body">
                  <div className="veh-model">{v.model}</div>
                  <div className="veh-price">{fmt(v.price)}</div>
                  <div className="veh-seller">Verkäufer: {v.seller_name || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="shop-foot">Ride Out Customs · Fahrzeugangebote</footer>

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="lightbox" onClick={(e) => e.stopPropagation()}>
            <button className="lb-close" onClick={() => setDetail(null)}>×</button>
            <div className="lb-img">
              {detail.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.image_url} alt={detail.model} />
              ) : (
                <div className="veh-noimg big">🏎️</div>
              )}
            </div>
            <div className="lb-info">
              <div className="lb-model">{detail.model}</div>
              <div className="lb-price">{fmt(detail.price)}</div>
              <div className="lb-seller">Verkäufer: {detail.seller_name || '—'}</div>
              <div style={{ marginTop: 10 }}>{badge(detail)}</div>
              {statusOf(detail) === 'verfuegbar' && detail.reserve_24h && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: '#ff7a1a', fontWeight: 600 }}>
                  ⏳ Dieses Fahrzeug wird nur 24 Stunden reserviert.
                </div>
              )}
              {statusOf(detail) === 'verfuegbar' ? (
                blocked ? (
                  <div className="lb-note">Du hast schon eine offene Reservierung für {blocked.model}. Erst wieder möglich, wenn diese abgeschlossen ist.</div>
                ) : (
                  <button className="save" style={{ marginTop: 18 }} onClick={() => { setReserve(detail); setErr(''); }}>
                    Reservieren
                  </button>
                )
              ) : (
                <div className="lb-note">Dieses Fahrzeug ist nicht mehr verfügbar.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {reserve && (
        <div className="modal-backdrop" onClick={() => setReserve(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{reserve.model} reservieren</h3>
            <p style={{ color: reserve.reserve_24h ? '#ff7a1a' : 'var(--mut)', fontSize: 13, marginTop: 0 }}>
              {reserve.reserve_24h
                ? 'Achtung: Dieses Fahrzeug wird nur 24 Stunden reserviert. Danach wird es automatisch wieder freigegeben. Der Verkäufer meldet sich bei dir.'
                : 'Für dich reserviert, der Verkäufer meldet sich bei dir.'}
            </p>
            <div className="field"><label>Dein Name</label><input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label>Kontakt (Discord / Telefon)</label><input value={contact} onChange={(e) => setContact(e.target.value)} /></div>
            <div className="err">{err}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setReserve(null)}>Abbrechen</button>
              <button className="save" style={{ marginTop: 0, width: 'auto', padding: '10px 18px' }} onClick={submitReserve} disabled={busy}>
                {busy ? '…' : 'Jetzt reservieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="modal-backdrop" onClick={() => setDone(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <h3>Reserviert!</h3>
            <p style={{ color: 'var(--mut)' }}>
              Du hast <b>{done.model}</b> reserviert.{' '}
              {done.seller ? 'Verkäufer ' + done.seller + ' meldet sich bei dir.' : 'Der Verkäufer meldet sich bei dir.'}
            </p>
            <button className="save" style={{ marginTop: 6 }} onClick={() => setDone(null)}>Alles klar</button>
          </div>
        </div>
      )}
    </div>
  );
}
