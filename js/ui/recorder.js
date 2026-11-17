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
 * @param {{getScene:()=>object, fps?:number, maxSeconds?:number, onEnd?:(blob:Blob)=>void}} opts
 *   getScene = aktuálna scéna pre drawScene, onEnd sa zavolá po každom skončení
 *   nahrávania (aj po automatickom zastavení po maxSeconds)
 * @returns {{isSupported:()=>boolean, start:()=>void, stop:()=>Promise<Blob>,
 *   elapsed:()=>number, state:string}} API (state: 'idle' | 'recording')
 */
export function createRecorder({
  getScene, fps = 30, maxSeconds = MAX_SECONDS, onEnd = () => {},
}) {
  let state = 'idle';
  let recorder = null;
  let canvas = null;
  let frame = 0;
  let startedAt = 0;
  let limitTimer = 0;
  let finished = null; // Promise<Blob> bežiaceho nahrávania

  /** Podporuje prehliadač nahrávanie z plátna do videa? */
  function isSupported() {
    return Boolean(globalThis.MediaRecorder)
      && typeof globalThis.HTMLCanvasElement !== 'undefined'
      && typeof globalThis.HTMLCanvasElement.prototype.captureStream === 'function'
      && pickMimeType() !== null;
  }

  /** Nakreslí jeden snímok a naplánuje ďalší. */
  function tick() {
    const scene = getScene();
    if (scene) drawScene(canvas.getContext('2d'), scene, canvas);
    frame = requestAnimationFrame(tick);
  }

  /** Spustí nahrávanie aktuálnej úlohy (nič, ak už beží). */
  function start() {
    if (state === 'recording') return;
    const scene = getScene();
    const size = canvasSize(scene.board, VIDEO_WIDTH);
    canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    drawScene(canvas.getContext('2d'), scene, size); // prvý snímok je hneď k dispozícii
    const mimeType = pickMimeType();
    const chunks = [];
    recorder = new MediaRecorder(canvas.captureStream(fps), { mimeType, videoBitsPerSecond: 2_500_000 });
    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunks.push(event.data);
    };
    finished = new Promise((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
        state = 'idle';
        resolve(blob);
        onEnd(blob);
      };
    });
    recorder.start(500);
    state = 'recording';
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
    limitTimer = setTimeout(() => stop(), maxSeconds * 1000);
  }

  /**
   * Zastaví nahrávanie.
   * @returns {Promise<Blob>} hotové video
   */
  function stop() {
    if (state !== 'recording') return finished ?? Promise.reject(new Error('not recording'));
    clearTimeout(limitTimer);
    cancelAnimationFrame(frame);
    recorder.stop();
    return finished;
  }

  return {
    isSupported,
    start,
    stop,
    /** Dĺžka nahrávania v sekundách (0, ak nebeží). */
    elapsed: () => (state === 'recording' ? (performance.now() - startedAt) / 1000 : 0),
    get state() {
      return state;
    },
  };
}
