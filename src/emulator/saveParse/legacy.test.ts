import { describe, expect, it } from "vitest";
import { KOREAN_NAME, gen1BoxLevel, parseGen1Save, parseGen2Save, parseLegacySave, readGbText } from "./legacy";
import { gen2VariantFixture, legacyFixture } from "./legacy.fixture";
import type { RomId } from "../romId";
import { GEN1_SPECIES } from "./gen1Species";
import type { LegacyGame } from "../romId";

describe("Gen 1 and Gen 2 cartridge readers", () => {
  for (const game of ["red", "green", "blue", "yellow", "gold", "silver", "crystal"] as const) {
    const kind = game === "blue" || game === "yellow" ? "red" : game === "silver" ? "gold" : game;
    const read = (b: Uint8Array) => game === "gold" || game === "silver" || game === "crystal" ? parseGen2Save(b, game) : parseGen1Save(b, game, game === "green");
    it(`${game}: trainer, endian, money, party, dex, DVs and PP Up`, () => {
      const f = legacyFixture(kind), save = read(f.bytes)!;
      expect(save).not.toBeNull();
      expect(save.game).toBe(game);
      expect(save.playerName).toBe(game === "green" ? "ヒョキ" : "ASH");
      expect(save.trainer.trainerId).toBe(12345);
      expect(save.trainer.money).toBe(123456);
      expect(save.trainer.playTime).toEqual({ hours: save.generation === 1 ? 12 : 300, minutes: 34, seconds: 56 });
      expect(save.trainer.badges.filter(Boolean)).toHaveLength(save.generation === 1 ? 2 : 3);
      expect(save.party[0]).toMatchObject({ national: save.generation === 1 ? 1 : 152, level: 5, experience: 135, trainerId: 12345, dvs: { hp: 0, atk: 2, def: 10, spe: 10, special: 10 }, statExperience: { hp: 65535 }, moves: [{ id: 33, pp: 5, ppUps: 3 }], stats: { hp: 19, maxHp: 20 } });
      expect(save.party[0].shiny).toBe(save.generation === 1 ? null : true);
      expect(save.party[0].friendship).toBe(save.generation === 1 ? null : 70);
      expect(save.party[0].stats).toMatchObject(save.generation === 1 ? { special: 13 } : { spa: 13, spd: 14 });
      expect(save.pokedex).toEqual({ seen: [save.party[0].national], owned: [save.party[0].national] });
    });
    it(`${game}: corrupt and truncated saves are rejected`, () => {
      const f = legacyFixture(kind);
      expect(read(f.bytes.subarray(0, 100))).toBeNull();
      f.bytes[f.offsets.party + 20] ^= 1;
      expect(read(f.bytes)).toBeNull();
      expect(read(new Uint8Array(0x8000))).toBeNull();
      expect(read(new Uint8Array(0x8000).fill(255))).toBeNull();
    });
    it(`${game}: rejects impossible party data even with a valid checksum`, () => {
      const f = legacyFixture(kind);
      f.bytes[f.offsets.party] = 7;
      f.checksum();
      expect(read(f.bytes)).toBeNull();
    });
  }
  for (const game of ["gold", "crystal"] as const) {
    it(`${game}: recovers the independently validated backup without modifying the input`, () => {
      const f = legacyFixture(game);
      f.backup();
      f.bytes[f.offsets.party] = 100;
      const before = f.bytes.slice();
      expect(parseGen2Save(f.bytes, game)).toMatchObject({ source: "backup", playerName: "ASH", party: [{ national: 152 }] });
      expect(f.bytes).toEqual(before);
      f.bytes[game === "crystal" ? 0x1209 : 0x15c7] ^= 1;
      expect(parseGen2Save(f.bytes, game)).toBeNull();
    });
  }
  it("Gen 2 eggs use the egg marker while preserving the real species", () => {
    const f = legacyFixture("gold");
    f.bytes[f.offsets.party + 1] = 253;
    f.checksum();
    expect(parseGen2Save(f.bytes, "gold")?.party[0]).toMatchObject({ national: 152, egg: true });
  });
  it("Gen 1 uses an internal species index with exactly 151 valid national species", () => {
    expect(new Set(GEN1_SPECIES.filter(n => n > 0)).size).toBe(151);
    expect(GEN1_SPECIES[0x54]).toBe(25);
    expect(GEN1_SPECIES[0x83]).toBe(150);
    expect(GEN1_SPECIES[0x15]).toBe(151);
    expect(GEN1_SPECIES[0x1f]).toBe(0);
  });
  it("reads a view with a non-zero byte offset and ignores the emulator trailer", () => {
    const f = legacyFixture("gold");
    const outer = new Uint8Array(0x8020);
    outer.set(f.bytes, 8);
    expect(parseGen2Save(outer.subarray(8), "gold")?.playerName).toBe("ASH");
  });
  it("requires the cartridge layout and refuses Japanese Gen 2 instead of guessing", () => {
    const bytes = legacyFixture("gold").bytes;
    expect(parseLegacySave(bytes, null)).toBeNull();
    expect(parseLegacySave(bytes, { legacyGame: "gold" as LegacyGame, language: "japanese" } as Parameters<typeof parseLegacySave>[1])).toBeNull();
  });
  it("rejects invalid BCD money, impossible time and dex inconsistency", () => {
    for (const field of ["money", "time", "seen"] as const) {
      const f = legacyFixture("red");
      if (field === "money") f.bytes[f.offsets.money] = 0xfa;
      if (field === "time") f.bytes[f.offsets.time + 2] = 60;
      if (field === "seen") f.bytes[f.offsets.seen] = 0;
      f.checksum();
      expect(parseGen1Save(f.bytes, "red")).toBeNull();
    }
  });
  it("decodes independent Japanese and English game character codes", () => {
    expect(readGbText(Uint8Array.from([0x80, 0x92, 0x87, 0x50, 0x99]), 0, 5)).toBe("ASH");
    expect(readGbText(Uint8Array.from([0x9a, 0xaf, 0x86, 0x50]), 0, 4, true)).toBe("ヒョキ");
  });
});

describe("nível na caixa de Gen 1", () => {
  /** Os mesmos pares que os saves reais de saves/ mostram no time. */
  it("sai da experiência pela curva da espécie", () => {
    expect(gen1BoxLevel(1, 135)).toBe(5); // Bulbasaur, medium-slow
    expect(gen1BoxLevel(25, 1000)).toBe(10); // Pikachu, medium-fast: 10³
    expect(gen1BoxLevel(25, 999)).toBe(9);
    expect(gen1BoxLevel(4, 0)).toBe(1);
  });

  it("não passa de 100 nem com experiência acima do teto", () => {
    expect(gen1BoxLevel(25, 16_000_000)).toBe(100);
  });

  it("todas as 151 têm curva: nenhuma fica sem nível", () => {
    for (let n = 1; n <= 151; n++) expect(gen1BoxLevel(n, 500), `#${n}`).not.toBeNull();
  });
});

describe("Gen 2 japonesa e coreana", () => {
  for (const game of ["gold", "crystal"] as const) {
    it(`japonesa (${game}): treinador, time, dex e as nove caixas de trinta`, () => {
      const f = gen2VariantFixture(game, "japanese");
      const save = parseGen2Save(f.bytes, game, "japanese")!;
      expect(save).not.toBeNull();
      expect(save.language).toBe("japanese");
      expect(save.playerName).toBe("ヒョキ");
      expect(save.trainer.trainerId).toBe(12345);
      expect(save.trainer.money).toBe(123456);
      expect(save.trainer.playTime).toEqual({ hours: 300, minutes: 34, seconds: 56 });
      expect(save.trainer.badges.filter(Boolean)).toHaveLength(3);
      expect(save.party[0]).toMatchObject({ national: 152, level: 5, experience: 135, nickname: "ヒョキ" });
      expect(save.pokedex).toEqual({ seen: [152], owned: [152] });
      expect(save.boxes.boxes).toHaveLength(9);
      expect(save.boxes.current).toBe(2);
      // A última caixa fica no segundo banco: se o tamanho da caixa estiver
      // errado, ela é lida do lugar errado e vem vazia ou inválida.
      expect(save.boxes.boxes[8].pokemon).toHaveLength(1);
      expect(save.boxes.boxes[8].pokemon![0]).toMatchObject({ national: 152, level: 5 });
      expect(save.boxes.boxes.slice(0, 8).every((box) => box.pokemon?.length === 0)).toBe(true);
    });

    it(`japonesa (${game}): recupera da cópia quando o bloco principal não fecha`, () => {
      const f = gen2VariantFixture(game, "japanese");
      f.backup();
      f.bytes[f.offsets.party + 20] ^= 1;
      const save = parseGen2Save(f.bytes, game, "japanese")!;
      expect(save).not.toBeNull();
      expect(save.source).toBe("backup");
      expect(save.party[0].national).toBe(152);
    });

    it(`japonesa (${game}): o layout internacional não lê este save`, () => {
      const f = gen2VariantFixture(game, "japanese");
      expect(parseGen2Save(f.bytes, game, "international")).toBeNull();
    });
  }

  it("coreana: lê os números, o time e as caixas, e deixa os nomes sem tradução", () => {
    const f = gen2VariantFixture("gold", "korean");
    const save = parseGen2Save(f.bytes, "gold", "korean")!;
    expect(save).not.toBeNull();
    expect(save.language).toBe("korean");
    expect(save.playerName).toBe(KOREAN_NAME);
    expect(save.trainer.money).toBe(123456);
    expect(save.party[0]).toMatchObject({ national: 152, level: 5, nickname: "", originalTrainer: "" });
    expect(save.boxes.boxes).toHaveLength(14);
    expect(save.boxes.boxes[13].pokemon).toHaveLength(1);
  });

  it("coreana: save corrompido é recusado, e não há Crystal coreana", () => {
    const f = gen2VariantFixture("gold", "korean");
    f.bytes[f.offsets.party + 20] ^= 1;
    expect(parseGen2Save(f.bytes, "gold", "korean")).toBeNull();
    expect(parseGen2Save(gen2VariantFixture("gold", "korean").bytes, "crystal", "korean")).toBeNull();
  });

  /** O cabeçalho da Gold coreana se apresenta como internacional. */
  it("pelo cartucho: internacional tenta o layout coreano quando o seu não fecha", () => {
    const rom = { legacyGame: "gold", language: "international" } as unknown as RomId;
    expect(parseLegacySave(gen2VariantFixture("gold", "korean").bytes, rom)?.language).toBe("korean");
    expect(parseLegacySave(legacyFixture("gold").bytes, rom)?.language).toBe("international");
    const jp = { legacyGame: "crystal", language: "japanese" } as unknown as RomId;
    expect(parseLegacySave(gen2VariantFixture("crystal", "japanese").bytes, jp)?.language).toBe("japanese");
  });
});
