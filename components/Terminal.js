'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { saveOrder } from '@/app/actions';
import { readScreenshot } from '@/app/ai-actions';
import { periodStartISO } from '@/lib/format';

const PROV = 0.3;
const fmt = (n) => Math.round(n).toLocaleString('de-DE') + ' $';
const numf = (n) => Math.round(n).toLocaleString('de-DE');
const CAT_ORDER = ['Motor & Leistung', 'Lackierung', 'Pflege', 'Reparaturen', 'Wartung', 'Optik', 'Arbeitsleistung'];
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MO = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
const timeOf = (ts) => {
  try {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  } catch {
    return '';
  }
};

// Bild verkleinern (für schnellen Upload an die KI).
function toScaled(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 1600;
      const scale = Math.min(1, maxW / img.width);
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

export default function Terminal({ services, mechanicName, userId }) {
  const byName = useMemo(() => {
    const m = {};
    services.forEach((s) => (m[s.name] = s));
    return m;
  }, [services]);

  const grouped = useMemo(() => {
    const g = {};
    services.forEach((s) => (g[s.category] = g[s.category] || []).push(s));
    const keys = CAT_ORDER.filter((k) => g[k]).concat(Object.keys(g).filter((k) => !CAT_ORDER.includes(k)));
    return keys.map((k) => ({ cat: k, items: g[k].slice().sort((a, b) => b.vk - a.vk) }));
  }, [services]);

  const [sel, setSel] = useState('');
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState([]);
  const [customer, setCustomer] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ssum, setSsum] = useState('');
  const [thumb, setThumb] = useState(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [myOrders, setMyOrders] = useState(null);
  const toastTimer = useRef(null);

  function flash(m) {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }

  async function loadMine() {
    if (!userId) return;
    const sb = createClient();
    const { data } = await sb
      .from('orders')
      .select('id, order_date, customer, umsatz, provision, created_at, order_items(service_name, qty)')
      .eq('mechanic_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    setMyOrders(data || []);
  }
  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const mine = useMemo(() => {
    if (!myOrders) return null;
    const tISO = periodStartISO('heute');
    const bucket = (start) => {
      const o = myOrders.filter((x) => x.order_date >= start);
      return { auf: o.length, um: o.reduce((s, x) => s + x.umsatz, 0), prov: o.reduce((s, x) => s + x.provision, 0) };
    };
    const todayOrders = myOrders.filter((x) => x.order_date >= tISO);
    const cnt = {};
    todayOrders.forEach((o) => (o.order_items || []).forEach((it) => {
      cnt[it.service_name] = (cnt[it.service_name] || 0) + it.qty;
    }));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      heute: bucket(tISO),
      woche: bucket(periodStartISO('woche')),
      monat: bucket(periodStartISO('monat')),
      todayOrders,
      top,
    };
  }, [myOrders]);

  const now = new Date();
  const dateStr = WD[now.getDay()] + ', ' + now.getDate() + '. ' + MO[now.getMonth()];

  const calc = useMemo(() => {
    let basis = 0;
    let material = 0;
    lines.forEach((l) => {
      const c = byName[l.name];
      if (!c) return;
      basis += c.vk * l.qty;
      material += c.material * l.qty;
    });
    const s = Number(ssum) || 0;
    const factor = s > 0 && basis > 0 ? s / basis : 1;
    const umsatz = basis * factor;
    return { basis, factor, umsatz, material, reingewinn: umsatz - material, provision: (umsatz - material) * PROV };
  }, [lines, ssum, byName]);

  function addLine() {
    if (!sel) return;
    const q = Math.max(1, parseInt(qty, 10) || 1);
    setLines((prev) => {
      const ex = prev.find((l) => l.name === sel);
      if (ex) return prev.map((l) => (l.name === sel ? { ...l, qty: l.qty + q } : l));
      return [...prev, { name: sel, qty: q }];
    });
    setQty(1);
  }
  function removeLine(i) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function clearLines() {
    setLines([]);
    setSsum('');
    setThumb(null);
  }

  async function runAI(dataURL) {
    setReading(true);
    try {
      const scaled = await toScaled(dataURL);
      const base64 = scaled.split(',')[1];
      const res = await readScreenshot({ imageBase64: base64, mimeType: 'image/jpeg' });
      if (!res.ok) {
        flash(res.error || 'KI-Fehler');
        return;
      }
      // Kunde + Kennzeichen automatisch übernehmen (nur wenn Feld noch leer ist)
      if (res.customer) setCustomer((prev) => (prev && prev.trim() ? prev : res.customer));
      if (res.items && res.items.length) {
        // Ergänzen statt überschreiben: nur Leistungen hinzufügen, die noch
        // nicht in der Liste stehen (für lange Listen in mehreren Aufnahmen).
        const have = new Set(lines.map((l) => l.name));
        const additions = res.items.filter((i) => !have.has(i.name));
        const dupes = res.items.length - additions.length;
        setLines((prev) => {
          const ph = new Set(prev.map((l) => l.name));
          return [...prev, ...res.items.filter((i) => !ph.has(i.name)).map((i) => ({ name: i.name, qty: i.qty }))];
        });
        if (res.total) setSsum(String(res.total)); // Summe nur setzen, wenn im Bild sichtbar
        flash(
          additions.length
            ? additions.length + ' neue Leistung(en) hinzugefügt' + (dupes ? ' · ' + dupes + ' schon drin' : '')
            : 'Alles schon erfasst – nichts Neues im Bild'
        );
      } else {
        flash('KI hat nichts Passendes erkannt – bitte manuell hinzufügen');
      }
    } catch {
      flash('KI-Fehler beim Auslesen');
    } finally {
      setReading(false);
    }
  }

  function readImg(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      setThumb(ev.target.result);
      runAI(ev.target.result);
    };
    r.readAsDataURL(file);
  }
  function onPaste(e) {
    const items = (e.clipboardData || {}).items || [];
    for (const it of items) {
      if (it.type && it.type.indexOf('image') === 0) {
        readImg(it.getAsFile());
        e.preventDefault();
        break;
      }
    }
  }
  async function capture() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error();
      const st = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const v = document.createElement('video');
      v.srcObject = st;
      await v.play();
      const cv = document.createElement('canvas');
      cv.width = v.videoWidth;
      cv.height = v.videoHeight;
      cv.getContext('2d').drawImage(v, 0, 0);
      st.getTracks().forEach((t) => t.stop());
      const url = cv.toDataURL('image/png');
      setThumb(url);
      runAI(url);
    } catch {
      flash('Bildschirmaufnahme vom Browser blockiert oder abgebrochen');
    }
  }

  async function save() {
    if (!lines.length) return;
    setBusy(true);
    const res = await saveOrder({ customer, orderDate, screenshotSum: Number(ssum) || 0, items: lines });
    setBusy(false);
    if (!res.ok) {
      flash('Fehler: ' + res.error);
      return;
    }
    setLines([]);
    setCustomer('');
    setSsum('');
    setThumb(null);
    loadMine();
    flash('Auftrag gespeichert ✓');
  }

  return (
    <div onPaste={onPaste}>
      <div className="vhead">
        <h2>Mein Terminal</h2>
        <span className="vs">{mechanicName}</span>
      </div>

      <div className="grid">
        <section className="card">
          <div className="hd">
            <h2>Neuer Auftrag</h2>
            <span className="tag">Screenshot → KI → Rechnung</span>
          </div>
          <div className="bd">
            <p className="lbl">Auftrags-Screenshot</p>
            <div className="shot">
              <div className="thumb">
                {reading ? <span>KI liest …</span> : thumb ? <img src={thumb} alt="" /> : 'kein Bild'}
              </div>
              <div className="btns">
                <button className="btn prim" type="button" onClick={() => flash('Mach einfach Strg+V – das Bild landet hier')}>
                  📋 Einfügen
                </button>
                <button className="btn" type="button" onClick={capture}>🖥️ Bildschirm aufnehmen</button>
                <label className="btn" style={{ cursor: 'pointer' }}>
                  📁 Datei
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && readImg(e.target.files[0])} />
                </label>
                <span className="hint">Strg+V fügt direkt ein. Die KI liest die Leistungen automatisch aus.</span>
              </div>
            </div>
            <div className="ki-note">
              {reading
                ? 'Die KI liest den Screenshot gerade aus …'
                : 'Screenshot einfügen oder aufnehmen → die KI erkennt die Leistungen. Lange Liste? Einfach runterscrollen und nochmal aufnehmen — Neues wird ergänzt, Doppelte werden erkannt.'}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <p className="lbl" style={{ margin: 0 }}>Leistung hinzufügen / korrigieren</p>
                {lines.length > 0 && (
                  <button type="button" onClick={clearLines}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--faint)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Liste leeren
                  </button>
                )}
              </div>
              <div className="addrow">
                <select value={sel} onChange={(e) => setSel(e.target.value)}>
                  <option value="">— Leistung wählen —</option>
                  {grouped.map((g) => (
                    <optgroup key={g.cat} label={g.cat}>
                      {g.items.map((s) => (
                        <option key={s.id} value={s.name}>{s.name} · {numf(s.vk)} $</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input className="qty num" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Anzahl" />
                <button className="add" type="button" onClick={addLine} aria-label="Hinzufügen">+</button>
              </div>
            </div>

            <div className="lines">
              {lines.length === 0 ? (
                <div className="empty">Noch keine Leistung – Screenshot auslesen oder oben hinzufügen.</div>
              ) : (
                lines.map((l, i) => {
                  const c = byName[l.name] || { vk: 0, category: '' };
                  const base = c.vk * l.qty;
                  const adj = base * calc.factor;
                  return (
                    <div className="ln" key={l.name}>
                      <div className="nm">{l.name}<small>{c.category}</small></div>
                      <div className="q num">×{l.qty}</div>
                      <div className="pr num">
                        {calc.factor !== 1 ? (<><s>{fmt(base)}</s>{fmt(adj)}</>) : fmt(base)}
                      </div>
                      <button className="x" onClick={() => removeLine(i)} aria-label="Entfernen">✕</button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="fields">
              <div className="field">
                <label htmlFor="kunde">Kunde / Kennzeichen</label>
                <input id="kunde" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="z. B. Mara Huncho (FYN741)" />
              </div>
              <div className="field">
                <label htmlFor="datum">Datum</label>
                <input id="datum" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
              <div className="field f3">
                <label htmlFor="ssum">Screenshot-Summe (optional – passt die Preise automatisch an)</label>
                <input id="ssum" className="num" type="number" min="0" value={ssum} onChange={(e) => setSsum(e.target.value)} placeholder="z. B. 15525" />
              </div>
            </div>

            {Number(ssum) > 0 && calc.basis > 0 && (
              <div className="adjnote">
                Angepasst auf <b>{fmt(Number(ssum))}</b> · Faktor <b>{calc.factor.toFixed(3)}×</b> (Basispreis {fmt(calc.basis)})
              </div>
            )}

            <div className="kpis">
              <div className="kpi rev"><div className="k">Umsatz</div><div className="v num">{fmt(calc.umsatz)}</div></div>
              <div className="kpi"><div className="k">Material</div><div className="v num">{fmt(calc.material)}</div></div>
              <div className="kpi"><div className="k">Reingewinn</div><div className="v num">{fmt(calc.reingewinn)}</div></div>
              <div className="kpi pro"><div className="k">Provision 30%</div><div className="v num">{fmt(calc.provision)}</div></div>
            </div>

            <button className="save" onClick={save} disabled={busy || lines.length === 0}>
              {busy ? 'Speichern …' : 'Auftrag speichern'}
            </button>
          </div>
        </section>

        <section>
          <div className="card">
            <div className="hd"><h2>Heute</h2><span className="tag">{dateStr}</span></div>
            <div className="daykpis">
              <div className="kpi"><div className="k">Aufträge</div><div className="v num">{mine ? mine.heute.auf : 0}</div></div>
              <div className="kpi rev"><div className="k">Umsatz</div><div className="v num">{fmt(mine ? mine.heute.um : 0)}</div></div>
              <div className="kpi pro"><div className="k">Deine Provision</div><div className="v num">{fmt(mine ? mine.heute.prov : 0)}</div></div>
            </div>
            <div className="ords">
              {!mine ? (
                <div style={{ padding: '22px 16px', color: 'var(--faint)', fontSize: 13 }}>Lädt …</div>
              ) : mine.todayOrders.length === 0 ? (
                <div style={{ padding: '22px 16px', color: 'var(--faint)', fontSize: 13 }}>Noch keine Aufträge heute.</div>
              ) : (
                mine.todayOrders.map((o) => {
                  const its = o.order_items || [];
                  const names = its.map((it) => it.service_name + (it.qty > 1 ? ' ×' + it.qty : '')).join(' · ');
                  return (
                    <div className="ord" key={o.id}>
                      <div className="r1"><span className="cust">{o.customer || 'Laufkunde'}</span><span className="tm">{timeOf(o.created_at)}</span></div>
                      <div className="r2">
                        <span className="chip">{its.length} Leistung{its.length !== 1 ? 'en' : ''}</span>
                        <span className="money"><span className="um num">{fmt(o.umsatz)}</span><span className="pv num">+{fmt(o.provision)} Prov.</span></span>
                      </div>
                      {names && <div className="svc">{names}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="hd"><h2>Meine Übersicht</h2><span className="tag">Woche &amp; Monat</span></div>
            <div className="per">
              <div className="prow">
                <span className="pl">Diese Woche</span>
                <span className="pa num">{mine ? mine.woche.auf : 0} Aufträge</span>
                <span className="grp"><span className="pu num">{fmt(mine ? mine.woche.um : 0)}</span><span className="pp num">+{fmt(mine ? mine.woche.prov : 0)} Prov.</span></span>
              </div>
              <div className="prow">
                <span className="pl">Dieser Monat</span>
                <span className="pa num">{mine ? mine.monat.auf : 0} Aufträge</span>
                <span className="grp"><span className="pu num">{fmt(mine ? mine.monat.um : 0)}</span><span className="pp num">+{fmt(mine ? mine.monat.prov : 0)} Prov.</span></span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="hd"><h2>Meistverkauft heute</h2><span className="tag">deine Leistungen</span></div>
            <div className="bd">
              <div className="bar">
                {!mine || mine.top.length === 0 ? (
                  <div style={{ color: 'var(--faint)', fontSize: 13 }}>Noch keine Verkäufe heute.</div>
                ) : (
                  mine.top.map(([n, c]) => (
                    <div className="brow" key={n}>
                      <span className="bn">{n}</span>
                      <span className="bt"><i style={{ width: Math.round((c / mine.top[0][1]) * 100) + '%' }} /></span>
                      <span className="bc">{c}×</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
    </div>
  );
}
