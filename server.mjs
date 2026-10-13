import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 3000;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const publicFiles = new Set(['index.html','app.js','styles.css','team-utils.js','favicon.svg']);
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    if (!publicFiles.has(file)) { res.writeHead(404); res.end('Not found'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, {Allow:'GET, HEAD'}); res.end(); return; }
    const content = await readFile(path.join(root, file));
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port ' + port + ' is in use. Set PORT to another number.' : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log('모여모여 is ready: http://localhost:' + port));
