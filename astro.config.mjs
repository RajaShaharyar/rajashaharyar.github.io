// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  // GitHub Pages user site: served from the domain root, so no `base` path.
  site: 'https://rajashaharyar.github.io',
  output: 'static',
  // Old URLs that moved (static meta-refresh pages, not indexed).
  redirects: {
    '/ventures/earlier-roles': '/ventures/consulting/',
  },
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
