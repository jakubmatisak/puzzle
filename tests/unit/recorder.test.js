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
