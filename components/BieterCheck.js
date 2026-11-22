'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmt } from '@/lib/format';
import { BAN_LABEL, normBanValue } from '@/lib/bans';
import { getBieterData, addBan, addBans, removeBan } from '@/app/bieter-actions';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const trimv = (s) => String(s || '').trim();
const devShort = (d) => 'Browser ' + String(d || '').slice(0, 8);
const dt = (iso) => {
  try {
    return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// ---- Cluster: Gebote ueber gemeinsame IP / Browser / Discord zu "Personen" verbinden ----
function clusterize(bids) {
  const parent = {};
  const add = (x) => { if (!(x in parent)) parent[x] = x; };
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const kic = (v) => 'ic:' + norm(v);

  for (const b of bids) {
    const ic = kic(b.ic_name); add(ic);
    if (b.discord) union(ic, 'dc:' + norm(b.discord));
    if (b.ip) union(ic, 'ip:' + trimv(b.ip));
    if (b.device) union(ic, 'dv:' + trimv(b.device));
  }

  const groups = {};
  for (const b of bids) {
    const r = find(kic(b.ic_name));
    const g = groups[r] || (groups[r] = { bids: [], ic: new Map(), dc: new Map(), ip: new Map(), dv: new Map() });
    g.bids.push(b);
    g.ic.set(norm(b.ic_name), b.ic_name);
    if (b.discord) g.dc.set(norm(b.discord), b.discord);
    if (b.ip) g.ip.set(trimv(b.ip), trimv(b.ip));
    if (b.device) g.dv.set(trimv(b.device), trimv(b.device));
  }

  return Object.values(groups).map((g) => {
    const times = g.bids.map((b) => b.created_at).sort();
    return {
      ic: [...g.ic.values()], dc: [...g.dc.values()], ip: [...g.ip.values()], dv: [...g.dv.values()],
      nBids: g.bids.length,
      nAuctions: new Set(g.bids.map((b) => b.auction_id)).size,
      first: times[0], last: times[times.length - 1],
      maxAmount: g.bids.reduce((m, b) => Math.max(m, b.amount || 0), 0),
    };
  });
}

// ---- Ueberschneidungen: ein Merkmal, mehrere IC-Namen ----
function overlaps(bids, kind) {
  const pick = (b) => (kind === 'discord' ? b.discord : kind === 'ip' ? b.ip : b.device);
  const keyf = (v) => (kind === 'discord' ? norm(v) : trimv(v));
  const by = {};
  for (const b of bids) {
    const raw = pick(b); const k = keyf(raw); if (!k) continue;
    const g = by[k] || (by[k] = { kind, value: raw, names: new Set(), aucs: new Set(), bids: 0, first: b.created_at, last: b.created_at });
    g.names.add(b.ic_name); g.aucs.add(b.auction_id); g.bids += 1;
    if (b.created_at < g.first) g.first = b.created_at;
    if (b.created_at > g.last) g.last = b.created_at;
  }
  return Object.values(by)
    .filter((g) => g.names.size > 1)
    .map((g) => ({ ...g, names: [...g.names], aucs: g.aucs.size }))
    .sort((x, y) => y.names.length - x.names.length || y.bids - x.bids);
}

// ---- Kleiner Knopf mit Sicherheitsabfrage (zweiter Klick bestaetigt) ----
function ArmButton({ label, armedLabel = 'sicher?', onConfirm, cls = '' }) {
  const [arm, setArm] = useState(false);
  return (
    <button
      type="button"
      className={'bc-ban ' + cls + (arm ? ' arm' : '')}
      onClick={() => { if (arm) { setArm(false); onConfirm(); } else { setArm(true); setTimeout(() => setArm(false), 3500); } }}
    >
      {arm ? armedLabel : label}
    </button>
  );
}

// ---- Chip mit Wert + Sperr-Knopf (oder "gesperrt"-Markierung) ----
function BanChip({ kind, value, display, banned, onBan }) {
  if (value == null || value === '') return <span className="bc-empty">—</span>;
  const isBanned = banned.has(kind + ':' + normBanValue(kind, value));
  return (
    <span className={'bc-chip k-' + kind + (isBanned ? ' banned' : '')}>
      <span className="bc-chip-v">{display || value}</span>
      {isBanned ? <span className="bc-banned-tag">gesperrt</span> : <ArmButton label="sperren" onConfirm={() => onBan(kind, value)} />}
    </span>
  );
}

export default function BieterCheck() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(60);
  const [form, setForm] = useState({ kind: 'ic', value: '', reason: '' });

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  async function load() {
    const res = await getBieterData();
    if (!res.ok) { setErr(res.error || 'Konnte Daten nicht laden.'); return; }
    setErr('');
    setData({ auctions: res.auctions, bids: res.bids, contacts: res.contacts, bans: res.bans });
  }
  useEffect(() => { load(); }, []);

  async function doBan(kind, value, reason) {
    const res = await addBan({ kind, value, reason: reason || null });
    if (!res.ok) { flash('Fehler: ' + res.error); return; }
    flash('Gesperrt: ' + BAN_LABEL[kind] + ' ' + value);
    load();
  }
  async function doBanGroup(cluster) {
    const items = [
      ...cluster.ic.map((v) => ({ kind: 'ic', value: v })),
      ...cluster.dc.map((v) => ({ kind: 'discord', value: v })),
    ];
    const res = await addBans({ items });
    if (!res.ok) { flash('Fehler: ' + res.error); return; }
    flash(res.count + ' Einträge gesperrt (Namen + Discord)');
    load();
  }
  async function doUnban(id) {
    const res = await removeBan({ id });
    if (!res.ok) { flash('Fehler: ' + res.error); return; }
    flash('Entsperrt');
    load();
  }
  async function submitBan(e) {
    e.preventDefault();
    if (!form.value.trim()) { flash('Bitte einen Wert eingeben.'); return; }
    await doBan(form.kind, form.value.trim(), form.reason.trim());
    setForm({ kind: form.kind, value: '', reason: '' });
  }

  const rep = useMemo(() => {
    if (!data) return null;
    const model = {}; data.auctions.forEach((a) => { model[a.id] = a.model; });
    const cmap = {}; data.contacts.forEach((c) => { cmap[c.bid_id] = c; });
    const bids = data.bids.map((b) => {
      const c = cmap[b.id] || {};
      return { ...b, discord: c.discord_name || '', ip: c.ip || '', device: c.device || '', model: model[b.auction_id] || 'Auktion' };
    });

    const banned = new Set(data.bans.map((b) => b.kind + ':' + b.value));

    const clusters = clusterize(bids)
      .filter((g) => g.ic.length > 1 || g.dc.length > 1)
      .sort((x, y) => (y.ic.length + y.dc.length) - (x.ic.length + x.dc.length) || y.nBids - x.nBids);

    const byDiscord = overlaps(bids, 'discord');
    const byIp = overlaps(bids, 'ip');
    const byDevice = overlaps(bids, 'device');

    const perA = {};
    for (const b of bids) {
      const k = norm(b.discord); if (!k) continue;
      const key = b.auction_id + '|' + k;
      const g = perA[key] || (perA[key] = { model: b.model, label: b.discord, entries: [] });
      g.entries.push({ ic: b.ic_name, amount: b.amount });
    }
    const multiBid = Object.values(perA)
      .filter((g) => g.entries.length > 1)
      .map((g) => ({ ...g, entries: g.entries.sort((a, b) => b.amount - a.amount) }))
      .sort((x, y) => y.entries.length - x.entries.length);

    const protocol = [...bids].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      bids, banned, clusters, byDiscord, byIp, byDevice, multiBid, protocol,
      bans: [...data.bans].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      stats: {
        total: bids.length,
        ics: new Set(bids.map((b) => norm(b.ic_name)).filter(Boolean)).size,
        discs: new Set(bids.map((b) => norm(b.discord)).filter(Boolean)).size,
        ips: new Set(bids.map((b) => trimv(b.ip)).filter(Boolean)).size,
        devs: new Set(bids.map((b) => trimv(b.device)).filter(Boolean)).size,
        bans: data.bans.length,
      },
    };
  }, [data]);

  if (err) return (<><div className="vhead"><h2>Bieter-Check</h2><span className="vs">Auffällige Gebote</span></div><div className="soon"><p>{err}</p></div></>);
  if (!rep) return (<><div className="vhead"><h2>Bieter-Check</h2><span className="vs">Auffällige Gebote</span></div><div className="soon"><p>Lädt …</p></div></>);

  const f = filter.trim().toLowerCase();
  const protoFiltered = f
    ? rep.protocol.filter((b) => [b.ic_name, b.discord, b.ip, b.device, b.model].some((v) => String(v || '').toLowerCase().includes(f)))
    : rep.protocol;
  const protoShown = protoFiltered.slice(0, limit);

  // Protokoll-Zellen als schlichter Text; gesperrte Werte rot markiert.
  const plainVal = (kind, value, display) => {
    if (!value) return <span className="bc-empty">—</span>;
    const isB = rep.banned.has(kind + ':' + normBanValue(kind, value));
    return <span style={isB ? { color: 'var(--bad)', fontWeight: 600 } : undefined}>{display || value}</span>;
  };

  return (
    <>
      <div className="vhead"><h2>Bieter-Check</h2><span className="vs">Wer, wo, was, wann, und wer zusammengehört</span></div>

      {/* ---- Statistik ---- */}
      <div className="bc-stats">
        <div className="bc-tile"><div className="n">{rep.stats.total}</div><div className="k">Gebote</div></div>
        <div className="bc-tile"><div className="n">{rep.stats.ics}</div><div className="k">IC-Namen</div></div>
        <div className="bc-tile"><div className="n">{rep.stats.discs}</div><div className="k">Discord</div></div>
        <div className="bc-tile"><div className="n">{rep.stats.ips}</div><div className="k">IPs</div></div>
        <div className="bc-tile"><div className="n">{rep.stats.devs}</div><div className="k">Browser</div></div>
        <div className="bc-tile bad"><div className="n">{rep.stats.bans}</div><div className="k">Gesperrt</div></div>
      </div>

      {/* ---- Verdächtige Cluster ---- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="hd"><h2>Wahrscheinlich dieselbe Person</h2><span className="tag">{rep.clusters.length}</span></div>
        <div className="bd" style={{ fontSize: 13, color: 'var(--mut)', paddingBottom: 4 }}>
          Gebote, die über gleiche IP, gleichen Browser oder gleichen Discord zusammenhängen, aber unter mehreren IC-Namen oder mehreren Discord-Namen laufen. Starker Hinweis auf eine Person mit mehreren Identitäten.
        </div>
        {rep.clusters.length === 0 ? (
          <div className="bc-none">Keine zusammenhängenden Mehrfach-Identitäten gefunden.</div>
        ) : (
          <div className="bc-cls">
            {rep.clusters.map((g, i) => (
              <div className="bc-cl" key={i}>
                <div className="bc-cl-top">
                  <div className="bc-cl-meta">
                    <b>{g.ic.length} IC-Namen</b>{g.dc.length > 1 ? ', ' + g.dc.length + ' Discord' : ''} · {g.nBids} Gebote · {g.nAuctions} Auktion(en) · bis {fmt(g.maxAmount)}<br />
                    <span className="bc-dim">{dt(g.first)} bis {dt(g.last)}</span>
                  </div>
                  <ArmButton label="Gruppe sperren" armedLabel="Namen + Discord sperren?" cls="grp" onConfirm={() => doBanGroup(g)} />
                </div>
                <div className="bc-groups">
                  <div className="bc-grp"><span className="bc-grp-l">IC-Namen</span><div className="bc-chips">{g.ic.map((v, j) => <BanChip key={j} kind="ic" value={v} banned={rep.banned} onBan={doBan} />)}</div></div>
                  {g.dc.length > 0 && <div className="bc-grp"><span className="bc-grp-l">Discord</span><div className="bc-chips">{g.dc.map((v, j) => <BanChip key={j} kind="discord" value={v} banned={rep.banned} onBan={doBan} />)}</div></div>}
                  {g.ip.length > 0 && <div className="bc-grp"><span className="bc-grp-l">IPs</span><div className="bc-chips">{g.ip.map((v, j) => <BanChip key={j} kind="ip" value={v} banned={rep.banned} onBan={doBan} />)}</div></div>}
                  {g.dv.length > 0 && <div className="bc-grp"><span className="bc-grp-l">Browser</span><div className="bc-chips">{g.dv.map((v, j) => <BanChip key={j} kind="device" value={v} display={devShort(v)} banned={rep.banned} onBan={doBan} />)}</div></div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Merkmal-Überschneidungen ---- */}
      <OverlapCard title="Gleiche IP, mehrere IC-Namen" hint="Gebote von derselben IP unter verschiedenen IC-Namen. Hinweis, kein Beweis: gleiches WLAN oder Handynetz teilt sich oft eine IP." kind="ip" rows={rep.byIp} banned={rep.banned} onBan={doBan} />
      <OverlapCard title="Gleicher Browser, mehrere IC-Namen" hint="Gebote vom selben Browser (anonyme Kennung) unter verschiedenen IC-Namen. Greift auch bei wechselnder IP, solange der Browser nicht geleert wurde." kind="device" rows={rep.byDevice} banned={rep.banned} onBan={doBan} />
      <OverlapCard title="Gleicher Discord, mehrere IC-Namen" hint="Dieselbe Discord-Angabe hat unter mehreren verschiedenen IC-Namen geboten." kind="discord" rows={rep.byDiscord} banned={rep.banned} onBan={doBan} />

      {/* ---- Mehrfachgebote in einer Auktion ---- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="hd"><h2>Mehrfachgebote in einer Auktion</h2><span className="tag">{rep.multiBid.length}</span></div>
        <div className="bd" style={{ fontSize: 13, color: 'var(--mut)', paddingBottom: 4 }}>Derselbe Discord-Kontakt hat innerhalb einer Auktion mehrmals geboten. Typisch fürs Hochtreiben des Preises.</div>
        {rep.multiBid.length === 0 ? (
          <div className="bc-none">Nichts Auffälliges gefunden.</div>
        ) : (
          <div className="tw"><table className="tbl"><tbody>
            <tr><th className="l">Auktion</th><th className="l">Discord</th><th className="l">Gebote (IC-Name: Betrag)</th></tr>
            {rep.multiBid.map((g, i) => (
              <tr key={i}>
                <td className="l">{g.model}</td>
                <td className="l"><BanChip kind="discord" value={g.label} banned={rep.banned} onBan={doBan} /></td>
                <td className="l"><div className="bc-chips">{g.entries.map((e, j) => <span key={j} className="badge pra">{e.ic}: {fmt(e.amount)}</span>)}</div></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </div>

      {/* ---- Komplettes Protokoll ---- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="hd"><h2>Gebots-Protokoll</h2><span className="tag">{protoFiltered.length}</span></div>
        <div className="bd" style={{ paddingBottom: 10 }}>
          <input className="bc-filter" placeholder="Filtern nach IC-Name, Discord, IP, Browser oder Auktion …" value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(60); }} />
        </div>
        {protoShown.length === 0 ? (
          <div className="bc-none">Keine Gebote.</div>
        ) : (
          <div className="tw"><table className="tbl"><tbody>
            <tr><th>Zeit</th><th className="l">Auktion</th><th className="l">IC-Name</th><th className="l">Discord</th><th className="l">IP</th><th className="l">Browser</th><th>Betrag</th></tr>
            {protoShown.map((b, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--mut)', fontSize: 12.5 }}>{dt(b.created_at)}</td>
                <td className="l">{b.model}</td>
                <td className="l">{plainVal('ic', b.ic_name)}</td>
                <td className="l">{plainVal('discord', b.discord)}</td>
                <td className="l">{plainVal('ip', b.ip)}</td>
                <td className="l">{plainVal('device', b.device, devShort(b.device))}</td>
                <td className="num">{fmt(b.amount)}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        {protoFiltered.length > protoShown.length && (
          <div style={{ padding: '12px 16px 16px' }}><button className="btn" onClick={() => setLimit(limit + 100)}>Mehr anzeigen ({protoFiltered.length - protoShown.length} weitere)</button></div>
        )}
      </div>

      {/* ---- Sperrliste ---- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="hd"><h2>Sperrliste</h2><span className="tag">{rep.bans.length}</span></div>
        <div className="bd" style={{ fontSize: 13, color: 'var(--mut)', paddingBottom: 4 }}>
          Gesperrte IC-Namen, Discord-Namen, IPs oder Browser können kein Gebot mehr abgeben. Du kannst hier manuell sperren oder jederzeit wieder entsperren. Direkt sperren geht auch überall oben per „sperren" neben dem Eintrag.
        </div>
        <form className="bc-banform" onSubmit={submitBan}>
          <select className="bc-sel" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="ic">IC-Name</option>
            <option value="discord">Discord</option>
            <option value="ip">IP-Adresse</option>
            <option value="device">Browser-Kennung</option>
          </select>
          <input className="bc-input" placeholder="Wert (z. B. Name, Discord oder IP)" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <input className="bc-input" placeholder="Grund (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <button className="bc-sperrbtn" type="submit">Sperren</button>
        </form>
        {rep.bans.length === 0 ? (
          <div className="bc-none">Niemand gesperrt.</div>
        ) : (
          <div className="tw"><table className="tbl"><tbody>
            <tr><th className="l">Typ</th><th className="l">Wert</th><th className="l">Grund</th><th className="l">Von</th><th>Wann</th><th></th></tr>
            {rep.bans.map((b) => (
              <tr key={b.id}>
                <td className="l">{BAN_LABEL[b.kind] || b.kind}</td>
                <td className="l"><b>{b.kind === 'device' ? devShort(b.value) : b.value}</b></td>
                <td className="l" style={{ color: 'var(--mut)' }}>{b.reason || '—'}</td>
                <td className="l" style={{ color: 'var(--mut)' }}>{b.created_by || '—'}</td>
                <td className="num" style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{dt(b.created_at)}</td>
                <td style={{ textAlign: 'right' }}><button className="btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => doUnban(b.id)}>Entsperren</button></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 12, lineHeight: 1.5 }}>
        Datenbasis: {rep.stats.total} Gebote. IP und Browser-Kennung werden seit v41 bei neuen Geboten erfasst, ältere Gebote haben diese Felder leer. Alles hier ist ein Hinweis, kein Beweis.
      </div>

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}

// ---- Wiederverwendbare Karte fuer Merkmal-Ueberschneidungen ----
function OverlapCard({ title, hint, kind, rows, banned, onBan }) {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="hd"><h2>{title}</h2><span className="tag">{rows.length}</span></div>
      <div className="bd" style={{ fontSize: 13, color: 'var(--mut)', paddingBottom: 4 }}>{hint}</div>
      {rows.length === 0 ? (
        <div className="bc-none">Nichts Auffälliges gefunden.</div>
      ) : (
        <div className="tw"><table className="tbl"><tbody>
          <tr><th className="l">{BAN_LABEL[kind]}</th><th className="l">IC-Namen</th><th>Auktionen</th><th>Gebote</th><th className="l">Zeitraum</th></tr>
          {rows.map((g, i) => (
            <tr key={i}>
              <td className="l"><BanChip kind={kind} value={g.value} display={kind === 'device' ? devShort(g.value) : undefined} banned={banned} onBan={onBan} /></td>
              <td className="l"><div className="bc-chips">{g.names.map((n, j) => <BanChip key={j} kind="ic" value={n} banned={banned} onBan={onBan} />)}</div></td>
              <td className="num">{g.aucs}</td>
              <td className="num">{g.bids}</td>
              <td className="l" style={{ color: 'var(--mut)', fontSize: 12, whiteSpace: 'nowrap' }}>{dt(g.first)}<br />{dt(g.last)}</td>
            </tr>
          ))}
        </tbody></table></div>
      )}
    </div>
  );
}
