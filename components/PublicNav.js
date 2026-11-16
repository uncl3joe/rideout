import Link from 'next/link';

// Gemeinsame Kopf-Navigation aller oeffentlichen Seiten.
const ITEMS = [
  ['start', 'Start', '/'],
  ['shop', 'Fahrzeugmarkt', '/shop'],
  ['auktion', 'Auktion', '/auktion'],
  ['tausch', 'Tauschbörse', '/tausch'],
  ['team', 'Team', '/team'],
];

export default function PublicNav({ active }) {
  return (
    <nav className="pub-nav">
      <Link className="pub-brand" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Ride Out Customs" />
        <span className="pub-wm">Ride Out Customs</span>
      </Link>
      <div className="pub-links">
        {ITEMS.map(([k, t, h]) => (
          <Link key={k} href={h} className={'pub-navlink' + (active === k ? ' on' : '')}>{t}</Link>
        ))}
      </div>
      <Link className="pub-login" href="/intern">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        Anmelden
      </Link>
    </nav>
  );
}
