/**
 * Vyrenderuje SVG zdroje ikon do PNG cez Playwright (Chromium).
 * Spustenie: npm run icons
 */
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const JOBS = [
  { src: 'favicon.svg', out: 'icons/icon-192.png', size: 192 },
  { src: 'favicon.svg', out: 'icons/icon-512.png', size: 512 },
  { src: 'icons/maskable.svg', out: 'icons/icon-maskable-512.png', size: 512 },
];

/** Vyrenderuje jeden SVG súbor na priehľadnom plátne danej veľkosti do PNG. */
async function render(browser, { src, out, size }) {
  const svg = await readFile(join(root, src), 'utf8');
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: join(root, out), omitBackground: true });
  await page.close();
  console.log(`${out} (${size}x${size})`);
}

await mkdir(join(root, 'icons'), { recursive: true });
const browser = await chromium.launch();
try {
  for (const job of JOBS) await render(browser, job);
} finally {
  await browser.close();
}
