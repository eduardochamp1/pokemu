/** Developer validation only: boots one local ROM in an isolated temporary profile.
 * Usage: electron desktop/rom-check.mjs <rom> <output-dir> [button...]
 * A button suffix :N repeats it N times. Captures a screenshot and battery save.
 */
import { app, BrowserWindow, protocol } from 'electron';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler, prepareData } from './files.mjs';

protocol.registerSchemesAsPrivileged([{ scheme: 'pokemu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const args = process.argv.slice(2);
const [romPath, output, ...buttons] = args;
if (!romPath || !output) throw new Error('Provide ROM and output directory');
const data = mkdtempSync(join(tmpdir(), 'pokemu-rom-check-'));
app.setPath('userData', data);
app.whenReady().then(async () => {
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  await prepareData(data);
  await mkdir(output, { recursive: true });
  const assets = await readdir(join(dist, 'assets'));
  let module;
  for (const name of assets.filter(n => /^mgba-.*\.js$/.test(n))) {
    const text = await readFile(join(dist, 'assets', name), 'utf8');
    if (text.includes('as default}')) module = name;
  }
  if (!module) throw new Error('Build the application before running the check');
  const handler = createHandler({ dist, data });
  protocol.handle('pokemu', async request => {
    const path = new URL(request.url).pathname;
    if (path === '/check.html') return new Response('<canvas id="screen" width="240" height="160"></canvas>', { headers: { 'Content-Type': 'text/html', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } });
    if (path === '/check-rom') return new Response(await readFile(romPath), { headers: { 'Cross-Origin-Resource-Policy': 'same-origin' } });
    return handler(request);
  });
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: true } });
  await win.loadURL('pokemu://pokemu/check.html');
  const result = await win.webContents.executeJavaScript(`(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const { default: mgba } = await import('/assets/${module}');
    const core = await mgba({ canvas: document.querySelector('canvas') });
    await core.FSInit();
    let frames = 0;
    const logs = [];
    core.setLogger(entry => { if (logs.length < 15) logs.push(entry); });
    core.addCoreCallbacks({ keysReadCallback: () => frames++ });
    core.setCoreSettings({ audioSync: false, videoSync: false, timestepSync: true });
    core.setVolume(0);
    const file = new File([await (await fetch('/check-rom')).arrayBuffer()], ${JSON.stringify(basename(romPath))});
    await new Promise(done => core.uploadRom(file, done));
    const loaded = core.loadGame(core.filePaths().gamePath + '/' + file.name);
    if (!loaded) throw Error('ROM rejected');
    core.setFastForwardMultiplier(1); await sleep(2500);
    for (const command of ${JSON.stringify(buttons)}) {
      const [button, repetitions] = command.split(':');
      if (button === 'Speed') { core.setFastForwardMultiplier(Number(repetitions) || 1); continue; }
      if (button === 'Wait') { await sleep(Number(repetitions) || 1000); continue; }
      for (let i = 0; i < (Number(repetitions) || 1); i++) {
        core.buttonPress(button); await sleep(70); core.buttonUnpress(button); await sleep(160);
      }
    }
    await sleep(500); core.pauseGame(); await core.FSSync();
    const captured = core.screenshot('validation.png');
    return { loaded, frames, logs, screenshot: captured ? Array.from(core.FS.readFile(core.filePaths().screenshotsPath + '/validation.png')) : null, save: Array.from(core.getSave() ?? []) };
  })()`);
  if (result.screenshot) await writeFile(join(output, 'screen.png'), Buffer.from(result.screenshot));
  await writeFile(join(output, 'battery.sav'), Buffer.from(result.save));
  console.log(JSON.stringify({ rom: basename(romPath), loaded: result.loaded, frames: result.frames, logs: result.logs, saveBytes: result.save.length, output }));
  // keysReadCallback is not emitted by the GB core; inspect its screenshot.
  app.exit(result.loaded && result.screenshot ? 0 : 1);
}).catch(error => { console.error(error); app.exit(1); });
