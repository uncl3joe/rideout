'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmt } from '@/lib/format';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

// Gruppiert Gebote nach einem Merkmal und meldet, wo ein Merkmal unter
// mehreren verschiedenen IC-Namen auftaucht.
function flagBy(bids, keyFn, labelFn) {
  const by = {};
  for (const b of bids) {
    const k = keyFn(b);
    if (!k) continue;
    const g = by[k] || (by[k] = { label: labelFn(b), ics: new Set(), aucs: new Set(), bids: 0 });
    g.ics.add(b.ic_name); g.aucs.add(b.auction_id); g.bids += 1;
  }
  return Object.values(by)
    .filter((g) => g.ics.size > 1)
    .map((g) => ({ label: g.label, names: [...g.ics], aucs: g.aucs.size, bids: g.bids }))
    .sort((x, y) => y.names.length - x.names.length || y.bids - x.bids);
}

function Section({ title, hint, col, rows, extra }) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="hd"><h2>{title}</h2><span className="tag">{rows.length}</span></div>
      <div className="bd" style={{ fontSize: 13, color: 'var(--mut)', paddingBottom: 4 }}>{hint}</div>
      {rows.length === 0 ? (
        <div style={{ padding: '0 16px 16px', color: 'var(--faint)', fontSize: 13 }}>Nichts Auffälliges gefunden.{extra ? ' ' + extra : ''}</div>
      ) : (
        <div className="tw">
          <table className="tbl">
            <tbody>
              <tr><th className="l">{col}</th><th className="l">IC-Namen</th><th>Auktionen</th><th>Gebote</th></tr>
              {rows.map((g, i) => (
                <tr key={i}>
                  <td className="l"><b>{g.label}</b></td>
                  <td className="l"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{g.names.map((n, j) => <span key={j} className="badge mec">{n}</span>)}</div></td>
                  <td className="num">{g.aucs}</td>
                  <td className="num">{g.bids}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BieterCheck() {
  const [data, setData] = useState(null);

  async function load() {
    const sb = createClient();
    const [a, b, c] = await Promise.all([
      sb.from('auctions').select('id, model'),
      sb.from('bids').select('id, auction_id, ic_name, amount, created_at'),
      sb.from('bid_contacts').select('bid_id, discord_name, ip, device'),
    ]);
    setData({ auctions: a.data || [], bids: b.data || [], contacts: c.data || [] });
  }
  useEffect(() => { load(); }, []);

  const rep = useMemo(() => {
    if (!data) return null;
    const model = {}; data.auctions.forEach((a) => { model[a.id] = a.model; });
    const cmap = {}; data.contacts.forEach((c) => { cmap[c.bid_id] = c; });
    const bids = data.bids.map((b) => {
      const c = cmap[b.id] || {};
      return { ...b, discord: c.discord_name || '', ip: c.ip || '', device: c.device || '', model: model[b.auction_id] || 'Auktion' };
    });

    const byDiscord = flagBy(bids, (b) => norm(b.discord), (b) => b.discord);
    const byIp = flagBy(bids, (b) => (b.ip || '').trim(), (b) => b.ip);
    const byDevice = flagBy(bids, (b) => (b.device || '').trim(), (b) => 'Browser ' + String(b.device).slice(0, 8));

    const perA = {};
    for (const b of bids) {
      const k = norm(b.discord);
      if (!k) continue;
      const key = b.auction_id + '|' + k;
      const g = perA[key] || (perA[key] = { model: b.model, label: b.discord, entries: [] });
      g.entries.push({ ic: b.ic_name, amount: b.amount });
    }
    const multiBid = Object.values(perA)
      .filter((g) => g.entries.length > 1)
      .map((g) => ({ ...g, entries: g.entries.sort((a, b) => b.amount - a.amount) }))
      .sort((x, y) => y.entries.length - x.entries.length);

    return {
      byDiscord, byIp, byDevice, multiBid,
      total: bids.length,
      withDisc: bids.filter((b) => norm(b.discord)).length,
      withIp: bids.filter((b) => (b.ip || '').trim()).length,
      withDev: bids.filter((b) => (b.device || '').trim()).length,
    };
  }, [data]);

  if (!rep) return (<><div className="vhead"><h2>Bieter-Check</h2><span className="vs">Auffällige Gebote</span></div><div className="soon"><p>Lädt …</p></div></>);

  const ipExtra = rep.withIp === 0 ? '(IP wird erst ab dem letzten Update bei neuen Geboten erfasst.)' : '';
  const devExtra = rep.withDev === 0 ? '(Browser-Kennung wird erst ab dem letzten Update bei neuen Geboten erfasst.)' : '';

  return (
    <>
      <div className="vhead"><h2>Bieter-Check</h2><span className="vs">Auffällige Gebote: ein Merkmal, mehrere Namen</span></div>

      <Section col="Discord" title="Gleicher Discord-Kontakt, mehrere IC-Namen" hint="Dieselbe Discord-Angabe hat unter mehreren verschiedenen IC-Namen geboten." rows={rep.byDiscord} />
      <Section col="IP" title="Gleiche IP, mehrere IC-Namen" hint="Gebote von derselben IP unter verschiedenen IC-Namen. Starker Hinweis, aber kein Beweis, weil sich gleiches WLAN oder Handynetz oft eine IP teilt." rows={rep.byIp} extra={ipExtra} />
      <Section col="Browser" title="Gleicher Browser, mehrere IC-Namen" hint="Gebote vom selben Browser (anonyme Kennung) unter verschiedenen IC-Namen. Greift auch bei wechselnder IP, solange der Browser nicht geleert wurde." rows={rep.byDevice} extra={devExtra} />

      <div className="card">
        <div className="hd"><h2>Mehrfachgebote vom selben Kontakt in einer Auktion</h2><span className="tag">{rep.multiBid.length}</span></div>
        <div className="bd" style={{ fontSize: 13, color: 'var(--mut)', paddingBottom: 4 }}>Derselbe Discord-Kontakt hat innerhalb einer Auktion mehrmals geboten. Typisch fürs Hochtreiben des Preises.</div>
        {rep.multiBid.length === 0 ? (
          <div style={{ padding: '0 16px 16px', color: 'var(--faint)', fontSize: 13 }}>Nichts Auffälliges gefunden.</div>
        ) : (
          <div className="tw">
            <table className="tbl">
              <tbody>
                <tr><th className="l">Auktion</th><th className="l">Discord</th><th className="l">Gebote (IC-Name: Betrag)</th></tr>
                {rep.multiBid.map((g, i) => (
                  <tr key={i}>
                    <td className="l">{g.model}</td>
                    <td className="l"><b>{g.label}</b></td>
                    <td className="l"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{g.entries.map((e, j) => <span key={j} className="badge pra">{e.ic}: {fmt(e.amount)}</span>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 12, lineHeight: 1.5 }}>
        Datenbasis: {rep.total} Gebote gesamt, davon {rep.withDisc} mit Discord, {rep.withIp} mit IP, {rep.withDev} mit Browser-Kennung. IP und Browser-Kennung werden ab dem letzten Update bei neuen Geboten erfasst. Alles hier ist ein Hinweis, kein Beweis.
      </div>
    </>
  );
}
