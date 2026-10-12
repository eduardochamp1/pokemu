import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O `public/sw.js` é um script solto, sem módulo: aqui ele roda dentro de um
 * escopo falso (`self` e `caches`) para dar para disparar `activate` e olhar
 * o que sobrou em cada cache.
 */

type Entradas = Map<string, string>;

function ambiente(inicial: Record<string, Record<string, string>>) {
  const store = new Map<string, Entradas>(
    Object.entries(inicial).map(([nome, entradas]) => [nome, new Map(Object.entries(entradas))])
  );
  const chave = (r: unknown) => (typeof r === "string" ? r : (r as { url: string }).url);
  const cache = (entradas: Entradas) => ({
    keys: async () => [...entradas.keys()].map((url) => ({ url })),
    match: async (r: unknown) => (entradas.has(chave(r)) ? { body: entradas.get(chave(r)), clone() { return this; } } : undefined),
    put: async (r: unknown, resp: { body: string }) => void entradas.set(chave(r), resp.body),
  });
  const caches = {
    keys: async () => [...store.keys()],
    open: async (nome: string) => {
      if (!store.has(nome)) store.set(nome, new Map());
      return cache(store.get(nome)!);
    },
    delete: async (nome: string) => store.delete(nome),
  };
  const handlers: Record<string, (e: { waitUntil(p: Promise<unknown>): void }) => void> = {};
  const self = {
    addEventListener: (tipo: string, fn: (e: { waitUntil(p: Promise<unknown>): void }) => void) => {
      handlers[tipo] = fn;
    },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    location: { origin: "https://pokemu.test" },
  };
  const fonte = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8").replace('"__SW_VERSION__"', '"teste"');
  new Function("self", "caches", fonte)(self, caches);

  const ativar = async () => {
    let espera: Promise<unknown> = Promise.resolve();
    handlers.activate({ waitUntil: (p) => void (espera = p) });
    await espera;
  };
  const estado = () => Object.fromEntries([...store].sort().map(([nome, e]) => [nome, Object.fromEntries(e)]));
  return { ativar, estado };
}

describe("service worker: ativação", () => {
  /** Quem já tinha o site instalado não baixa os sprites de novo. */
  it("leva o conteúdo dos caches de nome antigo para os novos e apaga os antigos", async () => {
    const sw = ambiente({
      "pokedex-runtime-v1": { "/sprites/pokemon/1.png": "bulbasaur", "/sprites/pokemon/4.png": "charmander" },
      "pokedex-api-v1": { "https://pokeapi.co/api/v2/move/33": "tackle" },
      "pokedex-build-velho": { "/assets/a.js": "velho" },
    });
    await sw.ativar();
    expect(sw.estado()).toEqual({
      "pokemu-api-v1": { "https://pokeapi.co/api/v2/move/33": "tackle" },
      "pokemu-runtime-v1": { "/sprites/pokemon/1.png": "bulbasaur", "/sprites/pokemon/4.png": "charmander" },
    });
  });

  it("o que já está no cache novo não é trocado pela cópia antiga", async () => {
    const sw = ambiente({
      "pokedex-runtime-v1": { "/sprites/pokemon/1.png": "antigo", "/sprites/pokemon/7.png": "squirtle" },
      "pokemu-runtime-v1": { "/sprites/pokemon/1.png": "novo" },
    });
    await sw.ativar();
    expect(sw.estado()["pokemu-runtime-v1"]).toEqual({ "/sprites/pokemon/1.png": "novo", "/sprites/pokemon/7.png": "squirtle" });
  });

  it("apaga o build anterior e mantém o atual e os dois caches permanentes", async () => {
    const sw = ambiente({
      "pokemu-build-anterior": { "/assets/a.js": "x" },
      "pokemu-build-teste": { "/assets/b.js": "y" },
      "pokemu-runtime-v1": { "/s.png": "s" },
      "pokemu-api-v1": {},
    });
    await sw.ativar();
    expect(Object.keys(sw.estado())).toEqual(["pokemu-api-v1", "pokemu-build-teste", "pokemu-runtime-v1"]);
  });

  it("não toca em cache de outro dono na mesma origem", async () => {
    const sw = ambiente({ "outro-app-v1": { "/x": "x" } });
    await sw.ativar();
    expect(sw.estado()).toEqual({ "outro-app-v1": { "/x": "x" } });
  });

  it("instalação limpa não cria cache vazio à toa", async () => {
    const sw = ambiente({});
    await sw.ativar();
    expect(sw.estado()).toEqual({});
  });
});
