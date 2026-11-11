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
  // Old URLs that moved (static meta-refresh pages, not indexed). Each points straight at the
  // final address, so there are no redirect chains.
  redirects: {
    '/ventures/earlier-roles': '/ventures/other/',
    '/ventures/consulting': '/ventures/other/',
  },
  // Sitemap: every page except the 404, the contact thank-you page and the redirects.
  integrations: [mdx(), sitemap({ filter: (page) => !['/404', '/contact/thanks', '/ventures/earlier-roles', '/ventures/consulting'].some((p) => new URL(page).pathname.replace(/\/$/, '') === p) })],
  vite: {
    plugins: [tailwindcss()],
  },
});
