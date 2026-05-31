import { useEffect, useState } from 'react';
import type { Character } from '../data/types.ts';

interface Props {
  characters: Character[];
}

type Mode = 'normal' | 'color' | 'highlight' | 'focus';

const MODES: { id: Mode; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'color', label: 'Color speakers' },
  { id: 'highlight', label: 'Highlight' },
  { id: 'focus', label: 'Focus' },
];

const HELP: Record<Mode, string> = {
  normal: '',
  color: 'Each speaker is tinted by character — handy for tracking who is talking.',
  highlight: 'Pick characters to highlight their lines in their colour; the rest stay normal.',
  focus: "Pick the character(s) you're reading; everyone else dims. Use the cue buttons to jump between your lines.",
};

export default function ReadingControls({ characters }: Props) {
  const [mode, setMode] = useState<Mode>('normal');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cue, setCue] = useState(-1);
  const [wordHelp, setWordHelp] = useState(true);

  useEffect(() => {
    try {
      if (window.localStorage.getItem('portal:wordhelp') === 'off') setWordHelp(false);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.body.setAttribute('data-wordhelp', wordHelp ? 'on' : 'off');
    try {
      window.localStorage.setItem('portal:wordhelp', wordHelp ? 'on' : 'off');
    } catch {
      /* ignore */
    }
  }, [wordHelp]);

  useEffect(() => {
    document.body.setAttribute('data-charmode', mode);
    const active = mode === 'highlight' || mode === 'focus';
    document.querySelectorAll<HTMLElement>('.play-line, .speaker-row').forEach((el) => {
      const sid = el.getAttribute('data-speaker-id') ?? '';
      el.classList.toggle('is-selected', active && selected.has(sid));
    });
    setCue(-1);
  }, [mode, selected]);

  useEffect(
    () => () => {
      document.body.removeAttribute('data-charmode');
      document.querySelectorAll('.is-selected').forEach((el) => el.classList.remove('is-selected'));
    },
    [],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const jumpCue = (dir: 1 | -1) => {
    const lines = [...document.querySelectorAll<HTMLElement>('.play-line.is-selected')];
    if (!lines.length) return;
    let idx = cue + dir;
    if (idx < 0) idx = lines.length - 1;
    if (idx >= lines.length) idx = 0;
    setCue(idx);
    document.querySelectorAll('.play-line.line-focused').forEach((x) => x.classList.remove('line-focused'));
    const el = lines[idx]!;
    el.classList.add('line-focused');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const reset = () => {
    setMode('normal');
    setSelected(new Set());
    setCue(-1);
  };

  const showPicker = mode === 'highlight' || mode === 'focus';

  return (
    <div className="reading-controls">
      <h3>Reading mode</h3>
      <div className="mode-row" role="group" aria-label="Reading mode">
        {MODES.map((m) => (
          <button key={m.id} type="button" className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {HELP[mode] && <p className="mode-help">{HELP[mode]}</p>}

      {(showPicker || mode === 'color') && (
        <ul className="char-legend">
          {characters.map((c) => {
            const checked = selected.has(c.id);
            return (
              <li key={c.id}>
                <label>
                  {showPicker && (
                    <input type="checkbox" checked={checked} onChange={() => toggle(c.id)} />
                  )}
                  <span className="chip" style={{ background: c.color ?? 'var(--color-muted)' }} aria-hidden="true" />
                  <span>{c.name}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {mode === 'focus' && selected.size > 0 && (
        <div className="cue-nav">
          <button type="button" onClick={() => jumpCue(-1)}>&larr; Prev line</button>
          <button type="button" onClick={() => jumpCue(1)}>Next line &rarr;</button>
        </div>
      )}

      {mode !== 'normal' && (
        <button type="button" className="clear-btn" onClick={reset}>Reset</button>
      )}

      <label className="wordhelp-toggle">
        <input type="checkbox" checked={wordHelp} onChange={() => setWordHelp((v) => !v)} />
        <span>Word definitions on hover</span>
      </label>
    </div>
  );
}
