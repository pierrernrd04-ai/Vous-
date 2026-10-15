/**
 * Affichage des prix et du compte à rebours, branché sur des attributs `data-*`
 * (utilisable par toute page, y compris les pages statiques générées) :
 *
 * - `data-price="amount"`   → prix courant (« 19 € », puis « 29 € ») ;
 * - `data-price="launch"`   → prix de lancement ; `data-price="regular"` → prix normal ;
 * - `data-price="sentence"` → « 19 € jusqu'à dimanche 23:59, puis 29 € », puis « 29 € » ;
 * - `data-launch-only`      → masqué à la fin du lancement ; `data-after-launch` → l'inverse ;
 * - `data-countdown`        → temps restant (« 4 j 09 h 12 min 30 s ») ;
 * - `data-countdown-spoken` → même durée, en toutes lettres (lecteurs d'écran).
 *
 * À la fin du lancement, tout bascule à 29 € sans recharger la page.
 */
import { config, formatEuros } from '../config';
import { qsa } from './dom';
import { countdownTo, formatCountdown, formatCountdownSpoken, priceInfo } from './price';

const MAX_TIMEOUT_MS = 2_147_000_000;

export function bindPrices(root: ParentNode = document, clock: () => Date = () => new Date()): () => void {
  let interval = 0;
  let timeout = 0;
  const listeners = new Set<() => void>();

  const update = () => {
    const now = clock();
    const info = priceInfo(now);
    for (const el of qsa('[data-price]', root)) {
      const kind = el.dataset.price;
      if (kind === 'launch') el.textContent = formatEuros(config.priceLaunch);
      else if (kind === 'regular') el.textContent = formatEuros(config.priceRegular);
      else if (kind === 'sentence') el.textContent = info.sentence;
      else el.textContent = info.label;
    }
    for (const el of qsa('[data-launch-only]', root)) el.hidden = !info.isLaunch;
    for (const el of qsa('[data-after-launch]', root)) el.hidden = info.isLaunch;

    const left = countdownTo(info.launchEndsAt, now);
    for (const el of qsa('[data-countdown]', root)) el.textContent = left ? formatCountdown(left) : '';
    for (const el of qsa('[data-countdown-spoken]', root)) el.textContent = left ? formatCountdownSpoken(left) : '';
    for (const listener of listeners) listener();
    return info.isLaunch;
  };

  const schedule = () => {
    window.clearInterval(interval);
    window.clearTimeout(timeout);
    const active = update();
    if (!active) return;
    if (qsa('[data-countdown]', root).length > 0) {
      interval = window.setInterval(() => {
        if (!update()) window.clearInterval(interval);
      }, 1000);
    } else {
      const ms = info().launchEndsAt.getTime() - clock().getTime() + 1000;
      timeout = window.setTimeout(schedule, Math.min(Math.max(ms, 1000), MAX_TIMEOUT_MS));
    }
  };
  const info = () => priceInfo(clock());

  const onVisible = () => {
    if (document.visibilityState === 'visible') schedule();
  };
  document.addEventListener('visibilitychange', onVisible);
  schedule();

  return () => {
    window.clearInterval(interval);
    window.clearTimeout(timeout);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
