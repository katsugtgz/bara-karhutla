import { useId, useRef, type CSSProperties, type ReactNode, type ToggleEvent } from 'react';
import { formatWib, relativeId } from '../lib/time';
import './sourced.css';

// Popover is Baseline-newly-available: load the polyfill only where native support is missing.
if (typeof window !== 'undefined' && !('popover' in HTMLElement.prototype)) {
  import('@oddbird/popover-polyfill');
}

export interface SourcedSource {
  name: string;
  url?: string;
  period?: string;
  fetchedAt?: string | null;
  status?: 'terverifikasi' | 'belum diverifikasi' | 'dihitung';
  note?: string;
}

export interface SourcedProps {
  value: ReactNode | null;
  unit?: string;
  source: SourcedSource;
}

/**
 * Every number on the site goes through this: the value (or the honest
 * "tidak tersedia" — never a fabricated 0) plus a provenance popover.
 */
export function Sourced({ value, unit, source }: SourcedProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const popId = `sourced-pop-${uid}`;
  const anchor = `--sourced-${uid}`;
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Anchor positioning has no support outside Safari today: fall back to
  // fixed positioning next to the button when the popover opens.
  const handleToggle = (e: ToggleEvent<HTMLDivElement>) => {
    if (e.newState !== 'open' || CSS.supports('anchor-name: --x')) return;
    const pop = popRef.current;
    const btn = btnRef.current;
    if (!pop || !btn) return;
    const r = btn.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - pop.offsetWidth - 8);
    let top = r.bottom + 6;
    if (top + pop.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - pop.offsetHeight - 6);
    pop.style.insetInlineStart = `${left}px`;
    pop.style.insetBlockStart = `${top}px`;
  };

  // Short figures ("666 titik") never break. Sentence-length values must wrap,
  // or they push the page sideways on 360 px phones; the no-break space below
  // still keeps the ⓘ on the same line as the last word.
  const text = `${typeof value === 'string' ? value : ''}${unit ? ` ${unit}` : ''}`;
  const long = text.length > 24;

  return (
    <span className={long ? 'sourced sourced-long' : 'sourced'}>
      <span className="sourced-value">
        {value === null ? 'tidak tersedia' : value}
        {value !== null && unit ? <span> {unit}</span> : null}
      </span>
      {' '}
      <button
        ref={btnRef}
        type="button"
        className="sourced-btn"
        popoverTarget={popId}
        aria-label={`Sumber: ${source.name}`}
        style={{ 'anchor-name': anchor } as CSSProperties}
      >
        ⓘ
      </button>
      <div
        ref={popRef}
        id={popId}
        popover="auto"
        className="sourced-popover"
        onToggle={handleToggle}
        style={{ 'position-anchor': anchor } as CSSProperties}
      >
        <p className="sourced-name">
          {source.url ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.name}
            </a>
          ) : (
            source.name
          )}
        </p>
        {source.period ? (
          <p className="sourced-meta">
            Periode: <span className="num">{source.period}</span>
          </p>
        ) : null}
        {source.fetchedAt ? (
          <p className="sourced-meta">
            Diambil {formatWib(source.fetchedAt)} ({relativeId(source.fetchedAt)})
          </p>
        ) : null}
        {source.status ? (
          <p>
            {source.status === 'belum diverifikasi' ? (
              <span className="sourced-tag">belum diverifikasi</span>
            ) : (
              <span className="sourced-meta">{source.status}</span>
            )}
          </p>
        ) : null}
        {source.note ? <p>{source.note}</p> : null}
      </div>
    </span>
  );
}
