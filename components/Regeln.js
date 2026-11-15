'use client';

import { useEffect, useState } from 'react';
import RegelnDoc, { RULE_ICONS } from '@/components/RegelnDoc';
import { getRulesStatus, acceptRules, saveRules, listAcceptances } from '@/app/rules-actions';

const clone = (o) => JSON.parse(JSON.stringify(o));
const ROLE = { praktikant: 'Praktikant', mechaniker: 'Mechaniker', manager: 'Manager', werkstattleitung: 'Werkstattleitung', inhaber: 'Inhaber' };
const TONES = [['good', 'Grün'], ['hot', 'Orange'], ['warn', 'Gelb']];

export default function Regeln() {
  const [st, setSt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('view'); // view | edit
  const [draft, setDraft] = useState(null);
  const [bump, setBump] = useState(true);
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [msg, setMsg] = useState('');
  const [proto, setProto] = useState(null);

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3200); }

  async function load() {
    setLoading(true);
    const res = await getRulesStatus();
    setLoading(false);
    if (res.ok) setSt(res);
    else flash('Fehler: ' + res.error);
  }
  useEffect(() => { load(); }, []);

  async function accept() {
    setAccepting(true);
    const res = await acceptRules({ version: st.version });
    setAccepting(false);
    if (res.ok) { flash('Bestätigt ✓'); load(); } else flash('Fehler: ' + res.error);
  }

  function startEdit() { setDraft(clone(st.doc)); setBump(true); setMode('edit'); }
  function patch(fn) { const d = clone(draft); fn(d); setDraft(d); }

  async function save() {
    setBusy(true);
    const res = await saveRules({ data: draft, bumpVersion: bump });
    setBusy(false);
    if (!res.ok) return flash('Fehler: ' + res.error);
    flash('Gespeichert ✓');
    setMode('view');
    load();
  }

  async function openProto() {
    const res = await listAcceptances();
    if (res.ok) setProto(res); else flash('Fehler: ' + res.error);
  }

  if (loading) return <div className="vhead"><h2>Regeln</h2></div>;
  if (!st) return <div className="vhead"><h2>Regeln</h2><span className="vs">Konnten nicht geladen werden.</span></div>;

  // ---------- Editor ----------
  if (mode === 'edit' && draft) {
    const d = draft;
    return (
      <>
        <div className="vhead"><h2>Regeln bearbeiten</h2><span className="vs">Version {st.version}{bump ? ' → ' + (st.version + 1) : ''}</span></div>

        <div className="lf-ed">
          <div className="lf-edsec">
            <div className="fields">
              <div className="field"><label>Titel</label><input type="text" value={d.title || ''} onChange={(e) => patch((x) => { x.title = e.target.value; })} /></div>
              <div className="field"><label>Untertitel</label><input type="text" value={d.subtitle || ''} onChange={(e) => patch((x) => { x.subtitle = e.target.value; })} /></div>
              <div className="field"><label>Funkfrequenz</label><input type="text" value={d.funk || ''} onChange={(e) => patch((x) => { x.funk = e.target.value; })} /></div>
              <div className="field"><label>GPS-Frequenz</label><input type="text" value={d.gps || ''} onChange={(e) => patch((x) => { x.gps = e.target.value; })} /></div>
            </div>
          </div>

          {(d.sections || []).map((s, i) => (
            <div className="lf-edsec" key={i}>
              <div className="lf-edhd">
                <span className="lf-sn">{i + 1}</span>
                <input type="text" style={{ flex: 1, minWidth: 0 }} value={s.title || ''} onChange={(e) => patch((x) => { x.sections[i].title = e.target.value; })} placeholder="Überschrift" />
                <select value={s.icon || 'shield'} onChange={(e) => patch((x) => { x.sections[i].icon = e.target.value; })}>
                  {RULE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                </select>
                <button className="lf-mini" onClick={() => patch((x) => { if (i > 0) { const t = x.sections[i - 1]; x.sections[i - 1] = x.sections[i]; x.sections[i] = t; } })}>↑</button>
                <button className="lf-mini" onClick={() => patch((x) => { if (i < x.sections.length - 1) { const t = x.sections[i + 1]; x.sections[i + 1] = x.sections[i]; x.sections[i] = t; } })}>↓</button>
                <button className="lf-mini del" onClick={() => patch((x) => { x.sections.splice(i, 1); })}>Löschen</button>
              </div>

              <label style={{ fontSize: 12, color: 'var(--mut)', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                <input type="checkbox" checked={!!s.wide} onChange={(e) => patch((x) => { x.sections[i].wide = e.target.checked; })} /> Breite Karte (zwei Hinweise nebeneinander)
              </label>

              {(s.blocks || []).map((b, j) => (
                <div className="lf-blk" key={j}>
                  <div className="lf-blkrow">
                    <select value={b.kind || 'text'} onChange={(e) => patch((x) => { x.sections[i].blocks[j].kind = e.target.value; })}>
                      <option value="text">Text</option>
                      <option value="callout">Hinweis-Box</option>
                    </select>
                    {b.kind === 'callout' && (
                      <>
                        <select value={b.tone || 'good'} onChange={(e) => patch((x) => { x.sections[i].blocks[j].tone = e.target.value; })}>
                          {TONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select>
                        <input type="text" style={{ flex: 1, minWidth: 90 }} value={b.label || ''} onChange={(e) => patch((x) => { x.sections[i].blocks[j].label = e.target.value; })} placeholder="Label" />
                      </>
                    )}
                    <button className="lf-mini del" style={{ marginLeft: 'auto' }} onClick={() => patch((x) => { x.sections[i].blocks.splice(j, 1); })}>×</button>
                  </div>
                  <textarea value={b.text || ''} onChange={(e) => patch((x) => { x.sections[i].blocks[j].text = e.target.value; })} placeholder="Text" />
                </div>
              ))}

              <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
                <button className="lf-mini" onClick={() => patch((x) => { x.sections[i].blocks = x.sections[i].blocks || []; x.sections[i].blocks.push({ kind: 'text', text: '' }); })}>+ Text</button>
                <button className="lf-mini" onClick={() => patch((x) => { x.sections[i].blocks = x.sections[i].blocks || []; x.sections[i].blocks.push({ kind: 'callout', tone: 'good', label: '', text: '' }); })}>+ Hinweis-Box</button>
              </div>
            </div>
          ))}

          <button className="btn" onClick={() => patch((x) => { x.sections = x.sections || []; x.sections.push({ title: 'Neue Regel', icon: 'shield', blocks: [{ kind: 'text', text: '' }] }); })}>+ Regel hinzufügen</button>

          <div className="lf-edsec">
            <div className="lf-edhd"><b style={{ fontFamily: 'var(--disp)', letterSpacing: '.05em', textTransform: 'uppercase', fontSize: 14 }}>Wichtige Grundregeln</b></div>
            {(d.grundregeln || []).map((g, i) => (
              <div className="lf-blkrow" key={i}>
                <input type="text" style={{ flex: 1, minWidth: 0 }} value={g.text || ''} onChange={(e) => patch((x) => { x.grundregeln[i].text = e.target.value; })} />
                <label style={{ fontSize: 12, color: 'var(--mut)', display: 'flex', gap: 5, alignItems: 'center' }}>
                  <input type="checkbox" checked={!!g.key} onChange={(e) => patch((x) => { x.grundregeln[i].key = e.target.checked; })} /> betont
                </label>
                <button className="lf-mini del" onClick={() => patch((x) => { x.grundregeln.splice(i, 1); })}>×</button>
              </div>
            ))}
            <button className="lf-mini" style={{ marginTop: 6 }} onClick={() => patch((x) => { x.grundregeln = x.grundregeln || []; x.grundregeln.push({ text: '' }); })}>+ Grundregel</button>
          </div>

          <div className="lf-edsec" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 13.5 }}>
              <input type="checkbox" checked={bump} onChange={(e) => setBump(e.target.checked)} /> Alle Mitarbeiter müssen erneut bestätigen
            </label>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => setMode('view')} disabled={busy}>Abbrechen</button>
              <button className="save" style={{ marginTop: 0, width: 'auto', padding: '11px 22px' }} onClick={save} disabled={busy}>{busy ? '…' : 'Speichern'}</button>
            </div>
          </div>
        </div>

        <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
      </>
    );
  }

  // ---------- Leseansicht ----------
  const upd = st.updatedAt ? new Date(st.updatedAt).toLocaleDateString('de-DE') : null;
  return (
    <>
      {st.isInhaber && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="btn" onClick={openProto}>Bestätigungen</button>
          <button className="btn prim" onClick={startEdit}>Bearbeiten</button>
        </div>
      )}

      {proto && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="hd"><h2>Bestätigungen — Version {proto.version}</h2><span className="tag">{proto.list.filter((x) => x.accepted_at).length}/{proto.list.length}</span></div>
          <div className="tw">
            <table className="tbl">
              <tbody>
                <tr><th className="l">Mitarbeiter</th><th className="l">Rolle</th><th>Status</th></tr>
                {proto.list.map((p) => (
                  <tr key={p.id}>
                    <td className="l">{p.name}</td>
                    <td className="l">{ROLE[p.role] || p.role}</td>
                    <td style={{ textAlign: 'center' }}>
                      {p.accepted_at
                        ? <span style={{ color: 'var(--good)' }}>✓ {new Date(p.accepted_at).toLocaleDateString('de-DE')}</span>
                        : <span style={{ color: 'var(--warn)' }}>offen</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RegelnDoc
        doc={st.doc}
        onAccept={st.accepted ? null : accept}
        accepting={accepting}
        footerNote={(st.accepted ? 'Von dir bestätigt. ' : '') + (upd ? 'Zuletzt aktualisiert ' + upd + ' · ' : '') + 'Version ' + st.version}
      />

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
