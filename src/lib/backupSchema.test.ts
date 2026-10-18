import { describe, expect, it } from "vitest";
import { BackupImportError, importBackup, readBackup, type Backup } from "./backup";
import { isTrainerEntry } from "./trainerLog";

const ficha = () => ({
  rom: "Emerald.gba",
  updatedAt: 1,
  playerName: "MAY",
  trainer: { gender: "female", trainerId: 1, secretId: 2, playTime: { hours: 1, minutes: 2, seconds: 3 }, money: 100, badges: [true], visitedTowns: [0], location: null },
  party: [{ personality: 1, national: 25, nickname: "PIKA", level: 10 }],
  boxes: [],
  owned: [25],
  seen: [25],
  last: { at: 1, playSeconds: 3723, owned: [25], seenCount: 1, badges: [true], towns: [0], party: [] },
  events: [{ kind: "start", at: 1, playSeconds: 0, owned: 1, seen: 1 }],
});

const backup = (data: Record<string, string>, extra: Partial<Backup> = {}) =>
  JSON.stringify({ app: "pokedex", version: 1, exportedAt: "2026-10-12T00:00:00Z", data, ...extra });

describe("conferência profunda do backup (AUD-13)", () => {
  it("ficha completa passa; ficha sem tempo de jogo, não", () => {
    expect(isTrainerEntry(ficha())).toBe(true);
    const sem = ficha() as Record<string, unknown>;
    sem.trainer = { ...ficha().trainer, playTime: undefined };
    expect(isTrainerEntry(sem)).toBe(false);
  });

  it("aceita backup com registros válidos e preferências sem esquema", () => {
    const r = readBackup(backup({ "pokedex:trainer-log": JSON.stringify({ "Emerald.gba": ficha() }), "pokedex:lang": "pt" }));
    expect(r.ok).toBe(true);
  });

  it("trainer incompleto é recusado, dizendo qual", () => {
    const ruim = { ...ficha(), trainer: { gender: "male" } };
    const r = readBackup(backup({ "pokedex:trainer-log": JSON.stringify({ "Emerald.gba": ruim }) }));
    expect(r).toEqual({ ok: false, reason: "invalid", problems: ["pokedex:trainer-log: Emerald.gba"] });
  });

  it("entrada sob o nome de outra ROM, tipo errado e JSON quebrado são recusados", () => {
    const r = readBackup(
      backup({
        "pokedex:trainer-log": JSON.stringify({ "Outro.gba": ficha() }),
        "pokedex:challenges": JSON.stringify([]),
        "pokedex:map-marks": "{quebrado",
      })
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason === "invalid" && r.problems.sort()).toEqual([
      "pokedex:challenges: formato",
      "pokedex:map-marks: formato",
      "pokedex:trainer-log: Outro.gba",
    ]);
  });

  it("coleção grande demais é recusada", () => {
    const muitas = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`r${i}.gba`, { current: 1 }]));
    const r = readBackup(backup({ "pokedex:sessions": JSON.stringify(muitas) }));
    expect(!r.ok && r.reason === "invalid" && r.problems).toEqual(["pokedex:sessions: entradas demais"]);
  });

  it("versão futura tem motivo próprio", () => {
    expect(readBackup(JSON.stringify({ app: "pokedex", version: 2, exportedAt: "2026-10-12T00:00:00Z", data: {} }))).toEqual({
      ok: false,
      reason: "version",
    });
  });
});

function armazenamento(inicial: Record<string, string>) {
  const m = new Map(Object.entries(inicial));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

describe("importação como operação só", () => {
  const novo: Backup = { app: "pokedex", version: 1, exportedAt: "", data: { "pokedex:lang": "en" }, guides: { "Red.gb": "novo" } };

  it("guia que não cabe devolve os registros anteriores", async () => {
    const s = armazenamento({ "pokedex:lang": "pt", outra: "x" });
    const guias = { "Red.gb": "antigo" };
    const erro = await importBackup(s, novo, {
      all: async () => guias,
      replaceAll: async () => {
        throw new Error("quota");
      },
    }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(BackupImportError);
    expect(erro).toMatchObject({ stage: "guides", reverted: true });
    expect(s.dump()).toEqual({ "pokedex:lang": "pt", outra: "x" });
    expect(guias).toEqual({ "Red.gb": "antigo" });
  });

  it("com tudo certo, troca registros e guias", async () => {
    const s = armazenamento({ "pokedex:lang": "pt" });
    let guias: Record<string, string> = { "Red.gb": "antigo" };
    await importBackup(s, novo, {
      all: async () => guias,
      replaceAll: async (g) => {
        guias = g;
      },
    });
    expect(s.dump()).toEqual({ "pokedex:lang": "en" });
    expect(guias).toEqual({ "Red.gb": "novo" });
  });

  it("banco de guias inacessível: recusa antes de mudar qualquer coisa", async () => {
    const s = armazenamento({ "pokedex:lang": "pt" });
    const erro = await importBackup(s, novo, {
      all: async () => {
        throw new Error("bloqueado");
      },
      replaceAll: async () => {},
    }).catch((e: unknown) => e);
    expect(erro).toMatchObject({ stage: "prepare", reverted: true });
    expect(s.dump()).toEqual({ "pokedex:lang": "pt" });
  });
});
