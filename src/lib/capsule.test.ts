import { describe, expect, it } from "vitest";
import {
  applyRomData,
  capsuleFile,
  capsuleFileName,
  collectRomData,
  fromBase64,
  parseCapsule,
  planRestore,
  toBase64,
  type Capsule,
} from "./capsule";

async function capsula(extra: Partial<Capsule> = {}): Promise<Capsule> {
  return {
    app: "pokemu-capsule",
    version: 1,
    exportedAt: new Date(0).toISOString(),
    rom: { fileName: "Emerald.gba" },
    coreVersion: "mGBA 1",
    files: [
      await capsuleFile("save", ".sav", new Uint8Array([1, 2, 3])),
      await capsuleFile("state", ".ss1", new Uint8Array([4, 5])),
      await capsuleFile("thumbnail", ".ss1.png", new Uint8Array([6])),
      await capsuleFile("screenshot", "-20261012-101500.png", new Uint8Array([7])),
    ],
    data: { "pokedex:trainer-log": { rom: "Emerald.gba", playerName: "ZE" } },
    ...extra,
  };
}

describe("base64", () => {
  it("vai e volta, inclusive com bytes altos e arquivo grande", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 7) % 256);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe("parseCapsule", () => {
  it("aceita o que foi montado", async () => {
    const c = await capsula();
    const r = await parseCapsule(JSON.stringify(c));
    expect(r).toEqual({ ok: true, capsule: c });
  });

  /** Download truncado ou editado à mão: recusar antes de tocar no save bom. */
  it("recusa arquivo que não confere com o manifesto", async () => {
    const c = await capsula();
    c.files[0] = { ...c.files[0], base64: toBase64(new Uint8Array([9, 9, 9])) };
    expect(await parseCapsule(JSON.stringify(c))).toEqual({ ok: false, reason: "corrupt" });
  });

  it("recusa tamanho declarado diferente do real", async () => {
    const c = await capsula();
    c.files[0] = { ...c.files[0], size: 99 };
    expect(await parseCapsule(JSON.stringify(c))).toEqual({ ok: false, reason: "corrupt" });
  });

  it("recusa sufixo que o core não produz: nada fora do padrão é escrito", async () => {
    const c = await capsula();
    c.files[0] = { ...c.files[0], suffix: "/../../etc.sav" };
    expect(await parseCapsule(JSON.stringify(c))).toEqual({ ok: false, reason: "format" });
  });

  it("recusa nome de ROM com caminho", async () => {
    const c = await capsula({ rom: { fileName: "../Emerald.gba" } });
    expect(await parseCapsule(JSON.stringify(c))).toEqual({ ok: false, reason: "format" });
  });

  it("distingue versão futura de arquivo qualquer", async () => {
    expect(await parseCapsule(JSON.stringify({ ...(await capsula()), version: 2 }))).toEqual({ ok: false, reason: "version" });
    expect(await parseCapsule("não é json")).toEqual({ ok: false, reason: "format" });
    expect(await parseCapsule(JSON.stringify({ app: "pokedex" }))).toEqual({ ok: false, reason: "format" });
  });
});

describe("planRestore", () => {
  it("mesmo core: tudo volta, e marca o que substitui", async () => {
    const plano = planRestore(await capsula(), new Set([".sav"]), "mGBA 1");
    expect(plano.map((s) => [s.file.suffix, s.action, s.overwrites])).toEqual([
      [".sav", "write", true],
      [".ss1", "write", false],
      [".ss1.png", "write", false],
      ["-20261012-101500.png", "write", false],
    ]);
  });

  /** Estado é memória crua do emulador; o save é o formato do cartucho. */
  it("outro core: save e capturas voltam, pontos de retorno ficam de fora", async () => {
    const plano = planRestore(await capsula(), new Set([".ss1"]), "mGBA 2");
    expect(plano.map((s) => [s.file.kind, s.action, s.overwrites])).toEqual([
      ["save", "write", false],
      ["state", "skip-core", false],
      ["thumbnail", "skip-core", false],
      ["screenshot", "write", false],
    ]);
  });
});

function storage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("dados da ROM", () => {
  const inicial = {
    "pokedex:personal-adventures": JSON.stringify([{ rom: "a.gba", favorite: true }, { rom: "b.gba", favorite: false }]),
    "pokedex:trainer-log": JSON.stringify({ "a.gba": { rom: "a.gba", n: 1 }, "b.gba": { rom: "b.gba", n: 2 } }),
  };

  it("coleta só a entrada da ROM", () => {
    expect(collectRomData(storage(inicial), "a.gba")).toEqual({
      "pokedex:personal-adventures": { rom: "a.gba", favorite: true },
      "pokedex:trainer-log": { rom: "a.gba", n: 1 },
    });
  });

  it("aplica sob o nome daqui sem tocar nas outras aventuras", () => {
    const s = storage(inicial);
    applyRomData(s, "local.gba", {
      "pokedex:personal-adventures": { rom: "a.gba", favorite: true },
      "pokedex:trainer-log": { rom: "a.gba", n: 9 },
    });
    expect(JSON.parse(s.data["pokedex:personal-adventures"])).toEqual([
      { rom: "a.gba", favorite: true },
      { rom: "b.gba", favorite: false },
      { rom: "local.gba", favorite: true },
    ]);
    expect(JSON.parse(s.data["pokedex:trainer-log"])["local.gba"]).toEqual({ rom: "local.gba", n: 9 });
    expect(JSON.parse(s.data["pokedex:trainer-log"])["b.gba"]).toEqual({ rom: "b.gba", n: 2 });
  });

  it("falha no meio desfaz o que já tinha gravado", () => {
    const s = storage(inicial);
    let gravacoes = 0;
    const falha = {
      getItem: s.getItem,
      setItem: (k: string, v: string) => {
        if (++gravacoes === 2) throw new Error("cota");
        s.setItem(k, v);
      },
    };
    expect(() =>
      applyRomData(falha, "a.gba", {
        "pokedex:personal-adventures": { rom: "a.gba", favorite: false },
        "pokedex:trainer-log": { rom: "a.gba", n: 9 },
      })
    ).toThrow("cota");
    expect(s.data).toEqual(inicial);
  });
});

describe("capsuleFileName", () => {
  it("nome do jogo e a data", () => {
    expect(capsuleFileName("Emerald.gba", new Date(2026, 9, 12))).toBe("Emerald - 2026-10-12.pokemu.json");
  });
});
