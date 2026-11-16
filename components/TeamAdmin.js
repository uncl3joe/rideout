'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { shrinkImage } from '@/lib/image-resize';
import { setTeamVisibility, setTeamPhoto } from '@/app/team-actions';
import { ROLE_LABEL, roleBadgeClass, initials } from '@/lib/format';

// Backend-Tab (Leitung): steuert, wer auf der oeffentlichen Team-Seite erscheint,
// und laedt die Fotos hoch. Mitarbeiter selbst haben hier keinen Zugriff.
export default function TeamAdmin() {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  async function load() {
    const sb = createClient();
    const { data } = await sb.from('profiles').select('id, name, role, show_on_team, photo_url, active').order('name');
    setRows((data || []).filter((p) => p.active !== false));
  }
  useEffect(() => { load(); }, []);

  async function toggle(p) {
    const show = !p.show_on_team;
    setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, show_on_team: show } : x)));
    const res = await setTeamVisibility({ profileId: p.id, show });
    if (!res.ok) { flash('Fehler: ' + res.error); load(); }
    else flash(show ? 'Wird auf der Team-Seite gezeigt ✓' : 'Von der Team-Seite entfernt');
  }

  async function uploadPhoto(p, file) {
    if (!file) return;
    setBusyId(p.id);
    try {
      const sb = createClient();
      const small = await shrinkImage(file, { maxDim: 512, force: true });
      const path = 'avatars/' + p.id + '_' + Date.now() + '.' + (small.type === 'image/webp' ? 'webp' : 'jpg');
      const { error } = await sb.storage.from('vehicles').upload(path, small, { upsert: false, contentType: small.type || undefined, cacheControl: '2592000' });
      if (error) throw error;
      const url = sb.storage.from('vehicles').getPublicUrl(path).data.publicUrl;
      const res = await setTeamPhoto({ profileId: p.id, url });
      if (!res.ok) throw new Error(res.error);
      setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, photo_url: url } : x)));
      flash('Foto gespeichert ✓');
    } catch (e) {
      flash('Fehler: ' + (e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function removePhoto(p) {
    const res = await setTeamPhoto({ profileId: p.id, url: null });
    if (!res.ok) return flash('Fehler: ' + res.error);
    setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, photo_url: null } : x)));
    flash('Foto entfernt');
  }

  const shownCount = (rows || []).filter((r) => r.show_on_team).length;

  return (
    <>
      <div className="vhead"><h2>Team-Seite</h2><span className="vs">Wer öffentlich erscheint &amp; Fotos</span></div>

      <div className="card">
        <div className="hd"><h2>Öffentliche Mitarbeiter</h2><span className="tag">{shownCount} sichtbar</span></div>
        <div className="bd" style={{ fontSize: 13, color: 'var(--mut)', paddingBottom: 4 }}>
          Setz den Haken bei den Mitarbeitern, die auf der öffentlichen Team-Seite erscheinen sollen. Fotos lädst du bzw. die Leitung hoch, die Mitarbeiter selbst nicht. Fotos werden beim Upload automatisch verkleinert.
        </div>

        {!rows ? (
          <div className="soon"><p>Lädt …</p></div>
        ) : (
          <div className="tw">
            <table className="tbl">
              <tbody>
                <tr><th className="l">Foto</th><th className="l">Name</th><th className="l">Rang</th><th>Auf Team-Seite</th><th></th></tr>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="l">
                      <div className="ta-av">
                        {p.photo_url
                          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.photo_url} alt={p.name} />
                          : <span>{initials(p.name)}</span>}
                      </div>
                    </td>
                    <td className="l">{p.name}</td>
                    <td className="l"><span className={'badge ' + roleBadgeClass(p.role)}>{ROLE_LABEL[p.role] || p.role}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={!!p.show_on_team} onChange={() => toggle(p)} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <label className="btn" style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
                          {busyId === p.id ? '…' : (p.photo_url ? 'Foto ändern' : 'Foto hochladen')}
                          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={busyId === p.id} onChange={(e) => { uploadPhoto(p, e.target.files?.[0]); e.target.value = ''; }} />
                        </label>
                        {p.photo_url && <button className="xdel" title="Foto entfernen" onClick={() => removePhoto(p)}>✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={'toast' + (msg ? ' on' : '')}>{msg}</div>
    </>
  );
}
