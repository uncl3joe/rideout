'use client';

import { Fragment, useMemo, useState } from 'react';
import { fmt, initials } from '@/lib/format';
import { analyzeImport, commitImport } from '@/app/reconcile-actions';

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

export default function Abgleich() {
  const [jobs, setJobs] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [nameMap, setNameMap] = useState({}); // norm(name) -> mechanicId
  const [stepMat, setStepMat] = useState({}); // schritt -> value (string)
  const [expanded, setExpanded] = useState({});
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [result, setResult] = useState(null);

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 3500);
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setResult(null);
    setExpanded({});
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      const js = data.auftraege || (Array.isArray(data) ? data : null);
      if (!Array.isArray(js)) throw new Error('Kein gültiges Export-Format (auftraege fehlt).');
      const res = await analyzeImport({ jobs: js });
      if (!res.ok) throw new Error(res.error);
      setJobs(js);
      setAnalysis(res);
      const nm = {};
      for (const m of res.mechNames) {
        if (m.mechanicId) nm[m.norm] = m.mechanicId;
        else if (m.status === 'suggest' && m.suggestionId) nm[m.norm] = m.suggestionId;
      }
      setNameMap(nm);
      const sm = {};
      for (const s of res.steps) sm[s.schritt] = s.material == null ? '' : String(s.material);
      setStepMat(sm);
    } catch (err) {
      flash('Fehler: ' + (err.message || err));
      setAnalysis(null);
      setJobs(null);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  const profiles = analysis?.profiles || [];
  const profById = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);
  const importedSet = useMemo(() => new Set((analysis?.alreadyImported || []).map(Number)), [analysis]);

  const matVal = (schritt) => {
    const v = stepMat[schritt];
    return v === '' || v == null ? 0 : Number(v) || 0;
  };

  // Soll (Wahrheit aus JSON) live berechnen.
  const soll = useMemo(() => {
    if (!jobs || !analysis) return null;
    const byMech = {};
    const unmatched = []; // Aufträge ohne Namenszuordnung
    let billed = 0, storno = 0, inArbeit = 0, alreadyImp = 0;
    for (const j of jobs) {
      if (j.stand === 'Storniert') { storno++; continue; }
      if (j.stand === 'In Arbeit') { inArbeit++; continue; }
      if (j.stand !== 'Abgerechnet') continue;
      billed++;
      const id = Number(j.auftrag);
      if (importedSet.has(id)) { alreadyImp++; continue; }
      const mechId = nameMap[norm(j.mechaniker)] || null;
      const umsatz = Math.round(Number(j.abgerechnet) || 0);
      let material = 0;
      for (const s of j.schritte || []) material += matVal(s.schritt);
      material = Math.round(material);
      const reingewinn = umsatz - material;
      if (!mechId || !profById[mechId]) {
        unmatched.push({ name: j.mechaniker, auftrag: id, umsatz });
        continue;
      }
      const rate = profById[mechId].rate;
      const provision = Math.max(0, Math.round(reingewinn * rate));
      const nullspiel = reingewinn <= 0;
      const b = byMech[mechId] || (byMech[mechId] = { auf: 0, umsatz: 0, reingewinn: 0, provision: 0, nullspiel: 0, jobs: [] });
      b.auf += 1; b.umsatz += umsatz; b.reingewinn += reingewinn; b.provision += provision;
      if (nullspiel) b.nullspiel += 1;
      b.jobs.push({ auftrag: id, datum: String(j.erstellt || '').slice(0, 10), kunde: j.kunde, art: j.art, umsatz, reingewinn, provision, nullspiel });
    }
    for (const k of Object.keys(byMech)) byMech[k].jobs.sort((a, b) => b.umsatz - a.umsatz);
    return { byMech, unmatched, billed, storno, inArbeit, alreadyImp };
  }, [jobs, analysis, nameMap, stepMat, importedSet, profById]);

  const ist = analysis?.istByMech || {};

  const rows = useMemo(() => {
    if (!soll) return [];
    const ids = new Set([...Object.keys(soll.byMech), ...Object.keys(ist).filter((k) => k !== '—')]);
    return [...ids]
      .map((id) => {
        const s = soll.byMech[id] || { auf: 0, umsatz: 0, reingewinn: 0, provision: 0, nullspiel: 0, jobs: [] };
        const i = ist[id] || { auf: 0, umsatz: 0, reingewinn: 0, provision: 0 };
        return { id, name: profById[id]?.name || '—', s, i };
      })
      .sort((a, b) => b.s.umsatz - a.s.umsatz);
  }, [soll, ist, profById]);

  const steps = analysis?.steps || [];
  const missingSteps = useMemo(() => steps.filter((s) => stepMat[s.schritt] === '' || stepMat[s.schritt] == null), [steps, stepMat]);
  const unresolvedNames = useMemo(
    () => (analysis?.mechNames || []).filter((m) => !nameMap[m.norm]),
    [analysis, nameMap]
  );

  async function commit() {
    if (!jobs) return;
    const warn = [];
    if (unresolvedNames.length) warn.push(unresolvedNames.length + ' Mechaniker-Namen ohne Zuordnung (deren Aufträge werden übersprungen)');
    if (missingSteps.length) warn.push(missingSteps.length + ' Schritte ohne Materialwert (werden als 0 gerechnet)');
    const txt = 'Import jetzt übernehmen?' + (warn.length ? '\n\nAchtung:\n- ' + warn.join('\n- ') : '') +
      '\n\nDie Hand-Einträge in diesem Zeitraum werden als ersetzt markiert und zählen nicht mehr doppelt.';
    if (!confirm(txt)) return;
    setBusy(true);
    try {
      const res = await commitImport({ jobs, nameMap, stepMaterials: stepMat });
      if (!res.ok) throw new Error(res.error);
      setResult(res);
      setAnalysis(null);
      setJobs(null);
      flash('Import übernommen ✓');
    } catch (e) {
      flash('Fehler: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  const tot = useMemo(() => {
    const t = { su: 0, si: 0, pu: 0, pi: 0 };
    for (const r of rows) { t.su += r.s.umsatz; t.si += r.i.umsatz; t.pu += r.s.provision; t.pi += r.i.provision; }
    return t;
  }, [rows]);

  const delta = (a, b) => {
    const d = a - b;
    if (d === 0) return <span style={{ color: 'var(--faint)' }}>±0</span>;
    return <span style={{ color: d > 0 ? '#36c275' : '#ff6b6b' }}>{d > 0 ? '+' : ''}{fmt(d)}</span>;
  };

  return (
    <>
      <div className="vhead">
        <h2>Abgleich</h2>
        <span className="vs">Werkstatt-Export (JSON) gegen die Hand-Einträge prüfen · nur Inhaber</span>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="hd"><h2>JSON-Export einspielen</h2></div>
        <div className="bd">
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--mut)', lineHeight: 1.5 }}>
            Export aus dem Werkstattskript hochladen. Es wird zuerst nur verglichen, gespeichert wird erst, wenn du unten auf „Übernehmen" drückst. Schon importierte Aufträge erkennt das System an der Auftragsnummer und überspringt sie.
          </p>
          <input type="file" accept=".json,application/json,.txt" onChange={onFile} disabled={busy} />
          {busy && <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--mut)' }}>Verarbeite …</span>}
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginBottom: 18, borderColor: '#36c275' }}>
          <div className="hd"><h2>Import übernommen</h2><span className="tag">{result.period?.start} bis {result.period?.end}</span></div>
          <div className="bd" style={{ fontSize: 13.5, lineHeight: 1.7 }}>
            <b style={{ color: 'var(--txt)' }}>{result.imported}</b> Aufträge übernommen.{' '}
            {result.skippedDup > 0 && <>{result.skippedDup} schon vorher importiert. </>}
            {result.skippedNoMech > 0 && <>{result.skippedNoMech} ohne Namenszuordnung übersprungen. </>}
            {result.skippedStatus > 0 && <>{result.skippedStatus} nicht abgerechnet (Storno/offen). </>}
            {result.superseded > 0 && <><br />{result.superseded} Hand-Einträge im Zeitraum als ersetzt markiert.</>}
          </div>
        </div>
      )}

      {analysis && soll && (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="hd"><h2>Überblick</h2><span className="tag">{analysis.period?.start} bis {analysis.period?.end}</span></div>
            <div className="bd" style={{ fontSize: 13.5, lineHeight: 1.8 }}>
              <b>{jobs.length}</b> Aufträge im File · <b>{soll.billed}</b> abgerechnet · {soll.storno} storniert (zählen nicht) · {soll.inArbeit} in Arbeit · <b>{soll.alreadyImp}</b> schon importiert (übersprungen)
              <div style={{ marginTop: 6 }}>
                Zu übernehmen: <b style={{ color: 'var(--txt)' }}>{soll.billed - soll.alreadyImp - soll.unmatched.length}</b> Aufträge.
                {soll.unmatched.length > 0 && <span style={{ color: '#ffb02e' }}> {soll.unmatched.length} noch ohne Namenszuordnung.</span>}
              </div>
            </div>
          </div>

          {unresolvedNames.length > 0 && (
            <div className="card" style={{ marginBottom: 18, borderColor: '#ffb02e' }}>
              <div className="hd"><h2>Namen zuordnen</h2><span className="tag">{unresolvedNames.length} offen</span></div>
              <div className="bd">
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--mut)' }}>
                  Diese Namen aus dem Export passen nicht eindeutig auf ein Profil. Bitte zuordnen (einmalig, wird gemerkt).
                </p>
                {unresolvedNames.map((m) => (
                  <div key={m.norm} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ minWidth: 180, fontSize: 13.5 }}>„{m.name}"{m.status === 'suggest' && m.suggestionName ? <span style={{ color: 'var(--faint)' }}> (ähnlich: {m.suggestionName})</span> : ''}</span>
                    <span style={{ color: 'var(--faint)' }}>→</span>
                    <select value={nameMap[m.norm] || ''} onChange={(e) => setNameMap((p) => ({ ...p, [m.norm]: e.target.value || undefined }))}>
                      <option value="">— ignorieren —</option>
                      {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(missingSteps.length > 0 || showAllSteps) && (
            <div className="card" style={{ marginBottom: 18, borderColor: missingSteps.length ? '#ffb02e' : undefined }}>
              <div className="hd">
                <h2>Material pro Schritt</h2>
                {missingSteps.length > 0 && <span className="tag">{missingSteps.length} ohne Wert</span>}
              </div>
              <div className="bd">
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--mut)' }}>
                  Materialkosten (Einkauf) je Arbeitsschritt. Aus dem Katalog vorbefüllt, wo möglich. Ohne Wert wird als 0 gerechnet. Wird beim Übernehmen gespeichert.
                </p>
                <div className="tw">
                  <table className="tbl">
                    <tbody>
                      <tr><th className="l">Schritt</th><th>Material ($)</th><th>Quelle</th></tr>
                      {(showAllSteps ? steps : missingSteps).map((s) => (
                        <tr key={s.schritt}>
                          <td className="l">{s.schritt}</td>
                          <td style={{ textAlign: 'center' }}>
                            <input className="vkin" type="number" min="0" style={{ width: 110 }}
                              value={stepMat[s.schritt] ?? ''}
                              onChange={(e) => setStepMat((p) => ({ ...p, [s.schritt]: e.target.value }))} />
                          </td>
                          <td className="num" style={{ color: 'var(--faint)', fontSize: 12 }}>
                            {s.source === 'saved' ? 'gespeichert' : s.source === 'katalog' ? 'Katalog' : 'fehlt'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn" style={{ marginTop: 10, padding: '7px 12px', fontSize: 12.5 }} onClick={() => setShowAllSteps((v) => !v)}>
                  {showAllSteps ? 'nur fehlende zeigen' : 'alle ' + steps.length + ' Schritte anzeigen'}
                </button>
              </div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 18 }}>
            <div className="hd"><h2>Soll (JSON) gegen Ist (eingetragen)</h2></div>
            <div className="tw">
              <table className="tbl">
                <tbody>
                  <tr>
                    <th className="l">Mechaniker</th>
                    <th>Aufträge</th>
                    <th>Umsatz</th>
                    <th>Reingewinn</th>
                    <th>Provision</th>
                    <th>Reing. n. Prov.</th>
                    <th></th>
                  </tr>
                  {rows.length === 0 ? (
                    <tr><td className="l" colSpan={7} style={{ color: 'var(--faint)' }}>Nichts zu vergleichen.</td></tr>
                  ) : rows.map((r) => {
                    const op = expanded[r.id];
                    return (
                      <Fragment key={r.id}>
                        <tr>
                          <td className="l"><div className="who2"><div className="ava">{initials(r.name)}</div><div>{r.name}</div></div></td>
                          <td className="num">
                            <b>{r.s.auf}</b>{r.s.nullspiel > 0 && <span style={{ color: 'var(--faint)', fontSize: 11 }}> ({r.s.nullspiel} EL)</span>}
                            <div style={{ color: 'var(--faint)', fontSize: 11 }}>Ist {r.i.auf}</div>
                          </td>
                          <td className="num umc">
                            <b>{fmt(r.s.umsatz)}</b>
                            <div style={{ fontSize: 11 }}>Ist {fmt(r.i.umsatz)} · {delta(r.s.umsatz, r.i.umsatz)}</div>
                          </td>
                          <td className="num">
                            <b>{fmt(r.s.reingewinn)}</b>
                            <div style={{ fontSize: 11 }}>Ist {fmt(r.i.reingewinn)} · {delta(r.s.reingewinn, r.i.reingewinn)}</div>
                          </td>
                          <td className="num pvc">
                            <b>{fmt(r.s.provision)}</b>
                            <div style={{ fontSize: 11 }}>Ist {fmt(r.i.provision)} · {delta(r.s.provision, r.i.provision)}</div>
                          </td>
                          <td className="num">
                            <b>{fmt(r.s.reingewinn - r.s.provision)}</b>
                            <div style={{ color: 'var(--faint)', fontSize: 11 }}>Ist {fmt(r.i.reingewinn - r.i.provision)}</div>
                          </td>
                          <td><button className="btn" style={{ padding: '4px 9px', fontSize: 12 }} onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))}>{op ? '▴' : '▾'}</button></td>
                        </tr>
                        {op && (
                          <tr>
                            <td colSpan={7} style={{ background: 'rgba(255,255,255,.02)' }}>
                              <div style={{ padding: '6px 4px', fontSize: 12.5 }}>
                                <div style={{ color: 'var(--mut)', marginBottom: 6 }}>Aufträge aus dem JSON (Soll), „EL" = Eigenleistung/Nullspiel mit ~0 Reingewinn:</div>
                                <div className="tw">
                                  <table className="tbl">
                                    <tbody>
                                      <tr><th>Nr.</th><th>Datum</th><th className="l">Kunde</th><th className="l">Art</th><th>Umsatz</th><th>Reingewinn</th><th>Provision</th><th>Typ</th></tr>
                                      {r.s.jobs.map((j) => (
                                        <tr key={j.auftrag}>
                                          <td className="num">#{j.auftrag}</td>
                                          <td className="num">{j.datum}</td>
                                          <td className="l">{j.kunde || '—'}</td>
                                          <td className="l">{j.art || '—'}</td>
                                          <td className="num umc">{fmt(j.umsatz)}</td>
                                          <td className="num">{fmt(j.reingewinn)}</td>
                                          <td className="num pvc">{fmt(j.provision)}</td>
                                          <td style={{ textAlign: 'center' }}>{j.nullspiel ? <span className="badge pra">EL</span> : <span style={{ color: 'var(--faint)' }}>normal</span>}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {rows.length > 0 && (
                    <tr>
                      <td className="l"><b>Gesamt</b></td>
                      <td></td>
                      <td className="num umc"><b>{fmt(tot.su)}</b><div style={{ fontSize: 11 }}>Ist {fmt(tot.si)} · {delta(tot.su, tot.si)}</div></td>
                      <td></td>
                      <td className="num pvc"><b>{fmt(tot.pu)}</b><div style={{ fontSize: 11 }}>Ist {fmt(tot.pi)} · {delta(tot.pu, tot.pi)}</div></td>
                      <td></td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {soll.unmatched.length > 0 && (
            <div style={{ fontSize: 12.5, color: '#ffb02e', marginBottom: 12 }}>
              {soll.unmatched.length} abgerechnete Aufträge haben keinen zugeordneten Mechaniker und werden nicht übernommen, bis du den Namen oben zuordnest.
            </div>
          )}

          <button className="save" style={{ width: 'auto', padding: '12px 22px' }} onClick={commit} disabled={busy}>
            {busy ? '…' : 'Übernehmen'}
          </button>
        </>
      )}

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
