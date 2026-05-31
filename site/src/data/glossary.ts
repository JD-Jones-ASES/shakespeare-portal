import type { GlossaryEntry } from './types.ts';

export interface GlossLookup {
  map: Map<string, string>;
  phrases: { key: string; n: number; def: string }[];
}

export function normGloss(s: string): string {
  return s
    .toLowerCase()
    .replace(/^[^a-z0-9'’-]+/u, '')
    .replace(/[^a-z0-9'’-]+$/u, '')
    .replace(/’/g, "'");
}

export function buildGlossary(entries: GlossaryEntry[] = []): GlossLookup {
  const map = new Map<string, string>();
  const phrases: { key: string; n: number; def: string }[] = [];
  for (const e of entries) {
    const key = e.normalized || normGloss(e.surface);
    if (key.includes(' ')) phrases.push({ key, n: key.split(/\s+/).length, def: e.definition });
    else map.set(key, e.definition);
  }
  phrases.sort((a, b) => b.n - a.n); // longest phrases first
  return { map, phrases };
}

export interface GlossSeg {
  t: 'text' | 'g';
  v: string;
  d?: string;
}

/** Split a line of verse into text + glossable segments (longest-match; multi-word phrases first). */
export function glossarize(text: string, g: GlossLookup): GlossSeg[] {
  if (!text) return [{ t: 'text', v: text }];
  const parts: { v: string; word: boolean }[] = [];
  const re = /[A-Za-z'’-]+|[^A-Za-z'’-]+/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) parts.push({ v: m[0], word: /[A-Za-z]/.test(m[0]) });

  const wordIdx: number[] = [];
  parts.forEach((p, i) => { if (p.word) wordIdx.push(i); });

  const segs: GlossSeg[] = [];
  let pi = 0;
  let wi = 0;
  while (pi < parts.length) {
    const p = parts[pi]!;
    if (!p.word) { segs.push({ t: 'text', v: p.v }); pi++; continue; }

    let matched = false;
    for (const ph of g.phrases) {
      if (wi + ph.n > wordIdx.length) continue;
      const ws: string[] = [];
      for (let j = 0; j < ph.n; j++) ws.push(parts[wordIdx[wi + j]!]!.v);
      if (ws.map(normGloss).join(' ') === ph.key) {
        const fromPart = wordIdx[wi]!;
        const toPart = wordIdx[wi + ph.n - 1]!;
        const v = parts.slice(fromPart, toPart + 1).map((x) => x.v).join('');
        segs.push({ t: 'g', v, d: ph.def });
        pi = toPart + 1;
        wi += ph.n;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const def = g.map.get(normGloss(p.v));
    segs.push(def ? { t: 'g', v: p.v, d: def } : { t: 'text', v: p.v });
    pi++;
    wi++;
  }
  return segs;
}
