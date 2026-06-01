/**
 * Static loaders for content under ../../data. Uses Vite's import.meta.glob
 * so Astro picks up new plays at build time without manual registration.
 */
import type {
  CatalogEntry,
  PlayText,
  Annotation,
  Character,
  ReferenceCardFile,
  Synopsis,
  Glossary,
} from './types.ts';

// Catalog — single file.
import catalogJson from '../../../data/catalog/works.json';
export const catalog: CatalogEntry[] = catalogJson as CatalogEntry[];

// Plays — every text.json under data/plays/*/.
const textModules = import.meta.glob<{ default: PlayText }>(
  '../../../data/plays/*/text.json',
  { eager: true },
);
const annModules = import.meta.glob<{ default: Annotation[] }>(
  '../../../data/plays/*/annotations.json',
  { eager: true },
);
const charModules = import.meta.glob<{ default: Character[] }>(
  '../../../data/plays/*/characters.json',
  { eager: true },
);
const synModules = import.meta.glob<{ default: Synopsis }>(
  '../../../data/plays/*/synopsis.json',
  { eager: true },
);
const glossModules = import.meta.glob<{ default: Glossary }>(
  '../../../data/plays/*/glossary.json',
  { eager: true },
);

function slugFromPath(path: string): string {
  const m = path.match(/data\/plays\/([^/]+)\//);
  return m ? m[1]! : '';
}

export interface PlayBundle {
  slug: string;
  catalog: CatalogEntry | undefined;
  text: PlayText | undefined;
  annotations: Annotation[];
  characters: Character[];
  synopsis: Synopsis | undefined;
  glossary: Glossary | undefined;
}

const byPlay = new Map<string, PlayBundle>();

for (const [path, mod] of Object.entries(textModules)) {
  const slug = slugFromPath(path);
  if (!slug) continue;
  const cat = catalog.find((c) => c.playId === slug);
  byPlay.set(slug, {
    slug,
    catalog: cat,
    text: mod.default,
    annotations: [],
    characters: [],
    synopsis: undefined,
    glossary: undefined,
  });
}
for (const [path, mod] of Object.entries(annModules)) {
  const slug = slugFromPath(path);
  const b = byPlay.get(slug);
  if (b) b.annotations = mod.default ?? [];
}
for (const [path, mod] of Object.entries(charModules)) {
  const slug = slugFromPath(path);
  const b = byPlay.get(slug);
  if (b) b.characters = mod.default ?? [];
}
for (const [path, mod] of Object.entries(synModules)) {
  const slug = slugFromPath(path);
  const b = byPlay.get(slug);
  if (b) b.synopsis = mod.default;
}
for (const [path, mod] of Object.entries(glossModules)) {
  const slug = slugFromPath(path);
  const b = byPlay.get(slug);
  if (b) b.glossary = mod.default;
}

// Also surface catalog entries for plays whose text.json hasn't been ingested yet —
// they should still appear on the landing page (without scene reader links).
for (const c of catalog) {
  if (!byPlay.has(c.playId)) {
    byPlay.set(c.playId, {
      slug: c.playId,
      catalog: c,
      text: undefined,
      annotations: [],
      characters: [],
      synopsis: undefined,
    });
  }
}

export function getPlay(slug: string): PlayBundle | undefined {
  return byPlay.get(slug);
}

export function listPlays(): PlayBundle[] {
  return [...byPlay.values()].sort((a, b) =>
    (a.catalog?.title_short ?? a.slug).localeCompare(b.catalog?.title_short ?? b.slug),
  );
}

// Reference cards
const refModules = import.meta.glob<{ default: ReferenceCardFile }>(
  '../../../data/references/*.json',
  { eager: true },
);

export const referenceCards = Object.values(refModules).flatMap((m) => m.default.cards);

export function getReferenceCard(kind: string, id: string) {
  return referenceCards.find((c) => c.kind === kind && c.id === id);
}

// Annotation accessors per scene
export function annotationsForScene(
  slug: string,
  actNumber: number,
  sceneNumber: number,
): Annotation[] {
  const bundle = byPlay.get(slug);
  if (!bundle?.text) return [];
  const scene = bundle.text.acts.find((a) => a.number === actNumber)?.scenes.find((s) => s.number === sceneNumber);
  if (!scene?.tln_start || !scene.tln_end) return [];
  return bundle.annotations
    .filter((a) => a.tln_start >= scene.tln_start! && a.tln_start <= scene.tln_end!)
    .sort((a, b) => a.tln_start - b.tln_start || (a.word_start ?? 0) - (b.word_start ?? 0));
}
