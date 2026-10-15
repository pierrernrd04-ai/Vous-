/**
 * Initialisation commune à toutes les pages : prix et compte à rebours, boutons
 * d'achat `[data-checkout]`, contact du pied de page, invite d'installation,
 * enregistrement du service worker (production uniquement).
 */
import { initCheckoutTriggers, type CheckoutOptions } from './checkout';
import { onReady, qsa } from './dom';
import { initInstallPrompt } from './install-banner';
import { supportEmail } from './links';
import { bindPrices } from './price-ui';

export interface BootOptions {
  /** Options par défaut de la fenêtre d'achat (course, niveau…), lues au clic. */
  checkoutDefaults?: () => CheckoutOptions;
}

function fillSupportEmail(): void {
  const email = supportEmail();
  for (const el of qsa('[data-support-email]')) {
    if (!email) {
      el.hidden = true;
      continue;
    }
    if (el instanceof HTMLAnchorElement) {
      el.href = `mailto:${email}`;
      if (!el.textContent?.trim()) el.textContent = email;
    } else {
      el.textContent = email;
    }
    el.hidden = false;
  }
}

function markCurrentLinks(): void {
  const path = location.pathname.replace(/index\.html$/, '');
  for (const link of qsa<HTMLAnchorElement>('.site-footer a, .header-nav a')) {
    if (link.getAttribute('href') === path) link.setAttribute('aria-current', 'page');
  }
}

/** Enregistre /sw.js (production seulement : en dev, Vite sert les modules à la volée). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Pas de mode hors ligne : le site fonctionne normalement.
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

export function bootPage(options: BootOptions = {}): void {
  initInstallPrompt();
  initCheckoutTriggers(options.checkoutDefaults);
  onReady(() => {
    bindPrices();
    fillSupportEmail();
    markCurrentLinks();
    document.documentElement.classList.add('js');
  });
  registerServiceWorker();
}
