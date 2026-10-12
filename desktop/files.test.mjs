import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandler, prepareData } from './files.mjs';

test('desktop serves isolated SPA, ROM library and persistent atomic save backups', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pokemu-test-'));
  try {
    const dist = join(root, 'dist');
    const data = join(root, 'data');
    await mkdir(dist);
    await writeFile(join(dist, 'index.html'), '<main>Pokemu</main>');
    await writeFile(join(dist, 'core.wasm'), Buffer.from([0, 97, 115, 109]));
    await prepareData(data);
    await mkdir(join(data, 'roms', 'gba'));
    await writeFile(join(data, 'roms', 'gba', 'test.gba'), 'rom');
    const handler = createHandler({ dist, data });
    const get = path => handler(new Request(`pokemu://pokemu${path}`));
    const page = await get('/treinador/comparar');
    assert.equal(await page.text(), '<main>Pokemu</main>');
    assert.equal(page.headers.get('Cross-Origin-Embedder-Policy'), 'require-corp');
    assert.equal(page.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
    assert.equal((await get('/core.wasm')).headers.get('Content-Type'), 'application/wasm');
    assert.equal((await get('/missing.js')).status, 404);
    assert.equal((await (await get('/local-roms.json')).json())[0].fileName, 'gba/test.gba');
    assert.equal(await (await get('/local-roms/gba%2Ftest.gba')).text(), 'rom');
    const save = await handler(new Request('pokemu://pokemu/local-saves/test.sav', { method: 'PUT', body: new Uint8Array([1, 2, 3]) }));
    assert.equal(save.status, 200);
    assert.deepEqual(await readFile(join(data, 'saves', 'test.sav')), Buffer.from([1, 2, 3]));
    assert.deepEqual(await (await get('/local-saves/test.sav')).arrayBuffer(), Uint8Array.from([1, 2, 3]).buffer);
    assert.equal((await get('/local-saves/%2e%2e%2Fsecret.sav')).status, 404);
    assert.equal((await handler(new Request('pokemu://other/'))).status, 403);
    assert.equal((await handler(new Request('pokemu://pokemu/local-roms/test.gba', { method: 'PUT', body: 'bad' }))).status, 405);
  } finally { await rm(root, { recursive: true, force: true }); }
});
