/**
 * Identité légale de l'éditeur et de l'hébergeur (mentions légales, CGV,
 * confidentialité, rétractation). SPEC section 4.
 *
 * Toute valeur égale à `TO_COMPLETE` déclenche un avertissement au build
 * (voir vite.config.ts) : à renseigner avant la mise en vente.
 * Importé aussi par vite.config.ts : pas d'API navigateur au niveau module.
 */

export const TO_COMPLETE = 'À COMPLÉTER';

export interface LegalIdentity {
  editor: {
    /** Nom et prénom de l'entrepreneur individuel. */
    name: string;
    /** Statut juridique. */
    status: string;
    /** Adresse postale complète. */
    address: string;
    email: string;
    phone: string;
    /** SIREN (9 chiffres) ou mention « en cours d'immatriculation ». */
    siren: string;
    /** Directeur de la publication. */
    publicationDirector: string;
    /** Mention fiscale. */
    vat: string;
  };
  host: {
    name: string;
    address: string;
    phone: string;
    website: string;
  };
  /** Médiateur de la consommation (art. L612-1 C. conso). */
  mediator: {
    name: string;
    address: string;
    website: string;
  };
  /** Date de dernière mise à jour des documents légaux, ISO yyyy-mm-dd. */
  lastUpdated: string;
}

export const legal: LegalIdentity = {
  editor: {
    name: 'Pierre Renard',
    status: 'EI',
    address: TO_COMPLETE,
    email: TO_COMPLETE,
    phone: TO_COMPLETE,
    siren: TO_COMPLETE,
    publicationDirector: 'Pierre Renard',
    vat: 'TVA non applicable, art. 293 B du CGI',
  },
  host: {
    name: 'Cloudflare, Inc.',
    address: '101 Townsend St, San Francisco, CA 94107, USA',
    phone: TO_COMPLETE,
    website: 'https://www.cloudflare.com',
  },
  mediator: {
    name: TO_COMPLETE,
    address: TO_COMPLETE,
    website: TO_COMPLETE,
  },
  lastUpdated: '2026-10-14',
};

/** Vrai si la valeur reste à renseigner. */
export function isToComplete(value: string): boolean {
  return value.trim() === '' || value.trim().toUpperCase() === TO_COMPLETE;
}

/** Chemins (ex. `editor.siren`) des champs encore à compléter. */
export function missingLegalFields(identity: LegalIdentity = legal): string[] {
  const missing: string[] = [];
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (isToComplete(node)) missing.push(path);
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const [key, child] of Object.entries(node)) {
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(identity, '');
  return missing;
}
