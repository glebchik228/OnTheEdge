const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.argv[2] || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Укажите номер порта от 1 до 65535: node server.cjs 4173');
  process.exit(1);
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (file === root) file = path.join(root, 'index.html');
  fs.readFile(file, (error, content) => {
    if (error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(content);
  });
}).on('error', error => {
  console.error(`Не удалось открыть порт ${port}: ${error.code}. Попробуйте другой: node server.cjs ${port < 65535 ? port + 1 : 4173}. Можно также открыть index.html напрямую.`);
  process.exitCode = 1;
}).listen(port, '127.0.0.1', () => console.log(`На грани: http://127.0.0.1:${port} (Ctrl+C — остановить)`));
