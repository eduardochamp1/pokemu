import { app, BrowserWindow, dialog, Menu, protocol, shell } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHandler, prepareData } from './files.mjs';

protocol.registerSchemesAsPrivileged([{ scheme: 'pokemu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
app.setName('Pokemu');
app.setAppUserModelId('com.pokemu.desktop');
const here = dirname(fileURLToPath(import.meta.url));
let window;
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.setPath('userData', mkdtempSync(join(tmpdir(), 'pokemu-smoke-')));

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    const data = process.env.POKEMU_DATA_DIR || app.getPath('userData');
    await prepareData(data);
    protocol.handle('pokemu', createHandler({ dist: join(here, '../dist'), data }));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Pokemu', submenu: [
        { label: 'Abrir pasta de ROMs', click: () => shell.openPath(join(data, 'roms')) },
        { label: 'Abrir pasta de saves', click: () => shell.openPath(join(data, 'saves')) },
        { type: 'separator' }, { role: 'quit', label: 'Sair' },
      ] },
      { label: 'Exibir', submenu: [{ role: 'togglefullscreen', label: 'Tela cheia' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
    ]));
    window = new BrowserWindow({ width: 1280, height: 850, minWidth: 720, minHeight: 560, title: 'Pokemu', icon: join(here, '../dist/favicon.ico'), show: !smoke, backgroundColor: '#0b0e13', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
    const openExternal = (url) => { if (/^https?:\/\//i.test(url)) void shell.openExternal(url); };
    window.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
    window.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('pokemu://pokemu/')) { event.preventDefault(); openExternal(url); }
    });
    window.webContents.session.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'fullscreen'));
    await window.loadURL('pokemu://pokemu/');
    if (smoke) {
      const result = await window.webContents.executeJavaScript(`(async () => {
        for (let i = 0; i < 200 && !document.querySelector('.play-core'); i++) await new Promise(r => setTimeout(r, 100));
        return { isolated: crossOriginIsolated, sab: typeof SharedArrayBuffer !== 'undefined', rendered: !!document.querySelector('main'), core: document.querySelector('.play-core')?.textContent, roms: (await fetch('/local-roms.json')).status, saves: (await fetch('/local-saves.json')).status };
      })()`);
      console.log('POKEMU_SMOKE', JSON.stringify(result));
      app.exit(result.isolated && result.sab && result.rendered && result.core && result.roms === 200 && result.saves === 200 ? 0 : 1);
    }
  }).catch(error => { console.error(error); if (!smoke) dialog.showErrorBox('Pokemu', String(error)); app.exit(1); });
  app.on('window-all-closed', () => app.quit());
}
