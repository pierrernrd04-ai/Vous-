/**
 * Installation de l'app (PWA) :
 * - Android / Chrome : on garde l'événement `beforeinstallprompt` pour un bouton « Installer l'app » ;
 * - iOS : bandeau « Partager → Sur l'écran d'accueil » (Safari n'a pas d'invite d'installation) ;
 * - navigateurs intégrés (Instagram, Facebook…) : conseil d'ouvrir la page dans le navigateur.
 * Aucun accès au DOM au chargement du module.
 */
import { copyText, h, toast } from './dom';
import { icon } from './icons';
import { STORAGE_KEYS, readString, writeString } from './storage';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallPlatform = 'ios-safari' | 'ios-other' | 'in-app' | 'android' | 'desktop';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Capture l'invite d'installation (à appeler tôt, une fois par page). */
export function initInstallPrompt(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
    toast('App installée : retrouve ton plan sur ton écran d’accueil.');
  });
}

/** S'abonne aux changements de disponibilité de l'invite ; renvoie la désinscription. */
export function onInstallAvailabilityChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferredPrompt;
  if (!event) return 'unavailable';
  deferredPrompt = null;
  notify();
  try {
    await event.prompt();
    const choice = await event.userChoice;
    return choice.outcome;
  } catch {
    return 'unavailable';
  }
}

/** Vrai si la page tourne déjà comme app installée. */
export function isStandalone(): boolean {
  try {
    const nav = navigator as Navigator & { standalone?: boolean };
    return nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

/** Détection grossière de la plateforme, pour adapter les instructions. */
export function detectPlatform(
  ua: string = navigator.userAgent,
  platform: string = navigator.platform ?? '',
  maxTouchPoints: number = navigator.maxTouchPoints ?? 0,
): InstallPlatform {
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp/i.test(ua)) {
    return 'in-app';
  }
  const ios = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Instructions d'installation en une phrase. */
export function installHelp(platform: InstallPlatform = detectPlatform()): string {
  switch (platform) {
    case 'ios-safari':
      return 'Touche le bouton Partager de Safari, puis « Sur l’écran d’accueil ».';
    case 'ios-other':
      return 'Touche le bouton Partager, puis « Sur l’écran d’accueil ». Si l’option manque, ouvre cette page dans Safari.';
    case 'in-app':
      return 'Ouvre d’abord cette page dans ton navigateur (menu ··· puis « Ouvrir dans le navigateur »), puis ajoute-la à l’écran d’accueil.';
    case 'android':
      return 'Ouvre le menu ⋮ de ton navigateur, puis « Installer l’application » ou « Ajouter à l’écran d’accueil ».';
    default:
      return 'Dans la barre d’adresse, clique sur l’icône d’installation, ou ouvre le menu du navigateur puis « Installer ».';
  }
}

const DISMISS_DAYS = 14;

function recentlyDismissed(now = Date.now()): boolean {
  const raw = readString(STORAGE_KEYS.installDismissed);
  const at = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(at) && now - at < DISMISS_DAYS * 86_400_000;
}

export interface IosBannerOptions {
  /** Lien personnel à copier avant l'installation (l'app iOS a son propre stockage). */
  personalLink?: () => string | null;
}

/**
 * Bandeau d'installation iOS (et conseil pour les navigateurs intégrés), en bas d'écran.
 * Rien ne s'affiche si l'app est déjà installée, hors iOS, ou si le bandeau a été refermé récemment.
 */
export function mountIosInstallBanner(options: IosBannerOptions = {}): void {
  if (isStandalone() || recentlyDismissed() || document.getElementById('install-banner')) return;
  const platform = detectPlatform();
  if (platform !== 'ios-safari' && platform !== 'ios-other' && platform !== 'in-app') return;

  const link = options.personalLink?.() ?? null;
  const close = h(
    'button',
    { class: 'install-banner__close', attrs: { type: 'button', 'aria-label': 'Fermer le bandeau d’installation' } },
    icon('close'),
  );
  const steps =
    platform === 'in-app'
      ? h('p', { text: installHelp(platform) })
      : h(
          'p',
          {},
          'Touche ',
          h('span', { class: 'install-banner__key' }, icon('share'), 'Partager'),
          ' puis ',
          h('span', { class: 'install-banner__key' }, icon('plusSquare'), 'Sur l’écran d’accueil'),
          '.',
        );
  const copy =
    link && platform !== 'in-app'
      ? h(
          'p',
          { class: 'install-banner__tip' },
          'Astuce : copie d’abord ton lien personnel, l’app te le demandera à la première ouverture. ',
          h('button', {
            class: 'btn btn--sm btn--ghost',
            attrs: { type: 'button' },
            text: 'Copier mon lien',
            on: {
              click: async () => {
                const ok = await copyText(link);
                toast(ok ? 'Lien copié.' : 'Copie impossible : garde le lien affiché sur la page.', ok ? 'ok' : 'error');
              },
            },
          }),
        )
      : null;

  const banner = h(
    'aside',
    { id: 'install-banner', class: 'install-banner no-print', attrs: { 'aria-label': 'Installer l’app' } },
    h('div', { class: 'install-banner__icon' }, icon('phone')),
    h('div', { class: 'install-banner__text' }, h('strong', { text: platform === 'in-app' ? 'Installe ton plan sur ton téléphone' : 'Installe ton plan sur ton iPhone' }), steps, copy),
    close,
  );
  close.addEventListener('click', () => {
    writeString(STORAGE_KEYS.installDismissed, new Date().toISOString());
    banner.remove();
  });
  document.body.appendChild(banner);
}

/**
 * Bouton « Installer l'app » : invite native si le navigateur la propose,
 * sinon instructions adaptées à la plateforme (zone `help`, annoncée).
 * Masqué quand l'app tourne déjà en mode installé.
 */
export function createInstallButton(className = 'btn'): { button: HTMLButtonElement; help: HTMLElement } {
  const help = h('p', { class: 'hint install-help', attrs: { 'aria-live': 'polite' } });
  const button = h('button', { class: className, attrs: { type: 'button' } }, icon('phone'), 'Installer l’app');
  const sync = () => {
    button.hidden = isStandalone();
  };
  onInstallAvailabilityChange(sync);
  sync();
  button.addEventListener('click', async () => {
    if (canPromptInstall()) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        help.textContent = 'C’est installé : ton plan est sur ton écran d’accueil.';
        return;
      }
      if (outcome === 'dismissed') return;
    }
    help.textContent = installHelp(detectPlatform());
  });
  return { button, help };
}
