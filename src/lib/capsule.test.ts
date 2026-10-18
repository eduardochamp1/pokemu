import { describe, expect, it } from "vitest";
import {
  applyRomData,
  capsuleFile,
  CapsuleIncompleteError,
  capsuleFileName,
  collectRomData,
  fromBase64,
  parseCapsule,
  planRestore,
  RollbackError,
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

describe("tipo derivado do sufixo (AUD-04)", () => {
  const SUFIXOS = { save: ".sav", state: ".ss1", thumbnail: ".ss1.png", screenshot: "-20261012-101500.png" } as const;
  const tipos = Object.keys(SUFIXOS) as (keyof typeof SUFIXOS)[];
  for (const kind of tipos) {
    for (const suffixDe of tipos) {
      if (kind === suffixDe) continue;
      it(`recusa kind ${kind} com sufixo de ${suffixDe}`, async () => {
        const c = await capsula({ files: [await capsuleFile(kind, SUFIXOS[suffixDe], new Uint8Array([9]))] });
        expect(await parseCapsule(JSON.stringify(c))).toEqual({ ok: false, reason: "format" });
      });
    }
  }

  it("estado de outro core não passa como save de bateria", async () => {
    const forjado = await capsula({ files: [await capsuleFile("save", ".ss1", new Uint8Array([9]))] });
    // Mesmo que chegue ao planejador, o tipo vem do sufixo.
    expect(planRestore(forjado, new Set(), "outro core")[0].action).toBe("skip-core");
  });

  it("cada tipo com o sufixo certo continua aceito", async () => {
    const c = await capsula({
      files: await Promise.all(tipos.map((k) => capsuleFile(k, SUFIXOS[k], new Uint8Array([1])))),
    });
    expect((await parseCapsule(JSON.stringify(c))).ok).toBe(true);
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
    removeItem: (k: string) => {
      delete data[k];
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
      ...s,
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

describe("rollback dos dados da ROM (AUD-02)", () => {
  const CHAVES = ["pokedex:personal-adventures", "pokedex:trainer-log", "pokedex:challenges"] as const;
  const dados = {
    "pokedex:personal-adventures": { title: "nova" },
    "pokedex:trainer-log": { n: 1 },
    "pokedex:challenges": { rules: [] },
  };
  const outra = {
    "pokedex:personal-adventures": JSON.stringify([{ rom: "b.gba" }]),
    "pokedex:trainer-log": JSON.stringify({ "b.gba": { rom: "b.gba" } }),
    "pokedex:challenges": JSON.stringify({ "b.gba": { rom: "b.gba" } }),
  };

  // Cada chave ausente ou presente, com a falha em cada uma das gravações.
  for (let mascara = 0; mascara < 8; mascara++) {
    for (let falhaEm = 1; falhaEm <= 3; falhaEm++) {
      const presentes = CHAVES.filter((_, i) => mascara & (1 << i));
      it(`presentes [${presentes.join(", ") || "nenhuma"}], falha na gravação ${falhaEm}: volta ao inicial`, () => {
        const inicial = Object.fromEntries(presentes.map((k) => [k, outra[k]]));
        const s = storage(inicial);
        let n = 0;
        const falha = {
          ...s,
          setItem: (k: string, v: string) => {
            if (++n === falhaEm) throw new Error("cota");
            s.setItem(k, v);
          },
        };
        expect(() => applyRomData(falha, "a.gba", dados)).toThrow("cota");
        expect(s.data).toEqual(inicial);
      });
    }
  }

  it("chave que não existia é removida, não deixada com a entrada nova", () => {
    const s = storage();
    const falha = {
      ...s,
      setItem: (k: string, v: string) => {
        if (k === "pokedex:legacy-adventures") throw new Error("cota");
        s.setItem(k, v);
      },
    };
    expect(() =>
      applyRomData(falha, "demo.gba", {
        "pokedex:personal-adventures": { title: "nova" },
        "pokedex:legacy-adventures": { title: "nova" },
      })
    ).toThrow("cota");
    expect("pokedex:personal-adventures" in s.data).toBe(false);
  });

  it("se desfazer também falha, diz quais chaves ficaram", () => {
    const s = storage();
    const falha = {
      ...s,
      setItem: (k: string, v: string) => {
        if (k === "pokedex:trainer-log") throw new Error("cota");
        s.setItem(k, v);
      },
      removeItem: () => {
        throw new Error("travado");
      },
    };
    let erro: unknown;
    try {
      applyRomData(falha, "a.gba", dados);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(RollbackError);
    expect((erro as RollbackError).failed).toEqual(["pokedex:personal-adventures"]);
    expect(((erro as RollbackError).cause as Error).message).toBe("cota");
  });

  it("registro existente ilegível recusa antes de gravar e não apaga as outras aventuras", () => {
    const inicial = { "pokedex:personal-adventures": JSON.stringify([{ rom: "b.gba" }]), "pokedex:trainer-log": "{quebrado" };
    const s = storage(inicial);
    expect(() => applyRomData(s, "a.gba", dados)).toThrow("registro ilegível");
    expect(s.data).toEqual(inicial);
  });
});

describe("collectRomData com registro quebrado (AUD-05)", () => {
  it("reporta o registro em vez de sumir com ele", () => {
    const problemas: string[] = [];
    const s = storage({
      "pokedex:trainer-log": "{quebrado",
      "pokedex:challenges": JSON.stringify([1]),
      "pokedex:sessions": JSON.stringify({ "a.gba": { rom: "a.gba" } }),
    });
    expect(collectRomData(s, "a.gba", problemas)).toEqual({ "pokedex:sessions": { rom: "a.gba" } });
    expect(problemas.sort()).toEqual(["pokedex:challenges", "pokedex:trainer-log"]);
  });

  it("o erro de incompleta leva os itens", () => {
    const e = new CapsuleIncompleteError([".sav", "guide"]);
    expect(e.items).toEqual([".sav", "guide"]);
  });
});

describe("capsuleFileName", () => {
  it("nome do jogo e a data", () => {
    expect(capsuleFileName("Emerald.gba", new Date(2026, 9, 12))).toBe("Emerald - 2026-10-12.pokemu.json");
  });
});
