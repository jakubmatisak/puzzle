import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const swText = readFileSync(join(root, 'sw.js'), 'utf8');

/** Vyparsuje pole APP_SHELL zo zdrojového textu sw.js. */
function parseShell(text) {
  const match = text.match(/APP_SHELL\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Rekurzívne vypíše súbory s danou príponou v priečinku (cesty s lomkami). */
function listFiles(dir, ext) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) return listFiles(rel, ext);
    return rel.endsWith(ext) ? [rel] : [];
  });
}

describe('service worker APP_SHELL', () => {
  const shell = parseShell(swText);

  it('is not empty and uses relative paths', () => {
    expect(shell.length).toBeGreaterThan(10);
    shell.forEach((p) => expect(p.startsWith('./')).toBe(true));
  });

  it('lists only files that exist', () => {
    shell.forEach((p) => {
      const rel = p === './' ? 'index.html' : p.slice(2);
      expect(existsSync(join(root, rel)), p).toBe(true);
    });
  });

  it('lists every js and css file', () => {
    const all = [...listFiles('js', '.js'), ...listFiles('css', '.css')];
    all.forEach((f) => expect(shell, f).toContain(`./${f}`));
  });

  it('lists the core files and puzzles', () => {
    ['./', './index.html', './manifest.webmanifest', './favicon.svg', './data/puzzles.json']
      .forEach((p) => expect(shell).toContain(p));
  });

  it('lists all manifest icons', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
    manifest.icons.forEach((icon) => expect(shell).toContain(`./${icon.src.replace(/^\.\//, '')}`));
  });

  it('uses the zapalkovo-v1 cache name', () => {
    expect(swText).toMatch(/CACHE\s*=\s*'zapalkovo-v1'/);
  });
});
