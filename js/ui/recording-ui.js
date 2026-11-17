/**
 * Ovládanie nahrávania na obrazovke hry: tlačidlo Nahrávať/Zastaviť, indikátor
 * „● REC 00:12“, po zastavení panel s náhľadom videa a odkazom na stiahnutie.
 */
import { createRecorder } from './recorder.js';

/** Čas v sekundách ako „mm:ss“. */
export function formatTime(seconds) {
  const total = Math.floor(seconds);
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Prepojí nahrávač s hrou a obrazovkou.
 * @param {{root:HTMLElement, game:{getScene:Function, getCurrent:Function}, i18n:{t:Function}}} opts
 *   root = obrazovka hry (#view-play)
 * @returns {{stop:()=>void, isRecording:()=>boolean}} stop = zastaví bežiace nahrávanie
 */
export function createRecordingUi({ root, game, i18n }) {
  const button = root.querySelector('[data-action="record"]');
  const label = button.querySelector('span');
  const indicator = root.querySelector('#rec-indicator');
  const time = root.querySelector('#rec-time');
  const note = root.querySelector('#record-note');
  const panel = root.querySelector('#recording');
  const videoBox = panel.querySelector('.recording-video');
  const download = panel.querySelector('#rec-download');
  const closeButton = panel.querySelector('#rec-close');

  let puzzleId = null; // úloha, ktorá sa nahráva
  let url = null; // adresa blobu práve zobrazeného videa
  let timer = 0;

  const recorder = createRecorder({
    getScene: game.getScene,
    onEnd: (blob) => showResult(blob),
  });

  /** Tlačidlo: text podľa stavu (data-i18n, aby ho prekladal aj prepínač jazyka). */
  function renderButton() {
    const recording = recorder.state === 'recording';
    label.dataset.i18n = recording ? 'game.stopRecord' : 'game.record';
    label.textContent = i18n.t(label.dataset.i18n);
    button.classList.toggle('is-recording', recording);
    button.setAttribute('aria-pressed', String(recording));
    indicator.hidden = !recording;
  }

  /** Aktualizuje čas v indikátore. */
  function renderTime() {
    time.textContent = `REC ${formatTime(recorder.elapsed())}`;
  }

  /** Uvoľní adresu starého videa a odstráni náhľad. */
  function clearResult() {
    if (url) URL.revokeObjectURL(url);
    url = null;
    videoBox.replaceChildren();
    download.removeAttribute('href');
    panel.hidden = true;
  }

  /** Po skončení nahrávania zobrazí náhľad a odkaz na stiahnutie. */
  function showResult(blob) {
    clearInterval(timer);
    renderButton();
    clearResult();
    url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.playsInline = true;
    video.muted = true;
    videoBox.append(video);
    download.href = url;
    download.download = `zapalkovo-${puzzleId}.webm`;
    panel.hidden = false;
  }

  /** Spustí nahrávanie aktuálnej úlohy. */
  function start() {
    if (!game.getCurrent()) return;
    clearResult();
    puzzleId = game.getCurrent().id;
    recorder.start();
    renderButton();
    renderTime();
    timer = setInterval(renderTime, 500);
  }

  /** Zastaví nahrávanie, ak beží. */
  function stop() {
    if (recorder.state === 'recording') recorder.stop();
  }

  if (recorder.isSupported()) {
    button.addEventListener('click', () => (recorder.state === 'recording' ? stop() : start()));
  } else {
    button.disabled = true;
    button.dataset.i18nAttr = 'title:record.unsupported';
    button.title = i18n.t('record.unsupported');
    note.hidden = false;
  }
  closeButton.addEventListener('click', () => {
    clearResult();
    button.focus();
  });
  // Iná úloha = koniec nahrávania; výsledok zostane k dispozícii.
  root.addEventListener('puzzlechange', stop);

  return { stop, isRecording: () => recorder.state === 'recording' };
}
