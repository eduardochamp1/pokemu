import { mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const ROM = /\.(gba|gbc|gb)$/i;
const SAVE = /\.(sav|ss[0-9]?)$/i;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
};
const response = (body, status = 200, type = 'application/octet-stream') => new Response(body, { status, headers: { ...headers, 'Content-Type': type } });
const json = (value) => response(JSON.stringify(value), 200, 'application/json');
function inside(root, target) {
  const rel = relative(root, target);
  return rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
async function safeFile(root, name, writing = false) {
  if (!name || name.includes('\0') || name.includes('\\') || name.includes(':') || name.split('/').some(p => p === '..' || p === '.' || !p)) return null;
  const target = resolve(root, name);
  if (!inside(resolve(root), target)) return null;
  try {
    const actualRoot = await realpath(root);
    const actual = await realpath(target);
    return inside(actualRoot, actual) ? target : null;
  } catch {
    // Writes are deliberately limited to one filename in the save directory.
    return writing && !name.includes('/') ? target : null;
  }
}
async function list(root, pattern, prefix = '', depth = 0) {
  if (depth > 4) return [];
  const entries = await readdir(join(root, prefix), { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    const name = prefix + entry.name;
    if (entry.isDirectory()) output.push(...await list(root, pattern, name + '/', depth + 1));
    else if (entry.isFile() && pattern.test(name)) {
      const info = await stat(join(root, name));
      output.push({ fileName: name, size: info.size, modified: info.mtimeMs });
    }
  }
  return output.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export function createHandler({ dist, data }) {
  return async (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== 'pokemu') return response('Forbidden', 403);
      const path = decodeURIComponent(url.pathname);
      const method = request.method;
      const roms = join(data, 'roms');
      const saves = join(data, 'saves');
      if (path === '/local-roms.json' || path === '/local-saves.json') {
        if (method !== 'GET') return response('Method not allowed', 405);
        return json(await list(path === '/local-roms.json' ? roms : saves, path === '/local-roms.json' ? ROM : SAVE));
      }
      const isRom = path.startsWith('/local-roms/');
      const isSave = path.startsWith('/local-saves/');
      if (isRom || isSave) {
        const name = path.slice(isRom ? 12 : 13);
        if (!(isRom ? ROM : SAVE).test(name)) return response('Not found', 404);
        if (method !== 'GET' && !(isSave && method === 'PUT')) return response('Method not allowed', 405);
        const target = await safeFile(isRom ? roms : saves, name, method === 'PUT');
        if (!target) return response('Not found', 404);
        if (method === 'PUT') {
          const max = 32 * 1024 * 1024;
          const reader = request.body?.getReader();
          if (!reader) return response('Missing body', 400);
          const chunks = [];
          let size = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > max) { await reader.cancel(); return response('Save too large', 413); }
            chunks.push(Buffer.from(value));
          }
          const temp = `${target}.${randomUUID()}.tmp`;
          try { await writeFile(temp, Buffer.concat(chunks)); await rename(temp, target); }
          finally { await rm(temp, { force: true }); }
          return json({ ok: true, fileName: name, size });
        }
        return response(await readFile(target));
      }
      if (method !== 'GET' && method !== 'HEAD') return response('Method not allowed', 405);
      const name = path === '/' ? 'index.html' : path.slice(1);
      let target = await safeFile(dist, name);
      // BrowserRouter routes resolve to the SPA; missing assets remain 404.
      if (!target && !extname(name)) target = await safeFile(dist, 'index.html');
      if (!target) return response('Not found', 404);
      return response(method === 'HEAD' ? null : await readFile(target), 200, MIME[extname(target)] ?? 'application/octet-stream');
    } catch (error) {
      if (error?.code === 'ENOENT') return response('Not found', 404);
      console.error('Pokemu file request failed:', error);
      return response('File request failed', 500);
    }
  };
}

export async function prepareData(data) {
  await mkdir(join(data, 'roms'), { recursive: true });
  await mkdir(join(data, 'saves'), { recursive: true });
}
