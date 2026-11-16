'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { shrinkImage } from '@/lib/image-resize';
import { createListing } from '@/app/tausch-actions';

const UploadIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v13" />
  </svg>
);

// Laedt ein Foto verkleinert in den Unterordner 'tausch/' des Buckets 'vehicles'
// und gibt die oeffentliche URL zurueck. Lange Cache-Zeit spart Egress.
async function uploadImage(file) {
  const sb = createClient();
  const small = await shrinkImage(file, { maxDim: 1024, quality: 0.82, force: true });
  const t = small.type || 'image/jpeg';
  const ext = t.includes('webp') ? 'webp' : t.includes('png') ? 'png' : t.includes('gif') ? 'gif' : 'jpg';
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2);
  const path = 'tausch/' + Date.now() + '_' + rand + '.' + ext;
  const { error } = await sb.storage.from('vehicles').upload(path, small, {
    upsert: false,
    contentType: small.type || undefined,
    cacheControl: '2592000',
  });
  if (error) throw error;
  return sb.storage.from('vehicles').getPublicUrl(path).data.publicUrl;
}

function PhotoPick({ label, hint, optional, preview, onPick, onClear, disabled }) {
  return (
    <div className="tb-field">
      <label>{label}{optional && <span className="opt"> (optional)</span>}</label>
      {preview ? (
        <div className="tb-prev">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Vorschau" />
          <button type="button" className="tb-prevx" onClick={onClear} disabled={disabled} aria-label="Foto entfernen">✕</button>
        </div>
      ) : (
        <label className="tb-drop">
          <div className="ic"><UploadIcon /></div>
          <div className="mn">Foto hochladen</div>
          <div className="sm">{hint}</div>
          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={disabled}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
        </label>
      )}
    </div>
  );
}

export default function TauschForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [offerModel, setOfferModel] = useState('');
  const [seekText, setSeekText] = useState('');
  const [offerFile, setOfferFile] = useState(null);
  const [offerPrev, setOfferPrev] = useState('');
  const [seekFile, setSeekFile] = useState(null);
  const [seekPrev, setSeekPrev] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  function flash(m) { setErr(m); setTimeout(() => setErr(''), 4000); }

  function pickOffer(f) { if (offerPrev) URL.revokeObjectURL(offerPrev); setOfferFile(f); setOfferPrev(URL.createObjectURL(f)); }
  function clearOffer() { if (offerPrev) URL.revokeObjectURL(offerPrev); setOfferFile(null); setOfferPrev(''); }
  function pickSeek(f) { if (seekPrev) URL.revokeObjectURL(seekPrev); setSeekFile(f); setSeekPrev(URL.createObjectURL(f)); }
  function clearSeek() { if (seekPrev) URL.revokeObjectURL(seekPrev); setSeekFile(null); setSeekPrev(''); }

  function reset() {
    setFirstName(''); setLastName(''); setPhone(''); setOfferModel(''); setSeekText('');
    clearOffer(); clearSeek();
  }

  async function submit(e) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return flash('Bitte Vor- und Nachnamen angeben.');
    if (!phone.trim()) return flash('Bitte eine Telefonnummer angeben.');
    if (!offerModel.trim()) return flash('Bitte das Fahrzeug angeben, das du anbietest.');
    if (!offerFile) return flash('Bitte ein Foto deines Fahrzeugs hochladen.');
    if (!seekText.trim()) return flash('Bitte angeben, welches Fahrzeug du suchst.');

    setBusy(true);
    try {
      const offerImage = await uploadImage(offerFile);
      let seekImage = null;
      if (seekFile) seekImage = await uploadImage(seekFile);
      const res = await createListing({ firstName, lastName, phone, offerModel, offerImage, seekText, seekImage });
      if (!res.ok) throw new Error(res.error || 'Konnte das Inserat nicht speichern.');
      reset();
      setDone(true);
      router.refresh();
    } catch (e2) {
      flash('Fehler: ' + (e2.message || 'Upload fehlgeschlagen'));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="tb-form tb-ok">
        <div className="tb-okmark">✓</div>
        <h2>Inserat ist online</h2>
        <p>Dein Inserat ist jetzt in der Tauschbörse sichtbar und läuft 30 Tage. Interessenten melden sich über deine Telefonnummer.</p>
        <button className="tb-submit" onClick={() => setDone(false)}>Weiteres Inserat einstellen</button>
      </div>
    );
  }

  return (
    <form className="tb-form" onSubmit={submit}>
      <h2>Inserat einstellen</h2>
      <div className="fsub">Trag dein Fahrzeug ein und was du dafür suchst. Kontaktiert wirst du über Name und Telefon.</div>

      <div className="tb-row">
        <div className="tb-field"><label>Vorname</label><input className="tb-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Max" maxLength={40} disabled={busy} /></div>
        <div className="tb-field"><label>Nachname</label><input className="tb-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Berger" maxLength={40} disabled={busy} /></div>
      </div>
      <div className="tb-field"><label>Telefonnummer</label><input className="tb-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0660 555 0142" maxLength={40} inputMode="tel" disabled={busy} /></div>

      <div className="tb-sec">Das biete ich <span className="ln" /></div>
      <div className="tb-field"><label>Fahrzeug</label><input className="tb-input" value={offerModel} onChange={(e) => setOfferModel(e.target.value)} placeholder="z. B. Elegy RH8, getuned" maxLength={80} disabled={busy} /></div>
      <PhotoPick label="Foto deines Fahrzeugs" hint="JPG oder PNG, wird automatisch verkleinert" preview={offerPrev} onPick={pickOffer} onClear={clearOffer} disabled={busy} />

      <div className="tb-sec">Das suche ich <span className="ln" /></div>
      <div className="tb-field"><label>Welches Fahrzeug suchst du?</label><textarea className="tb-area" value={seekText} onChange={(e) => setSeekText(e.target.value)} placeholder="z. B. Muscle Car, am liebsten Dominator oder Gauntlet" maxLength={500} disabled={busy} /></div>
      <PhotoPick label="Foto des gesuchten Fahrzeugs" optional hint="Optional, falls du ein bestimmtes Modell im Kopf hast" preview={seekPrev} onPick={pickSeek} onClear={clearSeek} disabled={busy} />

      {err && <div className="tb-err">{err}</div>}

      <button type="submit" className="tb-submit" disabled={busy}>{busy ? 'Wird hochgeladen …' : 'Inserat veröffentlichen'}</button>
      <div className="tb-note">Dein Inserat läuft 30 Tage und wird danach automatisch entfernt.<br />Die Werkstattleitung kann Inserate bei Bedarf entfernen.</div>
    </form>
  );
}
