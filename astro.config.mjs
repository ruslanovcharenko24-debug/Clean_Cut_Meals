// @ts-check
import { defineConfig } from 'astro/config';

// Static build only: no adapter, no analytics, no external requests at runtime.
// GitHub Pages: the workflow sets SITE_URL (origin, e.g. https://<user>.github.io) and BASE_PATH (/<repo>).
// Locally both are unset: the site runs at http://localhost:4321/.
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH || '/',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
