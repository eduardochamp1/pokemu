import { describe, expect, it } from "vitest";
import { albumMoments, momentFileName, momentLabel, wrapText } from "./journeyAlbum";
import type { TrainerEntry } from "./trainerLog";

const nameOf = (n: number) => ({ 258: "Mudkip", 259: "Marshtomp" })[n] ?? `#${n}`;
const base = { playSeconds: 0 };

const entry = {
  rom: "Emerald.gba",
  game: "emerald",
  events: [
    { ...base, at: 10, kind: "start", owned: 1, seen: 3 },
    { ...base, at: 20, kind: "captured", national: 263 },
    { ...base, at: 30, kind: "badge", index: 0 },
    { ...base, at: 40, kind: "level", national: 258, nickname: "ZE", from: 15, to: 16 },
    { ...base, at: 40, kind: "evolved", nickname: "ZE", from: 258, to: 259 },
    { ...base, at: 50, kind: "achievement", id: "nao-existe" },
  ],
} as unknown as TrainerEntry;

describe("albumMoments", () => {
  const momentos = albumMoments(entry, nameOf, "pt");

  it("só os marcos entram: insígnia, evolução e conquista", () => {
    expect(momentos.map((m) => m.kind)).toEqual(["evolved", "badge"]);
  });

  it("do mais recente para o mais antigo", () => {
    expect(momentos.map((m) => m.at)).toEqual([40, 30]);
  });

  it("a insígnia traz o nome, o líder e a cidade", () => {
    expect(momentos[1]).toMatchObject({ title: "Stone Badge", subtitle: "Roxanne · Rustboro City" });
  });

  it("a evolução traz de quem para quem e a espécie nova para ilustrar", () => {
    expect(momentos[0]).toMatchObject({ title: "ZE evoluiu", subtitle: "Mudkip → Marshtomp", national: 259 });
    expect(albumMoments(entry, nameOf, "en")[0].title).toBe("ZE evolved");
  });

  /** Uma conquista que saiu do site não vira um cartão em branco. */
  it("conquista desconhecida é ignorada", () => {
    expect(momentos.some((m) => m.kind === "achievement")).toBe(false);
  });

  it("os ids não se repetem", () => {
    expect(new Set(momentos.map((m) => m.id)).size).toBe(momentos.length);
  });
});

describe("wrapText", () => {
  const medir = (s: string) => s.length * 10;

  it("quebra por palavra na largura", () => {
    expect(wrapText(medir, "um dois tres quatro", 80, 5)).toEqual(["um dois", "tres", "quatro"]);
  });

  it("corta no máximo de linhas com reticências", () => {
    const linhas = wrapText(medir, "um dois tres quatro cinco seis", 80, 2);
    expect(linhas).toHaveLength(2);
    expect(linhas[1].endsWith("…")).toBe(true);
  });

  it("palavra maior que a largura fica sozinha na linha em vez de sumir", () => {
    expect(wrapText(medir, "extraordinariamente ok", 80, 3)).toEqual(["extraordinariamente", "ok"]);
  });

  it("texto vazio não gera linha", () => {
    expect(wrapText(medir, "", 80, 3)).toEqual([]);
  });
});

describe("nomes", () => {
  it("rótulo por idioma", () => {
    expect(momentLabel("badge", "pt")).toBe("INSÍGNIA");
    expect(momentLabel("evolved", "en")).toBe("EVOLUTION");
  });

  it("nome de arquivo sem espaço nem acento", () => {
    const m = { id: "x", kind: "evolved" as const, title: "ZÉ evoluiu", subtitle: "", at: 0 };
    expect(momentFileName("Pokemon Emerald (USA).gba", m)).toBe("Pokemon-Emerald-USA-evolved-ze-evoluiu.png");
  });
});
