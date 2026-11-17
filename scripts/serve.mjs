import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.webm': 'video/webm',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.split(/[\/]/).includes('..')) return send(res, 403, 'Forbidden');
    let file = normalize(join(root, pathname));
    if (file !== root && !file.startsWith(root + sep)) return send(res, 403, 'Forbidden');
    const info = await stat(file).catch(() => null);
    if (info?.isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file).catch(() => null);
    if (!data) return send(res, 404, 'Not found');
    send(res, 200, data, MIME[extname(file).toLowerCase()] || 'application/octet-stream');
  } catch {
    send(res, 400, 'Bad request');
  }
}).listen(port, () => console.log(`Serving on http://localhost:${port}/`));
