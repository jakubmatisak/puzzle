import { describe, it, expect, afterAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { buildSite } from '../../scripts/build-site.mjs';
import { collectFiles } from '../../scripts/make-zip.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const out = join(mkdtempSync(join(tmpdir(), 'zapalkovo-site-')), '_site');

describe('build-site', () => {
  const copied = buildSite(root, out);

  afterAll(() => rmSync(resolve(out, '..'), { recursive: true, force: true }));

  it('skopíruje presne súbory odovzdávky (rovnaké ako ZIP)', () => {
    expect(copied).toEqual(collectFiles(root));
    for (const f of copied) expect(existsSync(join(out, f))).toBe(true);
  });

  it('obsah súborov je zhodný so zdrojom', () => {
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toBe(readFileSync(join(root, 'index.html'), 'utf8'));
  });

  it('pridá .nojekyll, aby GitHub Pages nič neprekladal', () => {
    expect(existsSync(join(out, '.nojekyll'))).toBe(true);
  });

  it('nekopíruje testy ani node_modules', () => {
    expect(existsSync(join(out, 'tests'))).toBe(false);
    expect(existsSync(join(out, 'node_modules'))).toBe(false);
  });
});
