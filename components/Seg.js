'use client';

import { PERIODS } from '@/lib/format';

// Zeitraum-Umschalter (Heute / Woche / Monat / Jahr)
export default function Seg({ value, onChange }) {
  return (
    <div className="seg">
      {PERIODS.map(([v, l]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
