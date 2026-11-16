import Link from 'next/link';
import PublicNav from '@/components/PublicNav';

const SI = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export default function Landing({ vehicleCount = 0, auctionLive = false }) {
  return (
    <>
      <PublicNav active="start" />

      <header className="pub-hero">
        <div className="pub-glow" />
        <div className="pub-vig" />
        <div className="pub-wrap">
          <div className="pub-ey">Werkstatt · Tuning · Fahrzeughandel</div>
          <h1 className="pub-h1">Dein Ride.<br /><span className="o">Unser Custom.</span></h1>
          <p className="pub-lead">Kaufen, ersteigern oder tauschen. Geprüfte Fahrzeuge aus unserer Werkstatt, sauber abgewickelt von unserem Team.</p>
          <div className="pub-chips"><span>Geprüfte Fahrzeuge</span><span>Live-Auktionen</span><span>Auto gegen Auto</span></div>
          <div className="pub-cta">
            <Link className="pub-btn p" href="/shop">Zum Fahrzeugmarkt
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            <Link className="pub-btn s" href="/auktion">Live-Auktionen ansehen</Link>
          </div>
        </div>
      </header>

      <section className="pub-feat">
        <Link className="pub-fcard" href="/shop">
          <div className="pub-ftop"><span className="pub-lab">Fahrzeugmarkt</span>
            <span className="pub-fic"><svg width="22" height="22" viewBox="0 0 24 24" {...SI}><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" /><path d="M4 13h16v4H4z" /><circle cx="7.5" cy="17.5" r="1.4" /><circle cx="16.5" cy="17.5" r="1.4" /></svg></span>
          </div>
          <h3>Fahrzeug kaufen</h3>
          <p>{vehicleCount > 0 ? vehicleCount + (vehicleCount === 1 ? ' Fahrzeug' : ' Fahrzeuge') + ' im Bestand, in einem Klick reservieren.' : 'Geprüfter Bestand aus unserer Werkstatt, in einem Klick reservieren.'}</p>
        </Link>

        <Link className="pub-fcard" href="/auktion">
          <div className="pub-ftop"><span className="pub-lab">Auktion</span>
            <span className="pub-fic"><svg width="22" height="22" viewBox="0 0 24 24" {...SI}><path d="M14 3l7 7-4 4-7-7zM5 21l6-6M3 14l7 7" /></svg></span>
          </div>
          <h3>Live mitbieten</h3>
          <p>{auctionLive ? 'Gerade läuft eine Auktion, jetzt mitbieten.' : 'Das höchste Gebot gewinnt. Start, Countdown und Zuschlag in Echtzeit.'}</p>
          {auctionLive && <div className="pub-live"><i />Live</div>}
        </Link>

        <Link className="pub-fcard" href="/tausch">
          <div className="pub-ftop"><span className="pub-lab">Tauschbörse</span>
            <span className="pub-fic"><svg width="22" height="22" viewBox="0 0 24 24" {...SI}><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg></span>
          </div>
          <h3>Auto gegen Auto</h3>
          <p>Biete deins, such deins. Direkt mit anderen tauschen, ganz ohne Umweg.</p>
        </Link>

        <Link className="pub-fcard" href="/team">
          <div className="pub-ftop"><span className="pub-lab">Team</span>
            <span className="pub-fic"><svg width="22" height="22" viewBox="0 0 24 24" {...SI}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5M21 20a6 6 0 0 0-5-5.9" /></svg></span>
          </div>
          <h3>Die Crew von ROC</h3>
          <p>Werkstatt, Tuning und Handel. Lern die Leute hinter Ride Out Customs kennen.</p>
        </Link>
      </section>

      <footer className="pub-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Ride Out Customs" />
        <div className="t">Ride Out Customs <span>· Werkstatt · Tuning · Fahrzeughandel</span></div>
      </footer>
    </>
  );
}
