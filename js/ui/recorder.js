/**
 * Nahrávanie videa hry: skryté plátno, na ktoré sa každý snímok kreslí aktuálna
 * scéna, jeho prúd (captureStream) zachytáva MediaRecorder a výsledkom je WebM Blob.
 */
import { canvasSize, drawScene } from './canvas-renderer.js';

export const MIME_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const VIDEO_WIDTH = 1280;
const MAX_SECONDS = 120;

/**
 * Prvý typ videa zo zoznamu, ktorý prehliadač vie nahrávať.
 * @returns {string|null} MIME typ alebo null, ak MediaRecorder nepozná žiadny
 */
export function pickMimeType() {
  const Recorder = globalThis.MediaRecorder;
  if (!Recorder) return null;
  if (typeof Recorder.isTypeSupported !== 'function') return MIME_TYPES.at(-1);
  return MIME_TYPES.find((type) => Recorder.isTypeSupported(type)) ?? null;
}

/**
 * Vytvorí nahrávač.
 * @param {{getScene:()=>?object, fps?:number, maxSeconds?:number,
 *   onEnd?:(blob:Blob)=>void, onError?:(error:Error)=>void}} opts
 *   getScene = aktuálna scéna pre drawScene, onEnd sa zavolá po každom skončení
 *   nahrávania (aj po automatickom zastavení po maxSeconds), onError pri zlyhaní štartu
 * @returns {{isSupported:()=>boolean, start:()=>void, stop:()=>Promise<?Blob>,
 *   elapsed:()=>number, state:string}} API (state: 'idle' | 'recording' | 'stopping')
 */
export function createRecorder({
  getScene, fps = 30, maxSeconds = MAX_SECONDS, onEnd = () => {}, onError = () => {},
}) {
  let state = 'idle';
  let recorder = null;
  let stream = null;
  let canvas = null;
  let frame = 0;
  let startedAt = 0;
  let limitTimer = 0;
  let finished = null; // Promise<Blob> posledného nahrávania
  let drawFailed = false;

  /** Podporuje prehliadač nahrávanie z plátna do videa? */
  function isSupported() {
    return Boolean(globalThis.MediaRecorder)
      && typeof globalThis.HTMLCanvasElement !== 'undefined'
      && typeof globalThis.HTMLCanvasElement.prototype.captureStream === 'function'
      && pickMimeType() !== null;
  }

  /** Nakreslí jeden snímok a naplánuje ďalší; chyba kreslenia sa zapíše raz a slučku nezruší. */
  function tick() {
    try {
      const scene = getScene();
      if (scene) drawScene(canvas.getContext('2d'), scene, canvas);
    } catch (error) {
      if (!drawFailed) console.error('Recording: drawing failed', error);
      drawFailed = true;
    }
    frame = requestAnimationFrame(tick);
  }

  /** Uvoľní stopy prúdu, plátno a MediaRecorder. */
  function release() {
    clearTimeout(limitTimer);
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    canvas = null;
    recorder = null;
  }

  /** Spustí nahrávanie aktuálnej úlohy (ignoruje sa, ak už niečo beží alebo končí). */
  function start() {
    if (state !== 'idle') return;
    const scene = getScene();
    if (!scene) return;
    const size = canvasSize(scene.board, VIDEO_WIDTH);
    const mimeType = pickMimeType();
    const chunks = [];
    try {
      canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      drawScene(canvas.getContext('2d'), scene, size); // prvý snímok je hneď k dispozícii
      stream = canvas.captureStream(fps);
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
    } catch (error) {
      release();
      onError(error);
      return;
    }
    const current = recorder;
    current.ondataavailable = (event) => {
      if (event.data?.size > 0) chunks.push(event.data);
    };
    current.onerror = () => halt();
    finished = new Promise((resolve) => {
      current.onstop = () => {
        const blob = new Blob(chunks, { type: current.mimeType || mimeType });
        release();
        state = 'idle';
        resolve(blob);
        onEnd(blob);
      };
    });
    drawFailed = false;
    current.start(500);
    state = 'recording';
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
    limitTimer = setTimeout(() => halt(), maxSeconds * 1000);
  }

  /** Ukončí nahrávanie; opakované volanie je bezpečné (stav 'stopping' sa nastaví hneď). */
  function halt() {
    if (state !== 'recording') return finished;
    state = 'stopping';
    clearTimeout(limitTimer);
    cancelAnimationFrame(frame);
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (error) {
        console.error('Recording: stop failed', error);
        recorder.onstop();
      }
    } else {
      recorder.onstop();
    }
    return finished;
  }

  return {
    isSupported,
    start,
    /**
     * Zastaví nahrávanie (idempotentne).
     * @returns {Promise<?Blob>} hotové video (null, ak ešte nič nenahrávalo)
     */
    stop: () => halt() ?? Promise.resolve(null),
    /** Dĺžka nahrávania v sekundách (0, ak nebeží). */
    elapsed: () => (state === 'recording' ? (performance.now() - startedAt) / 1000 : 0),
    get state() {
      return state;
    },
  };
}
