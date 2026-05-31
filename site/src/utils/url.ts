/**
 * Prefix an absolute site path with Astro's configured base, so links work
 * whether the site is served from the domain root or a project sub-path
 * (e.g. GitHub Pages at /shakespeare-portal/). Use for every internal link
 * and for fetches of files in public/.
 *
 * Works in both .astro frontmatter and client React components — Vite inlines
 * import.meta.env.BASE_URL at build time.
 */
const BASE = import.meta.env.BASE_URL; // '/shakespeare-portal/' or '/'

export function withBase(path: string): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const p = path.startsWith('/') ? path : '/' + path;
  return base + p;
}
