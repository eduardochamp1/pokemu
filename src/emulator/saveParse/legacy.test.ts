import { describe, expect, it } from "vitest";
import { parseGen1Save, parseGen2Save, parseLegacySave, readGbText } from "./legacy";
import { legacyFixture } from "./legacy.fixture";
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
