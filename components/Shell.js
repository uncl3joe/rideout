'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Terminal from '@/components/Terminal';

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

  return (
    <>
      <header className="top">
        <div className="brand">
          <div className="mark">R</div>
          <div>
            <h1>Ride Out <span>Customs</span></h1>
            <div className="sub">Werkstatt-Terminal</div>
          </div>
        </div>
        <div className="spacer" />
        <div className="who">
          <div className="ava">{initials(profile.name)}</div>
          <div>
            <div className="nm">{profile.name}</div>
            <div className="rl">{ROLE_LABEL[role] || role}</div>
          </div>
        </div>
        <button className="linkbtn" onClick={logout}>Abmelden</button>
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
          {view === 'terminal' ? (
            <Terminal services={services} mechanicName={profile.name} />
          ) : (
            <>
              <div className="vhead">
                <h2>{NAV.find((n) => n.v === view)?.t}</h2>
              </div>
              <div className="soon">
                <div className="big">Kommt als Nächstes</div>
                <p>
                  Dieser Bereich wird gerade an die Datenbank angebunden. Das Gerüst,
                  die Rollen und die Rechte stehen – die Ansicht folgt im nächsten Schritt.
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
