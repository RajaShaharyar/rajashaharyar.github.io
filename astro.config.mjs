// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // GitHub Pages user site: served from the domain root, so no `base` path.
  site: 'https://rajashaharyar.github.io',
  output: 'static',
  // Old URLs that moved (static meta-refresh pages, not indexed).
  redirects: {
    '/ventures/earlier-roles': '/ventures/consulting/',
  },
  // Sitemap: every page except the 404, the contact thank-you page and the old redirect.
  integrations: [mdx(), sitemap({ filter: (page) => !['/404', '/contact/thanks', '/ventures/earlier-roles'].some((p) => new URL(page).pathname.replace(/\/$/, '') === p) })],
  vite: {
    plugins: [tailwindcss()],
  },
});
