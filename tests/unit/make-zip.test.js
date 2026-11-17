import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { collectFiles, zipName } from '../../scripts/make-zip.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

describe('make-zip collectFiles', () => {
  const files = collectFiles(root);

  it('obsahuje povinné súbory v koreni', () => {
    for (const f of ['index.html', 'README.md', 'PROMPTS.md', 'manifest.webmanifest', 'sw.js', 'favicon.svg']) {
      expect(files).toContain(f);
    }
  });

  it('obsahuje aplikáciu, dáta, ikony a obrázky dokumentácie', () => {
    expect(files).toContain('js/app.js');
    expect(files).toContain('js/core/geometry.js');
    expect(files).toContain('css/tokens.css');
    expect(files).toContain('data/puzzles.json');
    expect(files).toContain('icons/icon-192.png');
    expect(files.some((f) => f.startsWith('docs/img/'))).toBe(true);
  });

  it('používa relatívne cesty s lomkou a je zoradený', () => {
    expect(files.every((f) => !f.includes('\\')&& !f.startsWith('/'))).toBe(true);
    expect([...files].sort()).toEqual(files);
  });

  it('neobsahuje vývojové a generované súbory', () => {
    const banned = ['node_modules/', '.git/', '.superpowers/', 'dist/', 'test-results/',
      'playwright-report/', 'tests/', 'scripts/', 'docs/superpowers/', 'shots/'];
    for (const prefix of banned) {
      expect(files.some((f) => f.startsWith(prefix)), prefix).toBe(false);
    }
    for (const f of ['package.json', 'package-lock.json', 'playwright.config.js', 'vitest.config.js',
      '.gitignore', '.htmlvalidate.json', '.stylelintrc.json']) {
      expect(files).not.toContain(f);
    }
  });
});

describe('make-zip zipName', () => {
  it('predvolene ZZ_priezvisko, inak z ZZ_NAME', () => {
    expect(zipName({})).toBe('ZZ_priezvisko.zip');
    expect(zipName({ ZZ_NAME: 'ZZ_Novak' })).toBe('ZZ_Novak.zip');
  });
});
