'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { placeBid } from '@/app/auction-actions';

const ORANGE = '#ff7a1a';
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
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2);
  return p[0][0] + p[1][0];
}

// Zahl, die bei einer Änderung sanft hochzählt (für das Höchstgebot).
function CountUp({ value, className }) {
  const [disp, setDisp] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisp(to);
      return;
    }
    const dur = 650;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisp(Math.round(from + (to - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);
  return <span className={className}>{fmt(disp)}</span>;
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
  const [flashNonce, setFlashNonce] = useState({}); // auctionId -> counter, bei neuem Höchstgebot
  const msgTimer = useRef(null);
  const prevBidRef = useRef(null);

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

  // Aufblitzen, sobald ein Höchstgebot steigt (nicht beim ersten Laden).
  useEffect(() => {
    const map = {};
    auctions.forEach((a) => {
      map[a.id] = a.current_bid != null ? a.current_bid : null;
    });
    if (prevBidRef.current) {
      const prev = prevBidRef.current;
      const bumps = [];
      Object.keys(map).forEach((id) => {
        if (prev[id] != null && map[id] != null && map[id] > prev[id]) bumps.push(id);
      });
      if (bumps.length) {
        setFlashNonce((n) => {
          const next = { ...n };
          bumps.forEach((id) => {
            next[id] = (next[id] || 0) + 1;
          });
          return next;
        });
      }
    }
    prevBidRef.current = map;
  }, [auctions]);

  async function reload() {
    const sb = createClient();
    const { data: a } = await sb
      .from('auctions')
      .select('id, model, image_url, start_price, min_increment, current_bid, current_bid_ic, last_bid_at, ends_at, status, winner_ic, seller_name, seller_id, created_at')
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
    const toEnd = new Date(a.ends_at).getTime() - now;
    const urgent = !isEnded && !inGrace && toEnd < 60 * 1000;
    const top = bidsOf(a.id).slice(0, 5);
    const wonBy = a.winner_ic || a.current_bid_ic;
    const curVal = a.current_bid != null ? a.current_bid : a.start_price;

    return (
      <div key={a.id} className={'ak-card ' + (isEnded ? 'done' : 'live')}>
        {!isEnded && flashNonce[a.id] ? <span key={flashNonce[a.id]} className="ak-flash" aria-hidden /> : null}

        <div className="ak-imgwrap">
          {a.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.image_url} alt={a.model} />
          ) : (
            <div className="ak-noimg">Kein Foto</div>
          )}
          <div className={'ak-badge ' + (isEnded ? 'done' : inGrace ? 'grace' : 'live')}>
            {!isEnded && <span className="d" />}
            {isEnded ? 'Beendet' : inGrace ? 'Nachfrist' : 'Live'}
          </div>
          {isEnded && <div className="ak-sold">{wonBy ? 'Verkauft' : 'Beendet'}</div>}
        </div>

        <div className="ak-body">
          <div className="ak-model">{a.model}</div>
          {a.seller_name && <div className="ak-anbieter">{a.seller_id ? 'Fahrzeug von ' : 'Kundenfahrzeug von '}{a.seller_name}</div>}

          {isEnded ? (
            <div className="ak-done-line">
              Gewinner: <b style={{ color: '#fff' }}>{wonBy || 'kein Gebot'}</b>
            </div>
          ) : (
            <div className={'ak-count ' + (urgent ? 'urgent' : inGrace ? 'grace' : '')}>
              <span className="lab">{inGrace ? '⏳ Nachfrist, endet in' : 'Endet in'}</span>
              <span className="val">{fmtLeft((inGrace ? effEnd(a) : new Date(a.ends_at).getTime()) - now)}</span>
            </div>
          )}

          <div className="ak-bidbox">
            <div className="k">{a.current_bid != null ? 'Höchstgebot' : 'Startpreis'}</div>
            <CountUp value={curVal} className="ak-amount" />
            {a.current_bid_ic && <div className="by">von {a.current_bid_ic}</div>}
          </div>

          {top.length > 0 && (
            <div className="ak-board">
              {top.map((b, i) => (
                <div key={b.id} className={'ak-row' + (i === 0 ? ' top' : '')}>
                  <span className="ak-rk">{['🥇', '🥈', '🥉'][i] || i + 1 + '.'}</span>
                  <span className="ak-ava">{initials(b.ic_name)}</span>
                  <span className="nm">{b.ic_name}</span>
                  <span className="amt">{fmt(b.amount)}</span>
                </div>
              ))}
            </div>
          )}

          {!isEnded && (
            <div className="ak-actions">
              <div className="ak-quickrow">
                <button className="ak-quick" disabled={busy === a.id} onClick={() => doBid(a, quickBase(a) + 50000)}>+50K</button>
                <button className="ak-quick" disabled={busy === a.id} onClick={() => doBid(a, quickBase(a) + 100000)}>+100K</button>
              </div>
              <div className="ak-bidrow">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder={'min. ' + fmt(minNext(a))}
                  value={custom[a.id] || ''}
                  onChange={(e) => setCustom((c) => ({ ...c, [a.id]: e.target.value }))}
                  className="ak-input"
                />
                <button className="ak-bid" disabled={busy === a.id} onClick={() => doBid(a, custom[a.id])}>
                  {busy === a.id ? '…' : 'Bieten'}
                </button>
              </div>
              <div className="ak-minhint">Mindestgebot: {fmt(minNext(a))}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ak-page">
      <div className="ak-inner">
        <div className="ak-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" className="ak-logo" alt="Ride Out Customs" />
        </div>
        <div className="ak-hero">
          <h1>Live-<span>Auktionen</span></h1>
          <p>Biete mit und sichere dir deinen Ride.</p>
          {live.length > 0 && (
            <div className="ak-livepill">
              <span className="ak-dot" />
              {live.length} {live.length === 1 ? 'Auktion läuft' : 'Auktionen laufen'}
            </div>
          )}
        </div>

        <div className="ak-passbar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, color: 'var(--mut)' }}>
              Zum Mitbieten einmalig eintragen. Öffentlich sichtbar ist nur dein IC-Name, den Discord-Namen sieht nur die Werkstatt.
            </div>
            <a href="/shop" className="ak-shoplink">Zum Fahrzeughandel →</a>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder="IC-Name" value={ic} onChange={(e) => setIc(e.target.value)} className="ak-input" style={{ flex: '1 1 180px' }} />
            <input placeholder="Discord-Name" value={dc} onChange={(e) => setDc(e.target.value)} className="ak-input" style={{ flex: '1 1 180px' }} />
          </div>
        </div>

        {auctions.length === 0 ? (
          <div style={{ color: 'var(--faint)', padding: '48px 0', textAlign: 'center' }}>Aktuell keine Auktionen. Schau bald wieder vorbei! 🏁</div>
        ) : (
          <>
            {live.length > 0 && <div className="ak-grid">{live.map(card)}</div>}
            {ended.length > 0 && (
              <>
                <h2 className="ak-sechead">Beendet</h2>
                <div className="ak-grid">{ended.map(card)}</div>
              </>
            )}
          </>
        )}
      </div>

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </div>
  );
}
