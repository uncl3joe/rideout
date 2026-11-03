'use client';

import { useMemo, useRef, useState } from 'react';
import { saveOrder } from '@/app/actions';

const PROV = 0.3;
const fmt = (n) => Math.round(n).toLocaleString('de-DE') + ' $';
const numf = (n) => Math.round(n).toLocaleString('de-DE');
const CAT_ORDER = ['Motor & Leistung', 'Lackierung', 'Pflege', 'Reparaturen', 'Wartung', 'Optik', 'Arbeitsleistung'];

export default function Terminal({ services, mechanicName }) {
  const byName = useMemo(() => {
    const m = {};
    services.forEach((s) => (m[s.name] = s));
    return m;
  }, [services]);

  // Services nach Kategorie gruppieren (bevorzugte Reihenfolge zuerst)
  const grouped = useMemo(() => {
    const g = {};
    services.forEach((s) => (g[s.category] = g[s.category] || []).push(s));
    const keys = CAT_ORDER.filter((k) => g[k]).concat(
      Object.keys(g).filter((k) => !CAT_ORDER.includes(k))
    );
    return keys.map((k) => ({ cat: k, items: g[k].slice().sort((a, b) => b.vk - a.vk) }));
  }, [services]);

  const [sel, setSel] = useState('');
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState([]);
  const [customer, setCustomer] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ssum, setSsum] = useState('');
  const [thumb, setThumb] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [savedToday, setSavedToday] = useState([]);
  const fileRef = useRef(null);
  const toastTimer = useRef(null);

  function flash(m) {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }

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

  function readImg(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => {
      setThumb(ev.target.result);
      flash('Bild geladen – in der echten App liest die KI es später aus');
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
      setThumb(cv.toDataURL('image/png'));
      flash('Bildschirm-Ausschnitt aufgenommen ✓');
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
    setSavedToday((prev) => [
      { customer: customer || 'Laufkunde', umsatz: res.umsatz, provision: res.provision, n: lines.length },
      ...prev,
    ]);
    setLines([]);
    setCustomer('');
    setSsum('');
    setThumb(null);
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
            <span className="tag">Screenshot → Rechnung</span>
          </div>
          <div className="bd">
            <p className="lbl">Auftrags-Screenshot</p>
            <div className="shot">
              <div className="thumb">{thumb ? <img src={thumb} alt="" /> : 'kein Bild'}</div>
              <div className="btns">
                <button className="btn prim" type="button" onClick={() => flash('Mach einfach Strg+V – das Bild landet hier')}>
                  📋 Einfügen
                </button>
                <button className="btn" type="button" onClick={capture}>🖥️ Bildschirm aufnehmen</button>
                <label className="btn" style={{ cursor: 'pointer' }}>
                  📁 Datei
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => e.target.files[0] && readImg(e.target.files[0])}
                  />
                </label>
                <span className="hint">Strg+V fügt direkt ein.</span>
              </div>
            </div>
            <div className="ki-note">
              In der echten App liest die KI die Leistungen automatisch aus dem Bild. Hier wählst du sie noch manuell.
            </div>

            <div style={{ marginTop: 16 }}>
              <p className="lbl">Leistung hinzufügen</p>
              <div className="addrow">
                <select value={sel} onChange={(e) => setSel(e.target.value)}>
                  <option value="">— Leistung wählen —</option>
                  {grouped.map((g) => (
                    <optgroup key={g.cat} label={g.cat}>
                      {g.items.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} · {numf(s.vk)} $
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  className="qty num"
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  aria-label="Anzahl"
                />
                <button className="add" type="button" onClick={addLine} aria-label="Hinzufügen">+</button>
              </div>
            </div>

            <div className="lines">
              {lines.length === 0 ? (
                <div className="empty">Noch keine Leistung – oben hinzufügen.</div>
              ) : (
                lines.map((l, i) => {
                  const c = byName[l.name] || { vk: 0, category: '' };
                  const base = c.vk * l.qty;
                  const adj = base * calc.factor;
                  return (
                    <div className="ln" key={l.name}>
                      <div className="nm">
                        {l.name}
                        <small>{c.category}</small>
                      </div>
                      <div className="q num">×{l.qty}</div>
                      <div className="pr num">
                        {calc.factor !== 1 ? (
                          <>
                            <s>{fmt(base)}</s>
                            {fmt(adj)}
                          </>
                        ) : (
                          fmt(base)
                        )}
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

        <section className="card">
          <div className="hd">
            <h2>Heute gespeichert</h2>
            <span className="tag">diese Sitzung</span>
          </div>
          <div className="bd">
            {savedToday.length === 0 ? (
              <div style={{ color: 'var(--faint)', fontSize: 13 }}>Noch keine Aufträge gespeichert.</div>
            ) : (
              savedToday.map((o, i) => (
                <div className="ln" key={i} style={{ borderRadius: 9, marginBottom: 6 }}>
                  <div className="nm">{o.customer}<small>{o.n} Leistung(en)</small></div>
                  <div className="q num">{fmt(o.umsatz)}</div>
                  <div className="pr num" style={{ color: 'var(--accent)' }}>+{fmt(o.provision)}</div>
                  <span />
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
    </div>
  );
}
