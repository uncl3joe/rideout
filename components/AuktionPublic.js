'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { placeBid } from '@/app/auction-actions';

const ORANGE = '#ff7a1a';
const BLUE = '#37a6ea';
const fmt = (n) => Math.round(n || 0).toLocaleString('de-DE') + ' $';
const ANTI = 30 * 1000;

function effEnd(a) {
  const base = new Date(a.ends_at).getTime();
  const lb = a.last_bid_at ? new Date(a.last_bid_at).getTime() + ANTI : 0;
  return Math.max(base, lb);
}
function fmtLeft(ms) {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return (h ? h + 'h ' : '') + (h || m ? m + 'm ' : '') + ss + 's';
}

export default function AuktionPublic({ initialAuctions, initialBids }) {
  const [auctions, setAuctions] = useState(initialAuctions || []);
  const [bids, setBids] = useState(initialBids || []);
  const [now, setNow] = useState(Date.now());
  const [ic, setIc] = useState('');
  const [dc, setDc] = useState('');
  const [custom, setCustom] = useState({}); // auctionId -> string
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const msgTimer = useRef(null);

  function flash(m) {
    setMsg(m);
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(''), 3500);
  }

  // Name + Discord merken (nur im Browser).
  useEffect(() => {
    try {
      setIc(localStorage.getItem('roc_ic') || '');
      setDc(localStorage.getItem('roc_dc') || '');
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('roc_ic', ic);
      localStorage.setItem('roc_dc', dc);
    } catch {}
  }, [ic, dc]);

  // Uhr für die Countdowns.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function reload() {
    const sb = createClient();
    const { data: a } = await sb
      .from('auctions')
      .select('id, model, image_url, start_price, min_increment, current_bid, current_bid_ic, last_bid_at, ends_at, status, winner_ic, created_at')
      .order('created_at', { ascending: false });
    const list = a || [];
    setAuctions(list);
    const ids = list.map((x) => x.id);
    if (ids.length) {
      const { data: b } = await sb.from('bids').select('id, auction_id, ic_name, amount, created_at').in('auction_id', ids).order('amount', { ascending: false });
      setBids(b || []);
    } else {
      setBids([]);
    }
  }

  // Live: auf neue Gebote / Auktions-Änderungen hören.
  useEffect(() => {
    const sb = createClient();
    const ch = sb
      .channel('auktion-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => reload())
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, []);

  const bidsOf = (aid) => bids.filter((b) => b.auction_id === aid).sort((x, y) => y.amount - x.amount);

  const live = useMemo(() => auctions.filter((a) => a.status !== 'ended' && now < effEnd(a)), [auctions, now]);
  const ended = useMemo(() => auctions.filter((a) => a.status === 'ended' || now >= effEnd(a)), [auctions, now]);

  async function doBid(a, amount) {
    amount = Math.round(Number(amount) || 0);
    if (!ic.trim() || !dc.trim()) return flash('Bitte oben IC-Name und Discord-Name eingeben.');
    if (amount <= 0) return flash('Bitte einen Betrag eingeben.');
    setBusy(a.id);
    const res = await placeBid({ auctionId: a.id, icName: ic, discordName: dc, amount });
    setBusy('');
    if (!res.ok) return flash(res.error || 'Gebot fehlgeschlagen.');
    setCustom((c) => ({ ...c, [a.id]: '' }));
    flash('Gebot abgegeben ✓ (' + fmt(amount) + ')');
    reload();
  }

  const minNext = (a) => (a.current_bid != null ? a.current_bid + a.min_increment : a.start_price);
  const quickBase = (a) => (a.current_bid != null ? a.current_bid : a.start_price);

  const card = (a) => {
    const isEnded = a.status === 'ended' || now >= effEnd(a);
    const inGrace = !isEnded && now >= new Date(a.ends_at).getTime();
    const top = bidsOf(a.id).slice(0, 5);
    return (
      <div key={a.id} style={S.card}>
        <div style={S.imgWrap}>
          {a.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.image_url} alt={a.model} style={S.img} />
          ) : (
            <div style={{ ...S.img, display: 'grid', placeItems: 'center', color: 'var(--faint)' }}>Kein Foto</div>
          )}
          <div style={{ ...S.badge, background: isEnded ? '#3a3a3f' : inGrace ? BLUE : ORANGE }}>
            {isEnded ? 'Beendet' : inGrace ? 'Nachfrist' : 'Live'}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          <div style={S.model}>{a.model}</div>

          <div style={{ margin: '6px 0 12px', fontSize: 13, color: isEnded ? 'var(--mut)' : inGrace ? BLUE : 'var(--mut)' }}>
            {isEnded ? (
              <>Beendet · Gewinner: <b style={{ color: '#fff' }}>{a.winner_ic || a.current_bid_ic || 'kein Gebot'}</b></>
            ) : inGrace ? (
              <>⏳ Nachfrist! Endet in <b>{fmtLeft(effEnd(a) - now)}</b>, wenn kein Gebot kommt</>
            ) : (
              <>Endet in <b>{fmtLeft(new Date(a.ends_at).getTime() - now)}</b></>
            )}
          </div>

          <div style={S.bidBox}>
            <div style={{ fontSize: 11.5, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {a.current_bid != null ? 'Höchstgebot' : 'Startpreis'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(a.current_bid != null ? a.current_bid : a.start_price)}</div>
            {a.current_bid_ic && <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>von {a.current_bid_ic}</div>}
          </div>

          {top.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--mut)' }}>
              {top.map((b, i) => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', opacity: i === 0 ? 1 : 0.7 }}>
                  <span>{i === 0 ? '🥇 ' : ''}{b.ic_name}</span>
                  <span className="num">{fmt(b.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {!isEnded && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button style={S.quick} disabled={busy === a.id} onClick={() => doBid(a, quickBase(a) + 50000)}>+50K</button>
                <button style={S.quick} disabled={busy === a.id} onClick={() => doBid(a, quickBase(a) + 100000)}>+100K</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={'min. ' + fmt(minNext(a))}
                  value={custom[a.id] || ''}
                  onChange={(e) => setCustom((c) => ({ ...c, [a.id]: e.target.value }))}
                  style={S.input}
                />
                <button style={S.bidBtn} disabled={busy === a.id} onClick={() => doBid(a, custom[a.id])}>
                  {busy === a.id ? '…' : 'Bieten'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>Mindestgebot: {fmt(minNext(a))}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <header style={S.header}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.02em' }}>
              Live-<span style={{ color: ORANGE }}>Auktionen</span>
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--mut)', fontSize: 14 }}>Biete mit und sichere dir deinen Ride.</p>
          </div>
          <a href="/shop" style={S.shopLink}>Zum Fahrzeughandel →</a>
        </header>

        <div style={S.bidderBar}>
          <div style={{ fontSize: 12.5, color: 'var(--mut)', marginBottom: 8 }}>
            Zum Mitbieten einmalig eintragen. Öffentlich sichtbar ist nur dein IC-Name, der Discord-Name sieht nur die Werkstatt.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder="IC-Name" value={ic} onChange={(e) => setIc(e.target.value)} style={{ ...S.input, flex: '1 1 180px' }} />
            <input placeholder="Discord-Name" value={dc} onChange={(e) => setDc(e.target.value)} style={{ ...S.input, flex: '1 1 180px' }} />
          </div>
        </div>

        {auctions.length === 0 ? (
          <div style={{ color: 'var(--faint)', padding: '40px 0', textAlign: 'center' }}>Aktuell keine Auktionen.</div>
        ) : (
          <>
            {live.length > 0 && <div style={S.grid}>{live.map(card)}</div>}
            {ended.length > 0 && (
              <>
                <h2 style={{ fontSize: 16, color: 'var(--mut)', margin: '28px 0 12px' }}>Beendet</h2>
                <div style={S.grid}>{ended.map(card)}</div>
              </>
            )}
          </>
        )}
      </div>

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg, #09090b)', color: 'var(--fg, #fff)', padding: '0 16px 60px' },
  inner: { maxWidth: 1040, margin: '0 auto', paddingTop: 28 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 },
  shopLink: { color: 'var(--mut)', textDecoration: 'none', fontSize: 13, border: '1px solid var(--line)', padding: '8px 12px', borderRadius: 10 },
  bidderBar: { background: 'var(--panel, #131316)', border: '1px solid var(--line)', borderRadius: 14, padding: 14, marginBottom: 22 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card: { background: 'var(--panel, #131316)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' },
  imgWrap: { position: 'relative', aspectRatio: '16 / 10', background: '#0c0c0e' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  badge: { position: 'absolute', top: 10, left: 10, color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999 },
  model: { fontSize: 18, fontWeight: 700 },
  bidBox: { background: 'var(--bg, #09090b)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' },
  quick: { flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid ' + ORANGE, background: 'transparent', color: ORANGE, fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  input: { background: 'var(--bg, #09090b)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', color: 'inherit', fontSize: 14, width: '100%' },
  bidBtn: { padding: '10px 18px', borderRadius: 10, border: 'none', background: ORANGE, color: '#111', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
};
