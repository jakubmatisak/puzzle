// Čistá logika senzorov: náklon doľava (zobraz riešenie) a dvojitý otras (reset).
// Žiadne DOM ani udalosti – o napojenie na zariadenie sa stará iný modul.

const GRAVITY = 9.81;

/**
 * Prevedie uhol obrazovky na jednu z hodnôt 0, 90, 180, 270 (aj -90 → 270).
 * @param {number|null|undefined} angle
 * @returns {number}
 */
function normalizeScreenAngle(angle) {
  const a = Number(angle) || 0;
  return ((Math.round(a / 90) * 90) % 360 + 360) % 360;
}

/**
 * Náklon „doľava" z pohľadu používateľa (záporné = doľava),
 * podľa orientácie obrazovky.
 * @param {number|null|undefined} beta  DeviceOrientation beta
 * @param {number|null|undefined} gamma DeviceOrientation gamma
 * @param {number} screenAngle uhol obrazovky (0, 90, 180, 270 alebo -90)
 * @returns {number}
 */
export function effectiveRoll(beta, gamma, screenAngle) {
  const b = beta ?? 0;
  const g = gamma ?? 0;
  switch (normalizeScreenAngle(screenAngle)) {
    case 90:
      return 0 - b;
    case 180:
      return 0 - g;
    case 270:
      return b;
    default:
      return g;
  }
}

/**
 * Detektor náklonu doľava: roll musí byť pod prahom nepretržite holdMs.
 * Spustí sa raz, potom až keď roll stúpne nad release (re-arm).
 * @param {{threshold?: number, release?: number, holdMs?: number}} [options]
 * @returns {{update: (roll: number, t: number) => boolean}}
 */
export function createTiltDetector({ threshold = -35, release = -15, holdMs = 300 } = {}) {
  let armed = true;
  let holdStart = null;

  return {
    /**
     * @param {number} roll aktuálny náklon v stupňoch
     * @param {number} t čas v ms
     * @returns {boolean} true práve raz pri splnení podmienky
     */
    update(roll, t) {
      if (!armed) {
        if (roll > release) armed = true;
        return false;
      }
      if (roll >= threshold) {
        holdStart = null;
        return false;
      }
      if (holdStart === null) holdStart = t;
      if (t - holdStart >= holdMs) {
        armed = false;
        holdStart = null;
        return true;
      }
      return false;
    },
  };
}

/**
 * Detektor dvojitého otrasu: dva vrcholy (prechod nad prah) v okne `window`,
 * každý aspoň minGap po predchádzajúcom; po spustení prebehne cooldown.
 * @param {{threshold?: number, minGap?: number, window?: number, cooldown?: number}} [options]
 * @returns {{update: (magnitude: number, t: number) => boolean}}
 */
export function createShakeDetector({
  threshold = 15,
  minGap = 150,
  window = 1000,
  cooldown = 1500,
} = {}) {
  let wasAbove = false;
  let lastPeak = null;
  let cooldownUntil = -Infinity;

  return {
    /**
     * @param {number} magnitude veľkosť zrýchlenia (m/s²)
     * @param {number} t čas v ms
     * @returns {boolean} true pri druhom vrchole v okne
     */
    update(magnitude, t) {
      const above = magnitude > threshold;
      const isPeak = above && !wasAbove;
      wasAbove = above;
      if (!isPeak || t < cooldownUntil) return false;
      if (lastPeak !== null && t - lastPeak < minGap) return false;
      if (lastPeak !== null && t - lastPeak <= window) {
        lastPeak = null;
        cooldownUntil = t + cooldown;
        return true;
      }
      lastPeak = t;
      return false;
    },
  };
}

/**
 * Veľkosť zrýchlenia; ak údaj obsahuje gravitáciu, odpočíta 9.81 (min. 0).
 * @param {{x?: number|null, y?: number|null, z?: number|null}|null} accel
 * @param {boolean} hasGravity
 * @returns {number}
 */
export function motionMagnitude(accel, hasGravity) {
  const x = accel?.x ?? 0;
  const y = accel?.y ?? 0;
  const z = accel?.z ?? 0;
  const norm = Math.sqrt(x * x + y * y + z * z);
  return Math.max(0, hasGravity ? norm - GRAVITY : norm);
}
