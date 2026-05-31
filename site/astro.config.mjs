import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://jd-jones-ases.github.io',
  base: '/shakespeare-portal/',
  integrations: [react(), mdx()],
  vite: {
    server: {
      fs: {
        // Allow reading data/ outside the site/ root for content imports
        allow: ['..'],
      },
    },
  },
});
