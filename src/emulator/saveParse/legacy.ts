/**
 * Leitores somente de leitura de saves GB/GBC. Layouts: PKHeX SAV1Offsets,
 * SAV2Offsets, PK1/PK2 e rotinas de save das decompilações pret.
 * Gen 1 japonês/internacional; Gen 2 Gold/Silver e Crystal internacionais.
 * Nunca adapta DVs/stat experience para IVs/EVs/naturezas de Gen 3.
 */
import type { LegacyGame, RomId } from "../romId";
import { GEN1_SPECIES } from "./gen1Species";

export interface LegacyMon {
  slot: number;
  national: number;
  nickname: string;
  originalTrainer: string;
  trainerId: number;
  level: number | null;
  experience: number;
  egg: boolean;
  shiny: boolean | null;
  friendship: number | null;
  heldItem: number | null;
  dvs: { hp: number; atk: number; def: number; spe: number; special: number };
  statExperience: { hp: number; atk: number; def: number; spe: number; special: number };
  moves: { id: number; pp: number; ppUps: number }[];
  stats: { hp: number; maxHp: number; atk: number; def: number; spe: number; special?: number; spa?: number; spd?: number } | null;
}
export interface LegacySave {
  generation: 1 | 2;
  game: LegacyGame;
  language: "japanese" | "international";
  source: "main" | "backup";
  playerName: string;
  trainer: { trainerId: number; gender: "male" | "female" | null; money: number; playTime: { hours: number; minutes: number; seconds: number }; badges: boolean[] };
  party: LegacyMon[];
  pokedex: { seen: number[]; owned: number[] };
  boxes: { current: number; boxes: { name: string; pokemon: LegacyMon[] | null }[] };
}

// Game character codes, not Unicode/ASCII. Japanese Green uses six-byte names.
const jpChars = new Map<number, string>();
for (const [start, text] of [
  [0x05, "ガギグゲゴザジズゼゾダヂヅデド"], [0x19, "バビブボ"],
  [0x26, "がぎぐげござじずぜぞだぢづでど"], [0x3a, "ばびぶベぼ"],
  [0x40, "パピプポぱぴぷペぽ"], [0x80, "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフホマミムメモヤユヨラルレロワヲンッャュョ"],
  [0xb0, "ィあいうえおかきくけこさしすせそたちつてとなにぬねのはひふヘほまみむめもやゆよらリるれろわをんっゃゅょー"],
] as const) Array.from(text).forEach((char, i) => jpChars.set(start + i, char));

export function readGbText(bytes: Uint8Array, offset: number, length: number, japanese = false): string {
  let text = "";
  for (const code of bytes.subarray(offset, offset + length)) {
    if (code === 0x50 || code === 0) break;
    if (japanese) {
      text += jpChars.get(code) ?? ({ 0x6e: "ぃ", 0x6f: "ぅ", 0x76: "ぁ", 0x77: "ぇ", 0x78: "ぉ", 0x7f: " ", 0xe4: "ﾟ", 0xe5: "ﾞ", 0xe8: "。", 0xe9: "ァ", 0xea: "ゥ", 0xeb: "ェ", 0xf4: "ォ", 0xef: "♂", 0xf5: "♀", 0xe6: "？", 0xe7: "！" }[code]) ?? (code >= 0xf6 ? String(code - 0xf6) : "�");
    } else if (code >= 0x80 && code <= 0x99) text += String.fromCharCode(65 + code - 0x80);
    else if (code >= 0xa0 && code <= 0xb9) text += String.fromCharCode(97 + code - 0xa0);
    else if (code >= 0xf6) text += String(code - 0xf6);
    else text += ({ 0x7f: " ", 0xba: "à", 0xbb: "è", 0xbc: "é", 0xbd: "ù", 0xdf: "'", 0xe0: "'", 0xe3: "-", 0xe6: "?", 0xe7: "!", 0xe8: ".", 0xef: "♂", 0xf2: ".", 0xf3: "/", 0xf4: ",", 0xf5: "♀" }[code]) ?? "�";
  }
  return text.trimEnd();
}
function u16(b: Uint8Array, o: number) { return b[o] * 256 + b[o + 1]; }
function u24(b: Uint8Array, o: number) { return b[o] * 65536 + u16(b, o + 1); }
function bits(b: Uint8Array, o: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => i + 1).filter(n => (b[o + ((n - 1) >> 3)] & (1 << ((n - 1) & 7))) !== 0);
}
function sum(b: Uint8Array, start: number, end: number) {
  let result = 0;
  for (let i = start; i < end; i++) result = (result + b[i]) & 0xffff;
  return result;
}
function money(b: Uint8Array, o: number, gen: 1 | 2): number | null {
  if (gen === 2) return u24(b, o) <= 999999 ? u24(b, o) : null;
  let value = 0;
  for (const byte of b.subarray(o, o + 3)) {
    if ((byte >> 4) > 9 || (byte & 15) > 9) return null;
    value = value * 100 + (byte >> 4) * 10 + (byte & 15);
  }
  return value;
}

function readList(b: Uint8Array, base: number, capacity: number, gen: 1 | 2, japanese: boolean, party: boolean): LegacyMon[] | null {
  const count = b[base];
  const length = japanese ? 6 : 11;
  const size = gen === 1 ? (party ? 44 : 33) : (party ? 48 : 32);
  if (count > capacity || b[base + 1 + count] !== 0xff || base + 2 + capacity * (1 + size + 2 * length) > b.length) return null;
  const records = base + capacity + 2;
  const trainers = records + capacity * size;
  const nicknames = trainers + capacity * length;
  const result: LegacyMon[] = [];
  for (let slot = 0; slot < count; slot++) {
    const o = records + slot * size;
    const species = b[o];
    const egg = gen === 2 && b[base + slot + 1] === 0xfd;
    if (!egg && b[base + slot + 1] !== species) return null;
    const national = gen === 1 ? GEN1_SPECIES[species] : species;
    if (!national || national > (gen === 1 ? 151 : 251)) return null;
    const dv = o + (gen === 1 ? 27 : 21);
    const atk = b[dv] >> 4, def = b[dv] & 15, spe = b[dv + 1] >> 4, special = b[dv + 1] & 15;
    const se = o + (gen === 1 ? 17 : 11);
    const move = o + (gen === 1 ? 8 : 2), pp = o + (gen === 1 ? 29 : 23);
    const moves: LegacyMon["moves"] = [];
    for (let i = 0; i < 4; i++) {
      if (b[move + i] > (gen === 1 ? 165 : 251)) return null;
      if (b[move + i]) moves.push({ id: b[move + i], pp: b[pp + i] & 63, ppUps: b[pp + i] >> 6 });
    }
    const level = gen === 1 ? (party ? b[o + 33] : null) : b[o + 31];
    if (level !== null && (level < 1 || level > 100)) return null;
    const hp = party ? u16(b, o + (gen === 1 ? 1 : 34)) : 0;
    const maxHp = party ? u16(b, o + (gen === 1 ? 34 : 36)) : 0;
    if (party && (!maxHp || maxHp > 999 || hp > maxHp)) return null;
    result.push({
      slot, national, egg, level, nickname: readGbText(b, nicknames + slot * length, length, japanese),
      originalTrainer: readGbText(b, trainers + slot * length, length, japanese), trainerId: u16(b, o + (gen === 1 ? 12 : 6)),
      experience: u24(b, o + (gen === 1 ? 14 : 8)), heldItem: gen === 2 ? b[o + 1] : null,
      friendship: gen === 2 ? b[o + 27] : null,
      shiny: gen === 2 ? def === 10 && spe === 10 && special === 10 && (atk & 2) !== 0 : null,
      dvs: { hp: ((atk & 1) << 3) | ((def & 1) << 2) | ((spe & 1) << 1) | (special & 1), atk, def, spe, special },
      statExperience: { hp: u16(b, se), atk: u16(b, se + 2), def: u16(b, se + 4), spe: u16(b, se + 6), special: u16(b, se + 8) },
      moves,
      stats: party ? { hp, maxHp, atk: u16(b, o + (gen === 1 ? 36 : 38)), def: u16(b, o + (gen === 1 ? 38 : 40)), spe: u16(b, o + (gen === 1 ? 40 : 42)),
        ...(gen === 1 ? { special: u16(b, o + 42) } : { spa: u16(b, o + 44), spd: u16(b, o + 46) }) } : null,
    });
  }
  return result;
}

export function parseGen1Save(bytes: Uint8Array, game: "red" | "green" | "blue" | "yellow", japanese = false): LegacySave | null {
  if (bytes.length < 0x8000 || (game === "green" && !japanese)) return null;
  const o = japanese
    ? { caught: 0x259e, seen: 0x25b1, money: 0x25ee, badges: 0x25f8, tid: 0x25fb, time: 0x2ca0, party: 0x2ed5, box: 0x302d, current: 0x2842, check: 0x3594 }
    : { caught: 0x25a3, seen: 0x25b6, money: 0x25f3, badges: 0x2602, tid: 0x2605, time: 0x2ced, party: 0x2f2c, box: 0x30c0, current: 0x284c, check: 0x3523 };
  if (((~sum(bytes, 0x2598, o.check)) & 255) !== bytes[o.check]) return null;
  const party = readList(bytes, o.party, 6, 1, japanese, true);
  const cash = money(bytes, o.money, 1);
  const playerName = readGbText(bytes, 0x2598, japanese ? 6 : 11, japanese);
  const minutes = bytes[o.time + 2], seconds = bytes[o.time + 3];
  if (!party || cash === null || !playerName || minutes > 59 || seconds > 59) return null;
  const current = bytes[o.current] & 0x7f, count = japanese ? 8 : 12, capacity = japanese ? 30 : 20;
  if (current >= count) return null;
  const initialized = (bytes[o.current] & 0x80) !== 0;
  const boxSize = capacity * (33 + 1 + (japanese ? 12 : 22)) + 2;
  const boxes = Array.from({ length: count }, (_, i) => ({ name: `BOX ${i + 1}`, pokemon: i === current
    ? readList(bytes, o.box, capacity, 1, japanese, false)
    : initialized ? readList(bytes, (i < count / 2 ? 0x4000 : 0x6000) + (i % (count / 2)) * boxSize, capacity, 1, japanese, false) : [] }));
  const owned = bits(bytes, o.caught, 151), seen = bits(bytes, o.seen, 151);
  if (owned.some(n => !seen.includes(n))) return null;
  return { generation: 1, game, source: "main", language: japanese ? "japanese" : "international", playerName, party, pokedex: { owned, seen }, boxes: { current, boxes },
    trainer: { trainerId: u16(bytes, o.tid), gender: "male", money: cash, playTime: { hours: bytes[o.time], minutes, seconds }, badges: Array.from({ length: 8 }, (_, i) => (bytes[o.badges] & (1 << i)) !== 0) } };
}

export function parseGen2Save(bytes: Uint8Array, game: "gold" | "silver" | "crystal"): LegacySave | null {
  if (bytes.length < 0x8000) return null;
  const crystal = game === "crystal";
  const o = crystal
    ? { time: 0x2052, money: 0x23dc, badges: 0x23e5, current: 0x2700, names: 0x2703, party: 0x2865, caught: 0x2a27, seen: 0x2a47, end: 0x2b83, check: 0x2d0d, backup: 0x1f0d }
    : { time: 0x2053, money: 0x23db, badges: 0x23e4, current: 0x2724, names: 0x2727, party: 0x288a, caught: 0x2a4c, seen: 0x2a6c, end: 0x2d69, check: 0x2d69, backup: 0x7e6d };
  let b = bytes, source: LegacySave["source"] = "main";
  const valid = (data: Uint8Array, check: number) => sum(data, 0x2009, o.end) === (bytes[check] | (bytes[check + 1] << 8));
  if (!valid(bytes, o.check)) {
    b = bytes.slice();
    const segments = crystal ? [[0x1209, 0x2009, 0xb7a]] : [[0x15c7, 0x2009, 0x226], [0x3d69, 0x222f, 0x1aa], [0x0c6b, 0x23d9, 0x47d], [0x7e39, 0x2856, 0x34], [0x10e8, 0x288a, 0x4df]];
    for (const [from, to, length] of segments) b.set(bytes.subarray(from, from + length), to);
    if (!valid(b, o.backup)) return null;
    source = "backup";
  }
  const playerName = readGbText(b, 0x200b, 11);
  const cash = money(b, o.money, 2), party = readList(b, o.party, 6, 2, false, true);
  const minutes = b[o.time + 2], seconds = b[o.time + 3], current = b[o.current];
  if (!playerName || cash === null || !party || minutes > 59 || seconds > 59 || current >= 14) return null;
  const owned = bits(b, o.caught, 251), seen = bits(b, o.seen, 251);
  if (owned.some(n => !seen.includes(n))) return null;
  const boxes = Array.from({ length: 14 }, (_, i) => ({ name: readGbText(b, o.names + i * 9, 9) || `BOX ${i + 1}`,
    pokemon: readList(b, (i < 7 ? 0x4000 : 0x6000) + (i % 7) * 0x450, 20, 2, false, false) }));
  return { generation: 2, game, source, language: "international", playerName, party, pokedex: { owned, seen }, boxes: { current, boxes },
    trainer: { trainerId: u16(b, 0x2009), gender: !crystal ? "male" : source === "backup" ? null : b[0x3e3d] === 0 ? "male" : b[0x3e3d] === 1 ? "female" : null,
      money: cash, playTime: { hours: u16(b, o.time), minutes, seconds }, badges: Array.from({ length: 16 }, (_, i) => (b[o.badges + (i >> 3)] & (1 << (i & 7))) !== 0) } };
}

/** Layout is selected from the cartridge, never guessed from save length. */
export function parseLegacySave(bytes: Uint8Array, rom: RomId | null): LegacySave | null {
  if (!rom?.legacyGame) return null;
  const game = rom.legacyGame;
  if (game === "gold" || game === "silver" || game === "crystal") {
    return rom.language === "international" ? parseGen2Save(bytes, game) : null;
  }
  return parseGen1Save(bytes, game, rom.language === "japanese");
}
