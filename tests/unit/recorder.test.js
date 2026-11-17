import { describe, it, expect, afterEach } from 'vitest';
import { createRecorder, pickMimeType, MIME_TYPES } from '../../js/ui/recorder.js';

afterEach(() => {
  delete globalThis.MediaRecorder;
});

describe('createRecorder', () => {
  it('bez MediaRecorder isSupported() === false', () => {
    delete globalThis.MediaRecorder;
    const rec = createRecorder({ getScene: () => null });
    expect(rec.isSupported()).toBe(false);
    expect(rec.state).toBe('idle');
  });
});

describe('pickMimeType', () => {
  it('vyberie prvý podporovaný typ zo zoznamu', () => {
    globalThis.MediaRecorder = { isTypeSupported: (t) => t === 'video/webm;codecs=vp8' || t === 'video/webm' };
    expect(pickMimeType()).toBe('video/webm;codecs=vp8');
  });
  it('bez podporovaného typu vráti null', () => {
    globalThis.MediaRecorder = { isTypeSupported: () => false };
    expect(pickMimeType()).toBeNull();
  });
  it('zoznam začína vp9', () => {
    expect(MIME_TYPES[0]).toBe('video/webm;codecs=vp9');
  });
});

describe('stop() a stav "stopping"', () => {
  const wait = (ms = 20) => new Promise((resolve) => { setTimeout(resolve, ms); });
  let created;
  let stopCalls;

  /** Falošné prostredie prehliadača: plátno, captureStream, MediaRecorder, rAF. */
  function installFakes() {
    created = 0;
    stopCalls = 0;
    const ctx = new Proxy({}, {
      get: (t, name) => (name in t ? t[name] : (...args) => (String(name).startsWith('create') ? { addColorStop() {} } : (name === 'measureText' ? { width: 1 } : args[0] && undefined))),
      set: (t, name, value) => { t[name] = value; return true; },
    });
    class FakeCanvas {
      getContext() { return ctx; }
      captureStream() { return { getTracks: () => [{ stop() {} }] }; }
    }
    globalThis.HTMLCanvasElement = FakeCanvas;
    globalThis.document = { createElement: () => new FakeCanvas() };
    globalThis.requestAnimationFrame = () => 1;
    globalThis.cancelAnimationFrame = () => {};
    globalThis.MediaRecorder = class {
      static isTypeSupported() { return true; }
      constructor() { created += 1; this.state = 'inactive'; this.mimeType = 'video/webm'; }
      start() { this.state = 'recording'; }
      stop() {
        stopCalls += 1;
        if (this.state === 'inactive') throw new Error('InvalidStateError');
        this.state = 'inactive';
        setTimeout(() => this.onstop(), 0);
      }
    };
  }

  const scene = async () => {
    const { readFileSync } = await import('node:fs');
    const { normalizePuzzles } = await import('../../js/core/puzzles.js');
    const { createState } = await import('../../js/core/puzzle-state.js');
    const data = normalizePuzzles(JSON.parse(readFileSync(new URL('../../data/puzzles.json', import.meta.url), 'utf8')));
    const puzzle = data.puzzles[0];
    return { board: puzzle.board, matches: createState(puzzle).matches, drag: null, title: 't' };
  };

  afterEach(() => {
    delete globalThis.HTMLCanvasElement;
    delete globalThis.document;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  });

  it('dvojité stop() nehodí chybu a onEnd príde raz', async () => {
    installFakes();
    const s = await scene();
    let ends = 0;
    const rec = createRecorder({ getScene: () => s, onEnd: () => { ends += 1; } });
    rec.start();
    expect(rec.state).toBe('recording');
    const first = rec.stop();
    expect(rec.state).toBe('stopping');
    const second = rec.stop();
    expect(second).toBe(first);
    await first;
    await wait();
    expect(ends).toBe(1);
    expect(stopCalls).toBe(1);
    expect(rec.state).toBe('idle');
    expect(() => rec.stop()).not.toThrow();
  });

  it('start() počas "stopping" sa ignoruje', async () => {
    installFakes();
    const s = await scene();
    const rec = createRecorder({ getScene: () => s });
    rec.start();
    const done = rec.stop();
    rec.start();
    expect(created).toBe(1);
    await done;
  });

  it('chyba pri vytvorení MediaRecorder zavolá onError a ostane idle', async () => {
    installFakes();
    const s = await scene();
    globalThis.MediaRecorder = class {
      static isTypeSupported() { return true; }
      constructor() { throw new Error('boom'); }
    };
    let error = null;
    const rec = createRecorder({ getScene: () => s, onError: (e) => { error = e; } });
    expect(() => rec.start()).not.toThrow();
    expect(error).toBeTruthy();
    expect(rec.state).toBe('idle');
  });

  it('start() bez scény sa ignoruje', () => {
    installFakes();
    const rec = createRecorder({ getScene: () => null });
    rec.start();
    expect(rec.state).toBe('idle');
  });
});
