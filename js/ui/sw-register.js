/**
 * Registrácia service workera (offline režim). Chyby sa iba zalogujú, nikdy sa nevyhodia.
 */

/** Zaregistruje ./sw.js po načítaní stránky, ak ho prehliadač podporuje. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const register = () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker sa nepodarilo zaregistrovať:', error);
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
