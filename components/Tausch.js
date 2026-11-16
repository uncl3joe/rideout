import PublicNav from '@/components/PublicNav';
import TauschForm from '@/components/TauschForm';

// Restlaufzeit eines Inserats als kurzer Text.
function daysLeft(expires) {
  const ms = new Date(expires).getTime() - Date.now();
  const d = Math.ceil(ms / 86400000);
  if (d <= 0) return 'endet heute';
  if (d === 1) return 'noch 1 Tag';
  return 'noch ' + d + ' Tage';
}

const CarIcon = () => (
  <svg className="car" width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" />
    <path d="M3 13h18v4H3z" /><circle cx="7.5" cy="17.5" r="1.4" /><circle cx="16.5" cy="17.5" r="1.4" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </svg>
);

function Card({ l }) {
  const name = [l.first_name, l.last_name].filter(Boolean).join(' ');
  return (
    <article className="tb-card">
      <div className="tb-photo">
        {l.offer_image
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.offer_image} alt={l.offer_model} loading="lazy" />
          : <CarIcon />}
        <span className="tb-badge">Biete</span>
        <span className="tb-days">{daysLeft(l.expires_at)}</span>
      </div>
      <div className="tb-body">
        <div>
          <div className="tb-model">{l.offer_model}</div>
          <div className="tb-by">von {name}</div>
        </div>
        <div className="tb-seek">
          <div className="lab">Sucht</div>
          <div className="tb-seekrow">
            <p>{l.seek_text}</p>
            {l.seek_image && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="tb-seekimg" src={l.seek_image} alt="Gesuchtes Fahrzeug" loading="lazy" />
            )}
          </div>
        </div>
        <a className="tb-contact" href={'tel:' + l.phone.replace(/\s+/g, '')}>
          <PhoneIcon /><span className="tb-phone">{l.phone}</span>
        </a>
      </div>
    </article>
  );
}

export default function Tausch({ listings = [] }) {
  return (
    <>
      <PublicNav active="tausch" />

      <header className="pub-head">
        <div className="pub-glow" />
        <div className="pub-hwrap">
          <div className="pub-ey">Tauschbörse</div>
          <h1 className="pub-h2">Auto gegen <span className="o">Auto.</span></h1>
          <p className="pub-lead">Biete dein Fahrzeug, finde deinen Tausch. Direkt mit anderen Spielern, ganz ohne Umweg. Jeder kann hier sein Inserat einstellen.</p>
        </div>
      </header>

      <div className="tb-tools">
        <div className="tb-count"><b>{listings.length}</b> {listings.length === 1 ? 'aktives Inserat' : 'aktive Inserate'}</div>
        <a className="tb-new" href="#einstellen"><ArrowIcon /> Inserat einstellen</a>
      </div>

      {listings.length === 0 ? (
        <div className="tb-gridwrap"><div className="pub-empty">Noch keine Inserate. Sei der Erste und stell unten dein Fahrzeug ein.</div></div>
      ) : (
        <section className="tb-grid">
          {listings.map((l) => <Card key={l.id} l={l} />)}
        </section>
      )}

      <div className="tb-formwrap" id="einstellen">
        <TauschForm />
      </div>

      <footer className="pub-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Ride Out Customs" />
        <div className="t">Ride Out Customs <span>· Werkstatt · Tuning · Fahrzeughandel</span></div>
      </footer>
    </>
  );
}
