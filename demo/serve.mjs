#!/usr/bin/env node
// Static server for the demo, with real no-cache headers.
//
//   node demo/serve.mjs [port]
//
// python3 -m http.server sends Last-Modified and no Cache-Control, so a browser is free to keep
// serving a page and a bundle from an earlier build. A <meta http-equiv="Cache-Control"> is not a
// dependable substitute -- browsers largely ignore it for the document itself, which is exactly
// the case that matters on reload. This sends the header, so a refresh is always the current
// build. It also prints the build id it is serving, so "am I looking at the new code" is a
// question you can answer by looking rather than by guessing.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = process.cwd();
const port = +(process.argv[2] || process.env.PORT || 8787);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ttf': 'font/ttf', '.md': 'text/markdown; charset=utf-8',
};

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  // Contain every request to the repo: a normalised path that climbs out is refused.
  const rel = normalize(url === '/' ? '/demo/index.html' : url).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
  try {
    const s = await stat(file);
    const body = await readFile(s.isDirectory() ? join(file, 'index.html') : file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      // The whole point of this server.
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      'pragma': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain', 'cache-control': 'no-store' }).end('not found');
  }
}).listen(port, '127.0.0.1', async () => {
  let build = 'unknown';
  try { build = (/const BUILD = "(\d+)"/.exec(await readFile('dist/embed.js', 'utf8')) || [])[1] || 'unknown'; }
  catch { build = 'dist/embed.js not built yet — run npm run build'; }
  console.error(`serving ${root}`);
  console.error(`  http://127.0.0.1:${port}/demo/index.html   the pitch page`);
  console.error(`  http://127.0.0.1:${port}/demo/review.html  the review bench`);
  console.error(`  no-store on every response. build ${build}`);
});
