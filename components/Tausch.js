import PublicNav from '@/components/PublicNav';

// Platzhalter fuer Etappe 2 (die eigentliche Tauschboerse kommt als Naechstes).
export default function Tausch() {
  return (
    <>
      <PublicNav active="tausch" />

      <header className="pub-head">
        <div className="pub-glow" />
        <div className="pub-hwrap">
          <div className="pub-ey">Tauschbörse</div>
          <h1 className="pub-h2">Auto gegen <span className="o">Auto.</span></h1>
          <p className="pub-lead">Biete dein Fahrzeug und finde deinen Tausch, direkt mit anderen, ganz ohne Umweg.</p>
        </div>
      </header>

      <div className="pub-teamwrap">
        <div className="pub-empty">Bald verfügbar. Hier kannst du demnächst selbst dein Fahrzeug zum Tausch anbieten.</div>
      </div>

      <footer className="pub-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Ride Out Customs" />
        <div className="t">Ride Out Customs <span>· Werkstatt · Tuning · Fahrzeughandel</span></div>
      </footer>
    </>
  );
}
