'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt } from '@/lib/format';
import { createAuction, endAuction, deleteBid, deleteAuction } from '@/app/auction-actions';

export default function Auktion({ userId, myName }) {
  const [auctions, setAuctions] = useState(null);
  const [bids, setBids] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [team, setTeam] = useState([]);
  const [nf, setNf] = useState({ model: '', startPrice: '', minIncrement: '50000', endsAt: '' });
  // Anbieter: eine Profil-ID (Teamfahrzeug) oder der Sentinel '__kunde__' (Kundenfahrzeug).
  const [sellerSel, setSellerSel] = useState(userId || '');
  const [customerName, setCustomerName] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 3000);
  }

  async function load() {
    const sb = createClient();
    const [a, b, c, t] = await Promise.all([
      sb.from('auctions').select('*').order('created_at', { ascending: false }),
      sb.from('bids').select('id, auction_id, ic_name, amount, created_at').order('amount', { ascending: false }),
      sb.from('bid_contacts').select('bid_id, discord_name'),
      sb.from('profiles').select('id, name').order('name'),
    ]);
    setAuctions(a.data || []);
    setBids(b.data || []);
    setContacts(c.data || []);
    setTeam(t.data || []);
  }
  useEffect(() => {
    load();
  }, []);

  const discordOf = (bidId) => contacts.find((c) => c.bid_id === bidId)?.discord_name || '—';
  const bidsOf = (aid) => bids.filter((b) => b.auction_id === aid);

  async function uploadPhoto(f) {
    const sb = createClient();
    const path = 'auktion_' + Date.now() + '_' + f.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const { error } = await sb.storage.from('vehicles').upload(path, f, { upsert: false });
    if (error) throw error;
    return sb.storage.from('vehicles').getPublicUrl(path).data.publicUrl;
  }

  async function add() {
    if (!nf.model.trim()) return flash('Modell angeben.');
    if (!nf.endsAt) return flash('Ablaufzeit angeben.');
    const isKunde = sellerSel === '__kunde__';
    if (isKunde && !customerName.trim()) return flash('Kundenname angeben.');
    setBusy(true);
    try {
      let imageUrl = null;
      if (file) imageUrl = await uploadPhoto(file);
      const res = await createAuction({
        model: nf.model,
        imageUrl,
        startPrice: nf.startPrice,
        minIncrement: nf.minIncrement,
        endsAt: nf.endsAt,
        sellerId: isKunde ? null : sellerSel,
        customerName: isKunde ? customerName : '',
      });
      if (!res.ok) return flash('Fehler: ' + res.error);
      setNf({ model: '', startPrice: '', minIncrement: '50000', endsAt: '' });
      setSellerSel(userId || '');
      setCustomerName('');
      setFile(null);
      flash('Auktion gestartet ✓');
      load();
    } catch (e) {
      flash('Fehler: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function strike(bid) {
    if (!confirm('Gebot von ' + bid.ic_name + ' (' + fmt(bid.amount) + ') streichen? Dann zählt das nächsthöhere.')) return;
    const r = await deleteBid({ bidId: bid.id });
    if (!r.ok) return flash('Fehler: ' + r.error);
    flash('Gebot gestrichen');
    load();
  }
  async function end(a) {
    if (!confirm('Auktion „' + a.model + '" jetzt sofort beenden?')) return;
    const r = await endAuction({ auctionId: a.id });
    if (!r.ok) return flash('Fehler: ' + r.error);
    flash('Auktion beendet');
    load();
  }
  async function del(a) {
    if (!confirm('Auktion „' + a.model + '" komplett löschen?')) return;
    const r = await deleteAuction({ auctionId: a.id });
    if (!r.ok) return flash('Fehler: ' + r.error);
    flash('Auktion gelöscht');
    load();
  }
  async function done(a) {
    if (!confirm('Auktion „' + a.model + '" als erledigt markieren? Sie verschwindet dann aus dem Live-Auktionen-Channel.')) return;
    const r = await deleteAuction({ auctionId: a.id });
    if (!r.ok) return flash('Fehler: ' + r.error);
    flash('Auktion erledigt');
    load();
  }

  return (
    <>
      <div className="vhead">
        <h2>Auktion</h2>
        <span className="vs">Live-Auktionen · öffentliche Seite unter /auktion</span>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="hd"><h2>Neue Auktion</h2></div>
        <div className="bd">
          <div className="fields" style={{ gridTemplateColumns: sellerSel === '__kunde__' ? '1.4fr 1fr 1.2fr' : '1.4fr 1fr', marginTop: 0, alignItems: 'end' }}>
            <div className="field"><label>Modell</label><input value={nf.model} onChange={(e) => setNf({ ...nf, model: e.target.value })} placeholder="z. B. Pfister Comet" /></div>
            <div className="field"><label>Anbieter</label>
              <select value={sellerSel} onChange={(e) => setSellerSel(e.target.value)}>
                {(team.length ? team : (userId ? [{ id: userId, name: myName }] : [])).map((t) => (
                  <option key={t.id} value={t.id}>Fahrzeug von {t.name}</option>
                ))}
                <option value="__kunde__">Kundenfahrzeug …</option>
              </select>
            </div>
            {sellerSel === '__kunde__' && (
              <div className="field"><label>Kundenname</label><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name des Kunden" /></div>
            )}
          </div>
          <div className="fields" style={{ gridTemplateColumns: '.8fr .8fr 1.2fr auto auto', marginTop: 10, alignItems: 'end' }}>
            <div className="field"><label>Startpreis</label><input className="num" type="number" min="0" value={nf.startPrice} onChange={(e) => setNf({ ...nf, startPrice: e.target.value })} placeholder="0" /></div>
            <div className="field"><label>Mindest-Erhöhung</label><input className="num" type="number" min="50000" step="1000" value={nf.minIncrement} onChange={(e) => setNf({ ...nf, minIncrement: e.target.value })} placeholder="50000" /></div>
            <div className="field"><label>Ablauf</label><input type="datetime-local" value={nf.endsAt} onChange={(e) => setNf({ ...nf, endsAt: e.target.value })} /></div>
            <div className="field"><label>Foto</label><input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} /></div>
            <button className="save" style={{ marginTop: 0, width: 'auto', padding: '10px 16px', fontSize: 13 }} onClick={add} disabled={busy}>{busy ? '…' : 'Starten'}</button>
          </div>
        </div>
      </div>

      {!auctions ? (
        <div className="soon"><p>Lädt …</p></div>
      ) : auctions.length === 0 ? (
        <div className="card"><div className="bd" style={{ color: 'var(--faint)', fontSize: 13 }}>Noch keine Auktionen.</div></div>
      ) : (
        auctions.map((a) => {
          const list = bidsOf(a.id);
          const ended = a.status === 'ended';
          return (
            <div className="card" key={a.id} style={{ marginBottom: 16 }}>
              <div className="hd">
                <h2>{a.model}</h2>
                <span className={'tag'}>{ended ? 'Beendet' : 'Live'} · {new Date(a.ends_at).toLocaleString('de-DE')}</span>
              </div>
              <div className="bd">
                <div className="meta" style={{ marginBottom: 10 }}>
                  <span>Anbieter: <b>{a.seller_name || '—'}</b>{!a.seller_id && a.seller_name ? ' (Kunde)' : ''}</span>
                  <span>Start: <b>{fmt(a.start_price)}</b></span>
                  <span>Mindest-Erhöhung: <b>{fmt(a.min_increment)}</b></span>
                  <span>Höchstgebot: <b>{a.current_bid != null ? fmt(a.current_bid) : '—'}</b>{a.current_bid_ic ? ' (' + a.current_bid_ic + ')' : ''}</span>
                  {ended && <span>Gewinner: <b>{a.winner_ic || 'kein Gebot'}</b></span>}
                </div>

                <div className="tw">
                  <table className="tbl">
                    <tbody>
                      <tr><th className="l">IC-Name</th><th className="l">Discord</th><th>Gebot</th><th></th></tr>
                      {list.length === 0 ? (
                        <tr><td className="l" colSpan={4} style={{ color: 'var(--faint)' }}>Noch keine Gebote.</td></tr>
                      ) : (
                        list.map((b) => (
                          <tr key={b.id}>
                            <td className="l">{b.ic_name}</td>
                            <td className="l" style={{ color: 'var(--mut)' }}>{discordOf(b.id)}</td>
                            <td className="num umc">{fmt(b.amount)}</td>
                            <td><button className="xdel" title="Gebot streichen" onClick={() => strike(b)}>✕</button></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {ended ? (
                    <button className="btn" onClick={() => done(a)}>✓ Erledigt (aus Channel entfernen)</button>
                  ) : (
                    <>
                      <button className="btn" onClick={() => end(a)}>Auktion beenden</button>
                      <button className="xdel" title="Auktion löschen" onClick={() => del(a)}>✕ löschen</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
