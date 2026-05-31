import { useEffect, useMemo, useState } from 'react';
import MiniSearch from 'minisearch';
import { withBase } from '../utils/url.ts';

interface SearchDoc {
  id: string;
  kind: 'play' | 'scene' | 'line' | 'annotation';
  play: string;
  title?: string;
  act?: number;
  scene?: number;
  tln?: number;
  speaker?: string;
  text: string;
}

interface IndexFile {
  generated_at: string;
  docs: SearchDoc[];
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(withBase('/search-index.json'))
      .then((r) => r.json() as Promise<IndexFile>)
      .then((data) => {
        if (!cancelled) setDocs(data.docs);
      })
      .catch(() => {
        /* index not built yet */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const mini = useMemo(() => {
    if (!docs) return null;
    const m = new MiniSearch<SearchDoc>({
      fields: ['title', 'speaker', 'text'],
      storeFields: ['id', 'kind', 'play', 'title', 'act', 'scene', 'tln', 'speaker'],
      searchOptions: { boost: { title: 2, speaker: 1.5 }, prefix: true, fuzzy: 0.2 },
    });
    m.addAll(docs);
    return m;
  }, [docs]);

  const results = query.trim().length >= 2 && mini ? mini.search(query).slice(0, 20) : [];

  return (
    <div className="search-bar">
      <label>
        <span className="visually-hidden">Search</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={docs ? 'Search the corpus…' : 'Loading index…'}
          disabled={!docs}
        />
      </label>
      {results.length > 0 && (
        <ol className="search-results">
          {results.map((r) => {
            const d = r as unknown as SearchDoc & { score: number };
            const href = hrefFor(d);
            return (
              <li key={d.id}>
                <a href={href}>
                  <span className="kind">{d.kind}</span>
                  <span className="label">{labelFor(d)}</span>
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function hrefFor(d: SearchDoc): string {
  switch (d.kind) {
    case 'play': return withBase(`/plays/${d.play}/`);
    case 'scene': return withBase(`/plays/${d.play}/${d.act}/${d.scene}/`);
    case 'line': return withBase(`/plays/${d.play}/${d.act}/${d.scene}/#tln-${d.tln}`);
    case 'annotation': return withBase(`/plays/${d.play}/${d.act ?? 1}/${d.scene ?? 1}/#gloss-${d.id.replace(/^ann:/, '')}`);
  }
}

function labelFor(d: SearchDoc): string {
  switch (d.kind) {
    case 'play': return d.title ?? d.play;
    case 'scene': return `${d.play} ${d.act}.${d.scene}`;
    case 'line': return `${d.play} TLN ${d.tln} — ${d.speaker ?? ''}`;
    case 'annotation': return `${d.play} TLN ${d.tln} (annotation)`;
  }
}
