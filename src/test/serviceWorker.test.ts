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

/**
 * Um escopo mais completo, com \`fetch\`, \`install\` e pré-cache: para os
 * casos de cache cheio e atualização parcial (AUD-12).
 */
function escopo(opts: {
  inicial?: Record<string, Record<string, string>>;
  precache?: string[];
  /** URLs que a rede não entrega na instalação. */
  semRede?: string[];
  /** \`put\` rejeita, como com a cota cheia. */
  cacheCheio?: boolean;
  rede?: (url: string) => Promise<{ ok: boolean; status: number; type: string; body: string; clone(): unknown }>;
}) {
  const store = new Map<string, Entradas>(
    Object.entries(opts.inicial ?? {}).map(([nome, entradas]) => [nome, new Map(Object.entries(entradas))])
  );
  const chave = (r: unknown) => (typeof r === "string" ? r : (r as { url: string }).url).replace("https://pokemu.test", "");
  const resposta = (body: string) => ({ ok: true, status: 200, type: "basic", body, clone() { return this; } });
  const cache = (entradas: Entradas) => ({
    keys: async () => [...entradas.keys()].map((url) => ({ url })),
    match: async (r: unknown) => (entradas.has(chave(r)) ? resposta(entradas.get(chave(r))!) : undefined),
    put: async (r: unknown, resp: { body: string }) => {
      if (opts.cacheCheio) throw new DOMException("cota", "QuotaExceededError");
      entradas.set(chave(r), resp.body);
    },
    add: async (url: string) => {
      if (opts.semRede?.includes(url)) throw new TypeError("falha de rede");
      entradas.set(url, `conteúdo de ${url}`);
    },
    delete: async (r: unknown) => entradas.delete(chave(r)),
  });
  const caches = {
    keys: async () => [...store.keys()],
    has: async (nome: string) => store.has(nome),
    open: async (nome: string) => {
      if (!store.has(nome)) store.set(nome, new Map());
      return cache(store.get(nome)!);
    },
    delete: async (nome: string) => store.delete(nome),
    match: async (r: unknown) => {
      for (const e of store.values()) if (e.has(chave(r))) return resposta(e.get(chave(r))!);
      return undefined;
    },
  };
  type Evento = { waitUntil(p: Promise<unknown>): void; respondWith?(p: Promise<unknown>): void; request?: unknown };
  const handlers: Record<string, (e: Evento) => void> = {};
  const self = {
    addEventListener: (tipo: string, fn: (e: Evento) => void) => void (handlers[tipo] = fn),
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    location: { origin: "https://pokemu.test" },
  };
  const fetch = (r: unknown) => (opts.rede ?? (async (u: string) => resposta(`rede ${u}`)))(chave(r));
  const fonte = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8")
    .replace('"__SW_VERSION__"', '"novo"')
    .replace("/*__SW_PRECACHE__*/ []", JSON.stringify(opts.precache ?? []));
  new Function("self", "caches", "fetch", "Response", fonte)(self, caches, fetch, { error: () => ({ ok: false, status: 0, body: "erro" }) });

  const disparar = async (tipo: string, extra: Partial<Evento> = {}) => {
    let espera: Promise<unknown> = Promise.resolve();
    let resposta: Promise<unknown> | undefined;
    handlers[tipo]({ waitUntil: (p) => void (espera = p), respondWith: (p) => void (resposta = p), ...extra });
    await espera;
    return resposta;
  };
  const pedir = (url: string, mode = "cors") =>
    disparar("fetch", { request: { url: `https://pokemu.test${url}`, method: "GET", mode } }) as Promise<{ status: number; body: string }>;
  const estado = () => Object.fromEntries([...store].sort().map(([nome, e]) => [nome, Object.fromEntries(e)]));
  return { disparar, pedir, estado };
}

describe("service worker: cache cheio e atualização parcial (AUD-12)", () => {
  it("rede 200 com o cache cheio entrega a resposta", async () => {
    const sw = escopo({ cacheCheio: true });
    const r = await sw.pedir("/sprites/pokemon/25.png");
    expect(r.status).toBe(200);
    expect(r.body).toBe("rede /sprites/pokemon/25.png");
  });

  it("sem rede, usa o que está no cache", async () => {
    const sw = escopo({
      inicial: { "pokemu-runtime-v1": { "/sprites/pokemon/25.png": "pikachu" } },
      rede: async () => {
        throw new TypeError("offline");
      },
    });
    expect((await sw.pedir("/sprites/pokemon/25.png")).body).toBe("pikachu");
  });

  it("instalação sem o shell falha, e o build anterior continua", async () => {
    const sw = escopo({
      inicial: { "pokemu-build-velho": { "/index.html": "shell velho" } },
      precache: ["/index.html", "/assets/a.js"],
      semRede: ["/index.html"],
    });
    await expect(sw.disparar("install")).rejects.toThrow("shell");
    await sw.disparar("activate");
    expect(sw.estado()["pokemu-build-velho"]).toEqual({ "/index.html": "shell velho" });
  });

  it("navegação offline acha o shell de um build anterior quando o atual não tem", async () => {
    const sw = escopo({
      inicial: { "pokemu-build-velho": { "/index.html": "shell velho" } },
      precache: ["/index.html"],
      rede: async () => {
        throw new TypeError("offline");
      },
    });
    expect((await sw.pedir("/treinador", "navigate")).body).toBe("shell velho");
  });

  it("atualização completa troca o build e apaga o anterior", async () => {
    const sw = escopo({ inicial: { "pokemu-build-velho": { "/index.html": "velho" } }, precache: ["/index.html"] });
    await sw.disparar("install");
    await sw.disparar("activate");
    expect(Object.keys(sw.estado())).toEqual(["pokemu-build-novo"]);
  });
});
