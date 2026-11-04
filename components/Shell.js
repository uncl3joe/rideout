'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Terminal from '@/components/Terminal';
import Uebersicht from '@/components/Uebersicht';
import Statistik from '@/components/Statistik';
import Mitarbeiter from '@/components/Mitarbeiter';
import Ausgaben from '@/components/Ausgaben';
import Vertraege from '@/components/Vertraege';
import Katalog from '@/components/Katalog';
import Autohandel from '@/components/Autohandel';

const isLeitung = (r) => ['manager', 'werkstattleitung', 'inhaber'].includes(r);
const isWL = (r) => ['werkstattleitung', 'inhaber'].includes(r);
const isInhaber = (r) => r === 'inhaber';

const NAV = [
  { v: 'terminal', t: 'Mein Terminal', ic: '🔧', grp: 'Arbeit', can: () => true },
  { v: 'uebersicht', t: 'Übersicht', ic: '📊', grp: 'Auswertung', can: isWL },
  { v: 'statistik', t: 'Statistik', ic: '📈', grp: 'Auswertung', can: isWL },
  { v: 'mitarbeiter', t: 'Mitarbeiter', ic: '👥', grp: 'Auswertung', can: isWL },
  { v: 'ausgaben', t: 'Ausgaben', ic: '💸', grp: 'Auswertung', can: isWL },
  { v: 'vertraege', t: 'Verträge', ic: '📄', grp: 'Geschäft', can: isLeitung },
  { v: 'autohandel', t: 'Autohandel', ic: '🏎️', grp: 'Geschäft', can: isLeitung },
  { v: 'katalog', t: 'Preise & Katalog', ic: '🏷️', grp: 'Admin', can: isInhaber },
];

const ROLE_LABEL = {
  praktikant: 'Praktikant',
  mechaniker: 'Mechaniker',
  manager: 'Manager',
  werkstattleitung: 'Werkstattleitung',
  inhaber: 'Inhaber',
};

function initials(name) {
  return (
    String(name || '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || '–'
  );
}

export default function Shell({ profile, services }) {
  const router = useRouter();
  const role = profile.role;
  const items = NAV.filter((n) => n.can(role));
  const [view, setView] = useState('terminal');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [toast, setToast] = useState('');

  // Nach Gruppen ordnen (Reihenfolge bleibt erhalten)
  const groups = [];
  items.forEach((n) => {
    let g = groups.find((x) => x.name === n.grp);
    if (!g) {
      g = { name: n.grp, items: [] };
      groups.push(g);
    }
    g.items.push(n);
  });

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  async function changePw() {
    if (pw1.length < 6) return setPwMsg('Mindestens 6 Zeichen.');
    if (pw1 !== pw2) return setPwMsg('Passwörter stimmen nicht überein.');
    setPwBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwBusy(false);
    if (error) return setPwMsg('Fehler: ' + error.message);
    setPwMsg('');
    setPw1('');
    setPw2('');
    setPwOpen(false);
    setToast('Passwort geändert ✓');
    setTimeout(() => setToast(''), 2800);
  }

  return (
    <>
      <header className="top">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" className="brandlogo" alt="Ride Out Customs" />
          <div className="brandsub">Werkstatt-Terminal</div>
        </div>
        <div className="spacer" />
        <div className="usermenu" onClick={(e) => e.stopPropagation()}>
          <button className="whobtn" onClick={() => setMenuOpen((o) => !o)}>
            <div className="ava">{initials(profile.name)}</div>
            <div className="whotxt">
              <div className="nm">{profile.name}</div>
              <div className="rl">{ROLE_LABEL[role] || role}</div>
            </div>
            <span className="caret">▾</span>
          </button>
          {menuOpen && (
            <div className="menu">
              <button onClick={() => { setMenuOpen(false); setPwOpen(true); }}>Passwort ändern</button>
              <button onClick={logout}>Abmelden</button>
            </div>
          )}
        </div>
      </header>

      <div className="app">
        <aside className="nav">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="nlbl">{g.name}</div>
              {g.items.map((n) => (
                <button
                  key={n.v}
                  className={'navbtn' + (view === n.v ? ' active' : '')}
                  onClick={() => setView(n.v)}
                >
                  <span className="ic">{n.ic}</span>
                  {n.t}
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="content">
          {view === 'terminal' && <Terminal services={services} mechanicName={profile.name} userId={profile.id} />}
          {view === 'uebersicht' && <Uebersicht />}
          {view === 'statistik' && <Statistik />}
          {view === 'mitarbeiter' && <Mitarbeiter role={role} />}
          {view === 'ausgaben' && <Ausgaben />}
          {view === 'vertraege' && <Vertraege />}
          {view === 'katalog' && <Katalog />}
          {view === 'autohandel' && <Autohandel role={role} userId={profile.id} myName={profile.name} />}
        </main>
      </div>

      {pwOpen && (
        <div className="modal-backdrop" onClick={() => setPwOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Passwort ändern</h3>
            <div className="field"><label>Neues Passwort</label><input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} /></div>
            <div className="field"><label>Wiederholen</label><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            <div className="err">{pwMsg}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn" onClick={() => setPwOpen(false)}>Abbrechen</button>
              <button className="save" style={{ marginTop: 0, width: 'auto', padding: '10px 18px' }} onClick={changePw} disabled={pwBusy}>
                {pwBusy ? '…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
    </>
  );
}
