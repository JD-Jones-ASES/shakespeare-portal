import { useEffect, useState } from 'react';

export type Depth = 'off' | 'read' | 'study';

interface Props {
  initial?: Depth;
}

const STORAGE_KEY = 'shakespeare-portal:depth';
const OPTIONS: { id: Depth; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'read', label: 'Read' },
  { id: 'study', label: 'Study' },
];

// Migrate the earlier basic/scholar values.
function normalize(v: string | null): Depth | null {
  if (v === 'basic') return 'read';
  if (v === 'scholar') return 'study';
  if (v === 'off' || v === 'read' || v === 'study') return v;
  return null;
}

export default function DepthToggle({ initial = 'read' }: Props) {
  const [depth, setDepth] = useState<Depth>(initial);

  useEffect(() => {
    try {
      const saved = normalize(window.localStorage.getItem(STORAGE_KEY));
      if (saved && saved !== depth) setDepth(saved);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, depth);
    } catch {
      /* ignore */
    }
    document.body.setAttribute('data-depth', depth);
    window.dispatchEvent(new CustomEvent(STORAGE_KEY, { detail: { depth } }));
  }, [depth]);

  return (
    <fieldset className="depth-toggle" aria-label="Annotation depth">
      <legend className="visually-hidden">Annotation depth</legend>
      {OPTIONS.map((opt) => (
        <label key={opt.id} className={depth === opt.id ? 'active' : ''} title={opt.label}>
          <input
            type="radio"
            name="depth"
            value={opt.id}
            checked={depth === opt.id}
            onChange={() => setDepth(opt.id)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
