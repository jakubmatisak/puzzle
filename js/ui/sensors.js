/**
 * Napojenie pohybových senzorov na hru: náklon doľava ukáže riešenie,
 * dvojitý otras vráti úlohu na začiatok. Samotné rozpoznanie je v core/sensors-logic.js.
 */
import {
  createShakeDetector,
  createTiltDetector,
  effectiveRoll,
  motionMagnitude,
} from '../core/sensors-logic.js';

/** Uhol obrazovky v stupňoch (nové API, staré API, inak 0). */
function currentScreenAngle() {
  return screen.orientation?.angle ?? window.orientation ?? 0;
}

/** Funkcie na vyžiadanie povolenia (iOS); na iných zariadeniach prázdne pole. */
function permissionRequests() {
  return [window.DeviceOrientationEvent, window.DeviceMotionEvent]
    .map((eventClass) => eventClass?.requestPermission)
    .filter((request) => typeof request === 'function');
}

/**
 * Zapne senzory. Ak prehliadač vyžaduje povolenie (iOS), zobrazí tlačidlo
 * a listenery pridá až po udelení povolenia; inak ich pridá hneď.
 * @param {{onTiltLeft: Function, onDoubleShake: Function, i18n: {t: Function},
 *   buttonEl: HTMLElement, isActive?: () => boolean, onMessage?: (key: string) => void}} opts
 *   isActive = senzory reagujú iba keď vráti true (napr. na obrazovke hry),
 *   onMessage = zobrazí krátku hlášku podľa i18n kľúča
 * @returns {{stop: () => void}} stop odstráni listenery
 */
export function initSensors({
  onTiltLeft,
  onDoubleShake,
  i18n,
  buttonEl,
  isActive = () => true,
  onMessage = () => {},
}) {
  const tilt = createTiltDetector();
  const shake = createShakeDetector();
  let attached = false;

  /** Udalosť natočenia: počíta náklon doľava. Mimo hry sa detektor vynuluje. */
  function onOrientation(event) {
    const t = event.timeStamp;
    const active = isActive();
    const roll = active ? effectiveRoll(event.beta, event.gamma, currentScreenAngle()) : 0;
    if (tilt.update(roll, t) && active) onTiltLeft();
  }

  /** Udalosť pohybu: počíta otrasy (bez gravitácie, ak ju zariadenie vie oddeliť). */
  function onMotion(event) {
    const t = event.timeStamp;
    const active = isActive();
    const hasGravity = !event.acceleration || event.acceleration.x == null;
    const accel = hasGravity ? event.accelerationIncludingGravity : event.acceleration;
    const magnitude = active ? motionMagnitude(accel, hasGravity) : 0;
    if (shake.update(magnitude, t) && active) {
      onDoubleShake();
      onMessage('sensors.resetDone');
    }
  }

  /** Pridá listenery (iba raz). */
  function attach() {
    if (attached) return;
    attached = true;
    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
  }

  /** Odstráni listenery. */
  function stop() {
    attached = false;
    window.removeEventListener('deviceorientation', onOrientation);
    window.removeEventListener('devicemotion', onMotion);
  }

  /** Klik na „Povoliť senzory“: vyžiada povolenie a podľa výsledku zapne senzory. */
  async function requestAccess() {
    try {
      const results = await Promise.all(permissionRequests().map((request) => request()));
      if (!results.every((result) => result === 'granted')) throw new Error('denied');
      attach();
      buttonEl.hidden = true;
    } catch {
      onMessage('sensors.denied');
    }
  }

  if (permissionRequests().length > 0) {
    buttonEl.hidden = false;
    buttonEl.addEventListener('click', requestAccess);
  } else {
    attach();
  }

  return { stop };
}
