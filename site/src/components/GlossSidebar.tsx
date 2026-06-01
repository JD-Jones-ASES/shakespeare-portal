import { useEffect, useState } from 'react';
import type { Annotation, ReferenceCard } from '../data/types.ts';
import { tidyText } from '../data/glossary.ts';

interface Props {
  annotations: Annotation[];
  cards?: ReferenceCard[];
}

export default function GlossSidebar({ annotations, cards = [] }: Props) {
  const cardOf = (kind: string, id: string) => cards.find((c) => c.kind === kind && c.id === id);
  const [depth, setDepth] = useState<'off' | 'read' | 'study'>('read');
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ depth: 'off' | 'read' | 'study' }>;
      setDepth(ce.detail.depth);
    };
    window.addEventListener('shakespeare-portal:depth', handler as EventListener);
    return () => window.removeEventListener('shakespeare-portal:depth', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const marker = target.closest<HTMLElement>('.ann-marker');
      if (marker) {
        const id = marker.getAttribute('data-annotation-id');
        if (id) setFocusedId(id);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Scroll the focused note into view within the (independently scrollable) sidebar.
  useEffect(() => {
    if (!focusedId) return;
    const el = document.getElementById(`gloss-${focusedId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [focusedId]);

  if (depth === 'off') {
    return (
      <div className="gloss-empty">
        <p>Annotation hidden. Press <kbd>A</kbd> or use the depth toggle to show.</p>
      </div>
    );
  }

  // Read = the clean reading layer: plain glosses only, no bawdy/textual-variant/scholar notes.
  // Study = the full apparatus.
  const readHidden = (a: Annotation) =>
    a.type === 'bawdy_pun' || a.type === 'textual_variant' || a.depth === 'scholar';
  const visible = annotations.filter((a) => (depth === 'study' ? true : !readHidden(a)));
  if (visible.length === 0) {
    return (
      <div className="gloss-empty">
        <p>No annotations for this scene yet.</p>
      </div>
    );
  }

  return (
    <div className="gloss-list">
      <h2>Notes</h2>
      <ol>
        {visible.map((a) => (
          <li
            key={a.id}
            className={`gloss-item gloss-${a.type} ${focusedId === a.id ? 'focused' : ''}`}
            id={`gloss-${a.id}`}
            onClick={() => {
              setFocusedId(a.id);
              window.dispatchEvent(new CustomEvent('portal:focus-line', { detail: { tln: a.tln_start } }));
            }}
          >
            <header>
              <span className="gloss-tln">TLN {a.tln_start}</span>
              <span className="gloss-type">{a.type.replace(/_/g, ' ')}</span>
            </header>
            <p className="anchor">&ldquo;{tidyText(a.anchor_text)}&rdquo;</p>
            <p className="summary">{a.summary}</p>
            {depth === 'study' && a.detail && <p className="detail">{a.detail}</p>}
            {(a.references ?? []).map((ref) => {
              const card = cardOf(ref.kind, ref.card_id);
              if (!card) return null;
              if (depth !== 'study') {
                return (
                  <span key={ref.card_id} className={`ref-chip ref-${ref.kind}`}>
                    <span className="ref-kind">{ref.kind}</span> {card.title}
                  </span>
                );
              }
              return (
                <details key={ref.card_id} className={`ref-card ref-${ref.kind}`}>
                  <summary>
                    <span className="ref-kind">{ref.kind}</span> {card.title}
                  </summary>
                  <p className="ref-summary">{card.summary_basic}</p>
                  {card.detail_scholar && <p className="ref-detail">{card.detail_scholar}</p>}
                  <p className="ref-source">{card.source.citation}</p>
                </details>
              );
            })}
            {depth === 'study' && (
              <footer className="sources">
                {a.sources.map((s, i) => (
                  <span key={i} className="source">
                    {s.url ? <a href={s.url} rel="noopener">{s.name}</a> : s.name}
                  </span>
                ))}
              </footer>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
