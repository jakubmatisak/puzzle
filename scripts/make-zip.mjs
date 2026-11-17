/**
 * Zabalí odovzdávku do dist/<ZZ_NAME>.zip (predvolene ZZ_priezvisko.zip).
 * ZIP obsahuje nasaditeľnú stránku + README.md a PROMPTS.md; index.html je v koreni archívu.
 * Spustenie: npm run zip   (alebo: ZZ_NAME=ZZ_Novak npm run zip)
 */
import { readdirSync, statSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Súbory v koreni projektu, ktoré patria do ZIP-u. */
const ROOT_FILES = ['index.html', 'README.md', 'PROMPTS.md', 'manifest.webmanifest', 'sw.js', 'favicon.svg'];

/** Priečinky, ktoré sa pridajú celé (rekurzívne). */
const DIRS = ['css', 'js', 'data', 'icons', 'docs/img'];

/** Súbory z týchto priečinkov, ktoré hra nepoužíva (solver slúži iba testom). */
const EXCLUDE = ['js/core/solver.js'];

/** Všetky súbory v priečinku (rekurzívne) ako relatívne cesty s lomkou „/“. */
function walk(root, dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(root, rel));
    else out.push(rel);
  }
  return out;
}

/** Existuje cesta? */
function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Zoznam súborov odovzdávky (relatívne cesty, zoradené).
 * Nikdy neobsahuje node_modules, testy, skripty, konfiguráciu ani vývojové dokumenty.
 */
export function collectFiles(root) {
  const files = ROOT_FILES.filter((f) => exists(join(root, f)));
  for (const dir of DIRS) {
    if (exists(join(root, dir))) files.push(...walk(root, dir));
  }
  return files.filter((f) => !EXCLUDE.includes(f)).sort();
}

/** Názov archívu z premennej prostredia ZZ_NAME (predvolene ZZ_priezvisko). */
export function zipName(env = process.env) {
  return `${env.ZZ_NAME || 'ZZ_priezvisko'}.zip`;
}

/** Windows bsdtar (vie -a = formát podľa prípony); GNU tar z Git Bash ZIP nevytvorí. */
function tarCommand() {
  if (process.platform !== 'win32') return 'tar';
  return join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
}

/** Vytvorí dist/<názov>.zip; tar beží v koreni projektu s relatívnymi cestami (index.html v koreni ZIP-u). */
function main() {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const files = collectFiles(root);
  const zip = `dist/${zipName()}`;
  const list = 'dist/files.txt';
  mkdirSync(join(root, 'dist'), { recursive: true });
  rmSync(join(root, zip), { force: true });
  writeFileSync(join(root, list), `${files.join('\n')}\n`);
  try {
    execFileSync(tarCommand(), ['-a', '-c', '-f', zip, '-T', list], { cwd: root, stdio: 'inherit' });
  } finally {
    rmSync(join(root, list), { force: true });
  }
  console.log(`Vytvorený ${zip} (${files.length} súborov)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
