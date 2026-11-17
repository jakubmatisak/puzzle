/**
 * Pripraví priečinok so stránkou na nasadenie (GitHub Pages): skopíruje
 * rovnaké súbory ako ZIP odovzdávky a pridá .nojekyll.
 * Použitie: node scripts/build-site.mjs [cieľový priečinok, predvolene _site]
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectFiles } from './make-zip.mjs';

/**
 * Skopíruje súbory stránky z root do outDir (outDir sa najprv vyprázdni).
 * @param {string} root koreň projektu
 * @param {string} outDir cieľový priečinok
 * @returns {string[]} skopírované relatívne cesty
 */
export function buildSite(root, outDir) {
  rmSync(outDir, { recursive: true, force: true });
  const files = collectFiles(root);
  for (const file of files) {
    const target = join(outDir, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, file), target);
  }
  writeFileSync(join(outDir, '.nojekyll'), '');
  return files;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const out = resolve(root, process.argv[2] ?? '_site');
  const files = buildSite(root, out);
  console.log(`Stránka pripravená v ${out} (${files.length} súborov)`);
}
