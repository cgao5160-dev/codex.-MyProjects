// 一个零依赖的本地静态文件服务器：运行 `node server.js` 后打开 http://localhost:3000。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = 3000;
const root = __dirname;
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

http.createServer((request, response) => {
  const requestedPath = request.url === '/' ? '/index.html' : decodeURIComponent(request.url.split('?')[0]);
  const filePath = path.resolve(root, `.${requestedPath}`);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }

    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(data);
  });
}).listen(port, () => {
  console.log(`Particle Core 正在运行：http://localhost:${port}`);
  console.log('按 Ctrl+C 可停止服务器。');
});
