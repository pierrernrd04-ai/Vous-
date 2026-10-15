/**
 * Plugin Vite « races » : génère au build une page SEO par course de
 * data/races.json (dist/courses/<slug>/index.html) et dist/sitemap.xml
 * (SPEC section 4).
 *
 * Bouchon posé par le squelette : l'implémentation revient à l'agent « courses ».
 * Exécuté dans Node au build uniquement (jamais dans le navigateur).
 */
import type { Plugin } from 'vite';

export interface RacesPluginOptions {
  /** URL publique du site, sans barre finale (canonical, sitemap). */
  siteUrl: string;
}

export function racesPlugin(_options: RacesPluginOptions): Plugin {
  return { name: 'races' };
}
