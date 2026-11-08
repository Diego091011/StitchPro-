const { app, BrowserWindow, shell } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Servidor local mínimo: así la app corre en http://127.0.0.1 (como con Live Server) y conserva sesión y tema entre aperturas.
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PUERTO = 47831;

function servir() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const permitido = /^\/(assets|js)\//.test(p) || /^\/[\w-]+\.html$/.test(p);
    const f = path.normalize(path.join(__dirname, p));
    if (!permitido || !f.startsWith(__dirname + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); return res.end('No encontrado'); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((ok) => {
    srv.once('error', () => srv.listen(0, '127.0.0.1')); // puerto ocupado: usa otro
    srv.listen(PUERTO, '127.0.0.1', () => ok(srv.address().port));
    srv.on('listening', () => ok(srv.address().port));
  });
}

async function crearVentana() {
  const puerto = await servir();
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 380, backgroundColor: '#05060d', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // El recibo se abre como ventana en blanco para imprimir: se permite; los enlaces externos (WhatsApp) van al navegador.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank') return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 820, height: 900 } };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL(`http://127.0.0.1:${puerto}/index.html`);
}
app.whenReady().then(crearVentana);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });