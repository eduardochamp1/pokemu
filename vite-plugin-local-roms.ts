import {
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Connect, Plugin, ViteDevServer, PreviewServer } from "vite";

/**
 * Pastas locais do emulador — servidas SO em dev e preview.
 *
 * Por que um plugin em vez de `public/`: qualquer coisa em `public/` e copiada
 * para `dist/` no build, ou seja, o deploy passaria a distribuir as ROMs. Aqui
 * nao existe hook de build: os arquivos ficam alcancaveis na sua maquina, e o
 * artefato de producao nao os contem.
 *
 * Rotas (todas ausentes em producao — a pagina degrada para o seletor de
 * arquivo e para o IndexedDB):
 *
 *   GET /local-roms.json        -> [{ fileName, size }]  (recursivo)
 *   GET /local-roms/<caminho>   -> bytes da ROM
 *   GET /local-saves.json       -> [{ fileName, size, modified }]
 *   GET /local-saves/<arquivo>  -> bytes do save
 *   PUT /local-saves/<arquivo>  -> grava o save em disco
 *
 * O PUT e o que faz os saves durarem de verdade: sem ele o progresso vive so
 * no IndexedDB do navegador, que sobrevive a recarregar mas pode ser descartado
 * sob pressao de disco ou por "limpar dados do site".
 */

const ROMS_DIR = "roms";
const SAVES_DIR = "saves";
const ROM_EXT = new Set([".gb", ".gbc", ".gba"]);
/** `.sav` = save de bateria; `.ss1`..`.ss9` = save states; `.ss` = automatico. */
const SAVE_EXT = /\.(sav|ss[0-9]?)$/i;
/** Teto por arquivo de save: um .sav de GBA tem 128 kB; state, alguns MB. */
const MAX_SAVE_BYTES = 32 * 1024 * 1024;

interface Entry {
  fileName: string;
  size: number;
  modified?: number;
}

function inside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return !!rel && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * Resolve um caminho pedido pela URL dentro de `base`, recusando qualquer coisa
 * que escape: `../`, caminho absoluto e link ou junction para fora. A mesma
 * política do servidor do aplicativo desktop (`desktop/files.mjs`): primeiro o
 * caminho como texto, depois o caminho real no disco, que é o que um link
 * muda. Para gravar um arquivo que ainda não existe, o que se confere é a
 * pasta real onde ele vai cair — e só um nome, sem subpasta.
 */
export async function safeResolve(base: string, requested: string, writing = false): Promise<string | null> {
  const clean = requested.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean || clean.includes("\0") || clean.split("/").some((part) => part === ".." || part === "." || !part)) return null;
  const target = resolve(base, clean);
  if (!inside(resolve(base), target)) return null;
  let raiz: string;
  try {
    raiz = await realpath(base);
  } catch {
    return null;
  }
  try {
    return inside(raiz, await realpath(target)) ? target : null;
  } catch {
    if (!writing || clean.includes("/")) return null;
    try {
      return (await realpath(dirname(target))) === raiz ? target : null;
    } catch {
      return null;
    }
  }
}

/** Varre um diretorio recursivamente, devolvendo caminhos relativos. */
async function walk(
  dir: string,
  accept: (name: string) => boolean,
  prefix = "",
  depth = 0
): Promise<Entry[]> {
  if (depth > 4) return []; // guarda contra hierarquia absurda / ciclos
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return []; // pasta nao existe: sem biblioteca local, sem erro
  }

  const out: Entry[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    let info;
    try {
      // lstat, não stat: link e junction aparecem como o que são, e ficam de
      // fora — seguir um deles listaria arquivo de fora da pasta.
      info = await lstat(full);
    } catch {
      continue; // sumiu entre readdir e stat
    }
    if (info.isSymbolicLink()) continue;
    if (info.isDirectory()) {
      out.push(...(await walk(full, accept, `${prefix}${name}/`, depth + 1)));
    } else if (info.isFile() && accept(name)) {
      out.push({
        fileName: `${prefix}${name}`,
        size: info.size,
        modified: info.mtimeMs,
      });
    }
  }
  return out;
}

function json(res: Parameters<Connect.NextHandleFunction>[1], body: unknown) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function notFound(res: Parameters<Connect.NextHandleFunction>[1]) {
  res.statusCode = 404;
  res.end("Not found");
}

/** Le o corpo da requisicao com teto de tamanho. */
function readBody(
  req: Parameters<Connect.NextHandleFunction>[0],
  limit: number
): Promise<Buffer | null> {
  return new Promise((done) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > limit) {
        done(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => done(Buffer.concat(chunks)));
    req.on("error", () => done(null));
  });
}

export function middleware(root: string): Connect.NextHandleFunction {
  const romsDir = resolve(root, ROMS_DIR);
  const savesDir = resolve(root, SAVES_DIR);

  return (req, res, next) => {
    const rawUrl = req.url ?? "";
    const [path] = rawUrl.split("?");
    const method = (req.method ?? "GET").toUpperCase();

    // ---- manifestos ----
    if (path === "/local-roms.json") {
      walk(romsDir, (n) => ROM_EXT.has(extname(n).toLowerCase()))
        .then((list) =>
          json(
            res,
            list.sort((a, b) => a.fileName.localeCompare(b.fileName))
          )
        )
        .catch(next);
      return;
    }

    if (path === "/local-saves.json") {
      walk(savesDir, (n) => SAVE_EXT.test(n))
        .then((list) =>
          json(
            res,
            list.sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0))
          )
        )
        .catch(next);
      return;
    }

    // ---- ROMs (somente leitura) ----
    if (path.startsWith("/local-roms/")) {
      void (async () => {
        const target = await safeResolve(romsDir, decodeURIComponent(path.slice("/local-roms/".length)));
        if (!target || !ROM_EXT.has(extname(target).toLowerCase())) {
          notFound(res);
          return;
        }
        try {
          const buffer = await readFile(target);
          res.setHeader("Content-Type", "application/octet-stream");
          res.setHeader("Content-Length", String(buffer.length));
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
          res.end(buffer);
        } catch {
          notFound(res);
        }
      })();
      return;
    }

    // ---- saves (leitura e escrita) ----
    if (path.startsWith("/local-saves/")) {
      void (async () => {
        const name = decodeURIComponent(path.slice("/local-saves/".length));
        if (method === "PUT") await mkdir(savesDir, { recursive: true }).catch(() => undefined);
        const target = await safeResolve(savesDir, name, method === "PUT");
        if (!target || !SAVE_EXT.test(target)) {
          notFound(res);
          return;
        }

        if (method === "GET") {
          try {
            const buffer = await readFile(target);
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Length", String(buffer.length));
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
            res.end(buffer);
          } catch {
            notFound(res);
          }
          return;
        }

        if (method === "PUT") {
          const body = await readBody(req, MAX_SAVE_BYTES);
          if (!body) {
            res.statusCode = 413;
            res.end("Save grande demais");
            return;
          }
          // Temporario + rename: se o processo cair no meio da gravacao,
          // o save anterior continua inteiro em vez de ficar truncado.
          // O sufixo .tmp nao casa com SAVE_EXT, entao nao aparece na lista.
          // Nome unico e criacao exclusiva ("wx"): duas gravacoes ao mesmo
          // tempo nao dividem o temporario, e um link plantado com o nome
          // dele nao e seguido.
          const temp = `${target}.${randomUUID()}.tmp`;
          try {
            await writeFile(temp, body, { flag: "wx" });
            await rename(temp, target);
            json(res, { ok: true, fileName: name, size: body.length });
          } catch (error) {
            await rm(temp, { force: true });
            res.statusCode = 500;
            res.end(error instanceof Error ? error.message : "erro ao gravar");
          }
          return;
        }

        res.statusCode = 405;
        res.end("Method not allowed");
      })();
      return;
    }

    next();
  };
}

export function localRoms(): Plugin {
  return {
    name: "local-roms",
    apply: (_config, env) => env.command === "serve",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(middleware(server.config.root));
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(middleware(server.config.root));
    },
  };
}
