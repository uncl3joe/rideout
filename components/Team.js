import PublicNav from '@/components/PublicNav';
import { initials, ROLE_LABEL } from '@/lib/format';

// Reihenfolge und Gruppen-Überschriften der oeffentlichen Team-Seite.
const GROUPS = [
  ['inhaber', 'Inhaber'],
  ['werkstattleitung', 'Werkstattleitung'],
  ['manager', 'Manager'],
  ['mechaniker', 'Mechaniker'],
  ['praktikant', 'Praktikanten'],
];

export default function Team({ members = [] }) {
  const byRole = {};
  for (const m of members) (byRole[m.role] = byRole[m.role] || []).push(m);

  return (
    <>
      <PublicNav active="team" />

      <header className="pub-head">
        <div className="pub-glow" />
        <div className="pub-hwrap">
          <div className="pub-ey">Unser Team</div>
          <h1 className="pub-h2">Die Leute hinter <span className="o">ROC.</span></h1>
          <p className="pub-lead">Werkstatt, Tuning und Fahrzeughandel. Das ist die Crew, die bei Ride Out Customs anpackt.</p>
        </div>
      </header>

      <div className="pub-teamwrap">
        {members.length === 0 ? (
          <div className="pub-empty">Aktuell sind keine Mitarbeiter freigeschaltet.</div>
        ) : (
          GROUPS.filter(([r]) => (byRole[r] || []).length).map(([r, label]) => (
            <div className="pub-group" key={r}>
              <div className="pub-glabel"><h2>{label}</h2><div className="pub-ln" /><div className="pub-ct">{byRole[r].length}</div></div>
              <div className="pub-mgrid">
                {byRole[r].map((m, i) => (
                  <div className="pub-mcard" key={i}>
                    <div className="pub-av">
                      {m.photo_url
                        ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.photo_url} alt={m.name} />
                        : <span>{initials(m.name)}</span>}
                    </div>
                    <div className="pub-mname">{m.name}</div>
                    <div className="pub-mrole">{ROLE_LABEL[m.role] || m.role}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <footer className="pub-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Ride Out Customs" />
        <div className="t">Ride Out Customs <span>· Werkstatt · Tuning · Fahrzeughandel</span></div>
      </footer>
    </>
  );
}
