import { describe, expect, it } from "vitest";
import { compareLegacy } from "./compareLegacy";
import type { LegacySave } from "../emulator/saveParse/legacy";

const save = (o: {
  generation?: 1 | 2;
  owned?: number[];
  seen?: number[];
  badges?: boolean[];
  levels?: (number | null)[];
  boxes?: (number | null)[];
  hours?: number;
  money?: number;
}): LegacySave =>
  ({
    generation: o.generation ?? 1,
    trainer: {
      badges: o.badges ?? Array(o.generation === 2 ? 16 : 8).fill(false),
      playTime: { hours: o.hours ?? 0, minutes: 0, seconds: 0 },
      money: o.money ?? 0,
    },
    pokedex: { owned: o.owned ?? [], seen: o.seen ?? o.owned ?? [] },
    party: (o.levels ?? []).map((level) => ({ level, egg: false })),
    boxes: { boxes: (o.boxes ?? []).map((n) => ({ name: "", pokemon: n === null ? null : Array(n).fill({}) })) },
  }) as unknown as LegacySave;

const linha = (c: ReturnType<typeof compareLegacy>, key: string) => c.rows.find((r) => r.key === key)!;

describe("compareLegacy", () => {
  it("diz quem está à frente em cada número", () => {
    const c = compareLegacy(
      save({ owned: [1, 4, 7], badges: [true, true, false, false, false, false, false, false], levels: [20, 12], hours: 5, money: 3000 }),
      save({ owned: [1], badges: [true, false, false, false, false, false, false, false], levels: [25], hours: 9, money: 3000 })
    );
    expect(linha(c, "owned")).toMatchObject({ a: 3, b: 1, ahead: "a" });
    expect(linha(c, "badges").ahead).toBe("a");
    expect(linha(c, "topLevel")).toMatchObject({ a: 20, b: 25, ahead: "b" });
    expect(linha(c, "time").ahead).toBe("b");
    expect(linha(c, "money").ahead).toBeNull();
  });

  it("a diferença de dex é o que só um lado capturou", () => {
    const c = compareLegacy(save({ owned: [1, 4, 25] }), save({ owned: [4, 7] }));
    expect(c.onlyA).toEqual([1, 25]);
    expect(c.onlyB).toEqual([7]);
    expect(c.both).toEqual([4]);
  });

  /** Oito de oito em Kanto não é "menos" que nove de dezesseis em Johto. */
  it("entre gerações, insígnias aparecem mas não dizem quem está à frente", () => {
    const c = compareLegacy(
      save({ generation: 1, badges: Array(8).fill(true) }),
      save({ generation: 2, badges: [...Array(9).fill(true), ...Array(7).fill(false)] })
    );
    expect(linha(c, "badges")).toEqual({ key: "badges", a: 8, b: 9, ahead: null });
  });

  it("caixa ilegível não vira zero, e time só de ovo não tem nível", () => {
    const c = compareLegacy(save({ boxes: [3, null] }), save({ boxes: [2, 2], levels: [null] }));
    expect(linha(c, "pc")).toMatchObject({ a: null, b: 4, ahead: null });
    expect(linha(c, "topLevel")).toMatchObject({ a: null, b: null });
  });
});
