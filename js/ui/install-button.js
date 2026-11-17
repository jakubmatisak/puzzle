/**
 * Tlačidlo „Inštalovať“: zobrazí sa, keď prehliadač ponúkne inštaláciu PWA.
 */

/**
 * Pripojí tlačidlo k udalostiam beforeinstallprompt / appinstalled.
 * @param {HTMLElement|null} button tlačidlo (skryté, kým nie je inštalácia dostupná)
 */
export function initInstallButton(button) {
  if (!button) return;
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event;
    button.hidden = false;
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    button.hidden = true;
  });

  button.addEventListener('click', async () => {
    if (!deferred) return;
    const prompt = deferred;
    deferred = null;
    button.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (error) {
      console.error(error);
    }
  });
}
