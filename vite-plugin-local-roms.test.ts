import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { middleware, safeResolve } from "./vite-plugin-local-roms.ts";

/**
 * Contenção de caminhos do servidor de dev/preview (AUD-16), com uma pasta
 * descartável no temporário do sistema — nunca `roms/` ou `saves/` de
 * verdade. Uma junction dentro de `roms/` aponta para fora; nada do outro
 * lado pode ser listado, lido ou sobrescrito.
 */

let raiz: string;
let fora: string;

beforeAll(async () => {
  raiz = await mkdtemp(join(tmpdir(), "pokemu-contencao-"));
  fora = await mkdtemp(join(tmpdir(), "pokemu-fora-"));
  await mkdir(join(raiz, "roms", "gba"), { recursive: true });
  await mkdir(join(raiz, "saves"), { recursive: true });
  await writeFile(join(raiz, "roms", "gba", "legitima.gba"), "rom");
  await writeFile(join(fora, "segredo.gba"), "fora");
  await writeFile(join(fora, "alheio.sav"), "save de fora");
  // "junction" no Windows (não exige administrador); link de pasta no resto.
  await symlink(fora, join(raiz, "roms", "atalho"), "junction");
  await symlink(fora, join(raiz, "saves", "atalho"), "junction");
});

afterAll(async () => {
  await rm(raiz, { recursive: true, force: true });
  await rm(fora, { recursive: true, force: true });
});

function pedir(url: string, method = "GET", corpo?: string) {
  return new Promise<{ status: number; body: string }>((done) => {
    const req = Object.assign(Readable.from(corpo ? [Buffer.from(corpo)] : []), { url, method });
    const res = {
      statusCode: 200,
      setHeader() {},
      end(body?: unknown) {
        done({ status: this.statusCode, body: body === undefined ? "" : String(body) });
      },
    };
    middleware(raiz)(req as never, res as never, () => done({ status: 0, body: "next" }));
  });
}

describe("contenção de caminhos (AUD-16)", () => {
  it("a lista mostra a ROM legítima e não segue a junction", async () => {
    const lista = JSON.parse((await pedir("/local-roms.json")).body) as { fileName: string }[];
    expect(lista.map((e) => e.fileName)).toEqual(["gba/legitima.gba"]);
  });

  it("leitura legítima continua funcionando", async () => {
    expect(await pedir("/local-roms/gba%2Flegitima.gba")).toEqual({ status: 200, body: "rom" });
  });

  it("arquivo do outro lado da junction não é lido", async () => {
    expect((await pedir("/local-roms/atalho%2Fsegredo.gba")).status).toBe(404);
    expect((await pedir("/local-saves/atalho%2Falheio.sav")).status).toBe(404);
  });

  it("gravar através da junction é recusado e o arquivo de fora fica intacto", async () => {
    expect((await pedir("/local-saves/atalho%2Falheio.sav", "PUT", "invasor")).status).toBe(404);
    expect(await readFile(join(fora, "alheio.sav"), "utf8")).toBe("save de fora");
  });

  it("gravação legítima é atômica e não deixa temporário", async () => {
    expect((await pedir("/local-saves/Jogo.sav", "PUT", "progresso")).status).toBe(200);
    expect(await readFile(join(raiz, "saves", "Jogo.sav"), "utf8")).toBe("progresso");
    expect((await readdir(join(raiz, "saves"))).filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });

  it("caminhos com .., absolutos ou vazios são recusados antes do disco", async () => {
    const base = join(raiz, "roms");
    expect(await safeResolve(base, "../saves/Jogo.sav")).toBeNull();
    expect(await safeResolve(base, "gba/../../x.gba")).toBeNull();
    expect(await safeResolve(base, "")).toBeNull();
    expect(await safeResolve(base, "gba//legitima.gba")).toBeNull();
  });
});
