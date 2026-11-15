'use client';

// Geteilte, nur-lesende Darstellung des Leitfadens. Wird im Reiter "Regeln" und
// in der Bestätigungs-Sperre verwendet. Styling in globals.css (.lf-*).

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function RuleIcon({ name, size = 20 }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', ...P };
  switch (name) {
    case 'radio': return (<svg {...c}><path d="M15 5 7 9" /><rect x="3" y="9" width="18" height="11" rx="2" /><circle cx="8" cy="14.5" r="2.2" /><path d="M14 13h4M14 16.5h4" /></svg>);
    case 'speech': return (<svg {...c}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L4 21l1.1-3.9A8.4 8.4 0 1 1 21 11.5z" /></svg>);
    case 'clock': return (<svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>);
    case 'user': return (<svg {...c}><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>);
    case 'receipt': return (<svg {...c}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>);
    case 'box': return (<svg {...c}><path d="M3 8l9-5 9 5-9 5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>);
    case 'car': return (<svg {...c}><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" /><path d="M4 13h16v4H4z" /><circle cx="7.5" cy="17.5" r="1.4" /><circle cx="16.5" cy="17.5" r="1.4" /></svg>);
    case 'beer': return (<svg {...c}><path d="M6 11h9v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" /><path d="M15 12h2.5a2.5 2.5 0 0 1 0 5H15" /><path d="M8 7.5c0-1 1-1.5 1-2.5M11 7.5c0-1 1-1.5 1-2.5" /></svg>);
    case 'cart': return (<svg {...c}><path d="M3 4h2l2.2 11.5a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.5-1.2L21 8H6" /><circle cx="9.5" cy="20" r="1.3" /><circle cx="17.5" cy="20" r="1.3" /></svg>);
    case 'shield': return (<svg {...c}><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6z" /></svg>);
    case 'wrench': return (<svg {...c} strokeWidth="1.8"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.3-.6-.6-2.3z" /></svg>);
    default: return (<svg {...c}><circle cx="12" cy="12" r="9" /></svg>);
  }
}

export const RULE_ICONS = ['radio', 'speech', 'clock', 'user', 'receipt', 'box', 'car', 'beer', 'cart', 'shield', 'wrench'];

function Check({ size = 17 }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>);
}

function Blocks({ blocks, wide }) {
  const list = blocks || [];
  const callouts = list.filter((b) => b.kind === 'callout');
  const texts = list.filter((b) => b.kind !== 'callout');
  const calEls = callouts.map((b, i) => (
    <div key={'c' + i} className={'lf-cal ' + (b.tone || 'good')}>
      {b.label ? <span className="lf-ch">{b.label}</span> : null}
      {b.text}
    </div>
  ));
  return (
    <>
      {texts.map((b, i) => <p key={'t' + i}>{b.text}</p>)}
      {wide && callouts.length > 1 ? <div className="lf-cols">{calEls}</div> : calEls}
    </>
  );
}

export default function RegelnDoc({ doc, onAccept, accepting, footerNote }) {
  if (!doc) return null;
  const sections = doc.sections || [];
  const grund = doc.grundregeln || [];
  return (
    <div className="lf">
      <header className="lf-hero">
        <div className="lf-mark"><RuleIcon name="wrench" size={26} /></div>
        <div>
          <h1>{doc.title || 'Werkstatt-Leitfaden'}</h1>
          {doc.subtitle ? <div className="lf-sub">{doc.subtitle}</div> : null}
        </div>
      </header>

      {(doc.funk || doc.gps) && (
        <div className="lf-freq">
          <div className="lf-freqic"><RuleIcon name="radio" size={22} /></div>
          <div className="lf-lead">Funk &amp; GPS<b>Immer auf dieselbe Frequenz einstellen</b></div>
          <div className="lf-chips">
            {doc.funk ? <div className="lf-chip"><div className="t">Funk</div><div className="v tnum">{doc.funk}</div></div> : null}
            {doc.gps ? <div className="lf-chip"><div className="t">GPS</div><div className="v tnum">{doc.gps}</div></div> : null}
          </div>
        </div>
      )}

      <div className="lf-grid">
        {sections.map((s, i) => (
          <section className={'lf-card' + (s.wide ? ' lf-wide' : '')} key={i}>
            <div className="lf-cardtop">
              <span className="lf-no">{i + 1}</span>
              <h2>{s.title}</h2>
              <span className="lf-ico"><RuleIcon name={s.icon} /></span>
            </div>
            <div className="lf-cbody"><Blocks blocks={s.blocks} wide={s.wide} /></div>
          </section>
        ))}
      </div>

      {grund.length > 0 && (
        <section className="lf-grund">
          <div className="lf-grundtop"><h2>Wichtige Grundregeln</h2><span className="lf-ico"><RuleIcon name="shield" /></span></div>
          <div className="lf-greg">
            {grund.map((g, i) => (
              <div className={'lf-g' + (g.key ? ' lf-gkey' : '')} key={i}><Check />{g.text}</div>
            ))}
          </div>
        </section>
      )}

      {onAccept && (
        <div className="lf-ack">
          <div className="lf-acktxt">
            <b>Regeln bestätigen</b>
            <span>Bitte einmal bestätigen, dass du den Leitfaden gelesen und verstanden hast.</span>
          </div>
          <button type="button" onClick={onAccept} disabled={accepting}>
            <Check size={17} />{accepting ? 'Speichert …' : 'Gelesen und verstanden'}
          </button>
        </div>
      )}

      {footerNote && <div className="lf-note">{footerNote}</div>}
    </div>
  );
}
