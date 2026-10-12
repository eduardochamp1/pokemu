import { describe, expect, it } from "vitest";
import {
  ROM_IDENTITY_KEY,
  adventureIdOf,
  loadRegistry,
  registerRom,
  renameRomData,
  resolveIdentity,
  sha256Hex,
  type RomRegistry,
  type StorageLike,
} from "./romIdentity";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

/** IDs previsíveis: id-1, id-2… */
function contador() {
  let n = 0;
  return () => `id-${++n}`;
}

describe("sha256Hex", () => {
  it("bate com o vetor conhecido de 'abc'", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("resolveIdentity", () => {
  const base: RomRegistry = {
    "Emerald.gba": { hash: HASH_A, adventureId: "id-emerald", size: 100, firstSeen: 1 },
  };

  it("arquivo novo ganha uma aventura nova", () => {
    const r = resolveIdentity({}, "Emerald.gba", HASH_A, 100, new Set(), contador(), 5);
    expect(r.identity).toEqual({ hash: HASH_A, adventureId: "id-1", size: 100, firstSeen: 5 });
    expect(r.renamedFrom).toBeUndefined();
  });

  it("arquivo já conhecido não muda nada", () => {
    const r = resolveIdentity(base, "Emerald.gba", HASH_A, 100, new Set(["Emerald.gba"]), contador(), 9);
    expect(r.registry).toBe(base);
    expect(r.identity.adventureId).toBe("id-emerald");
  });

  it("mesmo conteúdo com nome novo e o antigo sumido é renomeação", () => {
    const r = resolveIdentity(base, "Pokemon Emerald.gba", HASH_A, 100, new Set(["Pokemon Emerald.gba"]), contador(), 9);
    expect(r.renamedFrom).toBe("Emerald.gba");
    expect(r.identity.adventureId).toBe("id-emerald");
    expect(Object.keys(r.registry)).toEqual(["Pokemon Emerald.gba"]);
  });

  /** Duas cópias do mesmo jogo são duas aventuras: nunca fundir pelo hash. */
  it("mesmo conteúdo com o antigo ainda presente é cópia, não renomeação", () => {
    const presentes = new Set(["Emerald.gba", "Emerald (2).gba"]);
    const r = resolveIdentity(base, "Emerald (2).gba", HASH_A, 100, presentes, contador(), 9);
    expect(r.renamedFrom).toBeUndefined();
    expect(r.identity.adventureId).toBe("id-1");
    expect(r.registry["Emerald.gba"].adventureId).toBe("id-emerald");
  });

  it("com dois candidatos sumidos não adivinha: começa do zero", () => {
    const dois: RomRegistry = {
      "a.gba": { hash: HASH_A, adventureId: "id-a", size: 100, firstSeen: 1 },
      "b.gba": { hash: HASH_A, adventureId: "id-b", size: 100, firstSeen: 2 },
    };
    const r = resolveIdentity(dois, "c.gba", HASH_A, 100, new Set(["c.gba"]), contador(), 9);
    expect(r.renamedFrom).toBeUndefined();
    expect(r.identity.adventureId).toBe("id-1");
    expect(Object.keys(r.registry).sort()).toEqual(["a.gba", "b.gba", "c.gba"]);
  });

  it("conteúdo trocado sob o mesmo nome mantém a aventura", () => {
    const r = resolveIdentity(base, "Emerald.gba", HASH_B, 200, new Set(["Emerald.gba"]), contador(), 9);
    expect(r.identity).toEqual({ hash: HASH_B, adventureId: "id-emerald", size: 200, firstSeen: 1 });
  });
});

describe("renameRomData", () => {
  it("leva os dados dos quatro registros para o nome novo", () => {
    const s = fakeStorage({
      "pokedex:personal-adventures": JSON.stringify([{ rom: "a.gba", favorite: true }, { rom: "x.gba", favorite: false }]),
      "pokedex:legacy-adventures": JSON.stringify([{ rom: "a.gba", updatedAt: 1 }]),
      "pokedex:trainer-log": JSON.stringify({ "a.gba": { rom: "a.gba", playerName: "ZE" } }),
      "pokedex:player-dex": JSON.stringify({ "a.gba": { rom: "a.gba", seen: [1] }, "x.gba": { rom: "x.gba", seen: [] } }),
    });
    expect(renameRomData(s, "a.gba", "b.gba").sort()).toEqual([
      "pokedex:legacy-adventures",
      "pokedex:personal-adventures",
      "pokedex:player-dex",
      "pokedex:trainer-log",
    ]);
    expect(JSON.parse(s.data["pokedex:personal-adventures"])).toEqual([
      { rom: "b.gba", favorite: true },
      { rom: "x.gba", favorite: false },
    ]);
    expect(JSON.parse(s.data["pokedex:trainer-log"])).toEqual({ "b.gba": { rom: "b.gba", playerName: "ZE" } });
    expect(Object.keys(JSON.parse(s.data["pokedex:player-dex"])).sort()).toEqual(["b.gba", "x.gba"]);
  });

  it("não sobrescreve o que o nome novo já tem", () => {
    const antes = JSON.stringify({ "a.gba": { rom: "a.gba", n: 1 }, "b.gba": { rom: "b.gba", n: 2 } });
    const s = fakeStorage({ "pokedex:trainer-log": antes });
    expect(renameRomData(s, "a.gba", "b.gba")).toEqual([]);
    expect(s.data["pokedex:trainer-log"]).toBe(antes);
  });

  it("registro ausente ou quebrado é pulado sem lançar", () => {
    const s = fakeStorage({ "pokedex:trainer-log": "{quebrado" });
    expect(renameRomData(s, "a.gba", "b.gba")).toEqual([]);
  });
});

describe("registerRom", () => {
  it("renomear a ROM leva o diário junto e mantém o ID da aventura", () => {
    const s = fakeStorage({
      "pokedex:personal-adventures": JSON.stringify([{ rom: "Emerald.gba", notes: ["oi"] }]),
    });
    const ids = contador();
    registerRom(s, "Emerald.gba", HASH_A, 100, new Set(["Emerald.gba"]), "folder", ids, 1);
    const r = registerRom(s, "Esmeralda.gba", HASH_A, 100, new Set(["Esmeralda.gba"]), "folder", ids, 2);

    expect(r.renamedFrom).toBe("Emerald.gba");
    expect(r.migrated).toEqual(["pokedex:personal-adventures"]);
    expect(JSON.parse(s.data["pokedex:personal-adventures"])[0].rom).toBe("Esmeralda.gba");
    expect(adventureIdOf(s, "Esmeralda.gba")).toBe("id-1");
    expect(adventureIdOf(s, "Emerald.gba")).toBeUndefined();
  });

  it("registrar de novo o mesmo arquivo não regrava o índice", () => {
    const s = fakeStorage();
    registerRom(s, "a.gba", HASH_A, 100, new Set(["a.gba"]), "upload", contador(), 1);
    const gravado = s.data[ROM_IDENTITY_KEY];
    let gravacoes = 0;
    const espia: StorageLike = { getItem: s.getItem, setItem: (k, v) => { gravacoes++; s.setItem(k, v); } };
    registerRom(espia, "a.gba", HASH_A, 100, new Set(["a.gba"]), "upload", contador(), 2);
    expect(gravacoes).toBe(0);
    expect(s.data[ROM_IDENTITY_KEY]).toBe(gravado);
  });
});

describe("loadRegistry", () => {
  it("descarta entrada com forma errada e mantém as boas", () => {
    const s = fakeStorage({
      [ROM_IDENTITY_KEY]: JSON.stringify({
        "ok.gba": { hash: HASH_A, adventureId: "x", size: 1, firstSeen: 1 },
        "ruim.gba": { hash: "curto", adventureId: "y", size: 1, firstSeen: 1 },
      }),
    });
    expect(Object.keys(loadRegistry(s))).toEqual(["ok.gba"]);
  });

  it("JSON quebrado vira índice vazio", () => {
    expect(loadRegistry(fakeStorage({ [ROM_IDENTITY_KEY]: "{" }))).toEqual({});
  });
});
