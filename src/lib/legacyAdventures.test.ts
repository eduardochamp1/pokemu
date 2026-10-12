// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { adventureEvents, isLegacyAdventure, recordLegacyAdventure, reloadLegacyAdventures } from "./legacyAdventures";
import { parseGen2Save } from "../emulator/saveParse/legacy";
import { legacyFixture } from "../emulator/saveParse/legacy.fixture";
import { collectBackup } from "./backup";
const save = () => parseGen2Save(legacyFixture("gold").bytes, "gold")!;
beforeEach(() => { localStorage.clear(); reloadLegacyAdventures(); });
it("records captures and Johto/Kanto badges, without inventing evolution identities", () => {
  const prev = save(), next = structuredClone(prev);
  next.pokedex.owned.push(25); next.pokedex.seen.push(25); next.trainer.badges[8] = true;
  expect(adventureEvents(prev, next, 100)).toEqual([{ at: 100, kind: "captured", value: 25 }, { at: 100, kind: "badge", value: 8 }]);
  expect(adventureEvents(next, prev, 200)).toEqual([{ at: 200, kind: "rewind" }]);
  expect(adventureEvents(prev, prev, 200)).toEqual([]);
});
it("isolates histories by ROM and includes them in the existing data backup", () => {
  recordLegacyAdventure("gold.gbc", save(), 100);
  recordLegacyAdventure("silver.gbc", { ...save(), game: "silver" }, 200);
  recordLegacyAdventure("gold.gbc", save(), 300);
  const backup = collectBackup(localStorage);
  const entries = JSON.parse(backup.data["pokedex:legacy-adventures"]);
  expect(entries).toHaveLength(2);
  expect(entries[0].rom).toBe("gold.gbc");
  expect(entries[0].events).toHaveLength(1);
  expect(entries.every(isLegacyAdventure)).toBe(true);
});
it("rejects malformed stored adventures", () => {
  expect(isLegacyAdventure(null)).toBe(false);
  expect(isLegacyAdventure({ rom: "gold.gbc", save: { generation: 2 } })).toBe(false);
  const entry = { rom: "gold.gbc", save: save(), events: [], updatedAt: 100 };
  expect(isLegacyAdventure(entry)).toBe(true);
  expect(isLegacyAdventure({ ...entry, save: { ...entry.save, party: [{ nickname: "bad" }] } })).toBe(false);
});
