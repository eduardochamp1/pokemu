import { beforeEach, describe, expect, it } from "vitest";
import {
  allGuideTexts,
  deleteGuideText,
  readGuideText,
  renameGuideText,
  replaceAllGuideTexts,
  resetGuideStoreForTests,
  writeGuideText,
} from "./guideStore";

// Ambiente node: sem IndexedDB, o store cai na memória — é o mesmo caminho de
// um navegador com o banco bloqueado.
beforeEach(resetGuideStoreForTests);

describe("guideStore", () => {
  it("grava, lê e apaga", async () => {
    expect(await readGuideText("a.gba")).toBeNull();
    await writeGuideText("a.gba", "texto");
    expect(await readGuideText("a.gba")).toBe("texto");
    await deleteGuideText("a.gba");
    expect(await readGuideText("a.gba")).toBeNull();
  });

  it("renomear leva o guia junto", async () => {
    await writeGuideText("a.gba", "texto");
    await renameGuideText("a.gba", "b.gba");
    expect(await allGuideTexts()).toEqual({ "b.gba": "texto" });
  });

  it("renomear não sobrescreve o guia que o nome novo já tem", async () => {
    await writeGuideText("a.gba", "antigo");
    await writeGuideText("b.gba", "do b");
    await renameGuideText("a.gba", "b.gba");
    expect(await allGuideTexts()).toEqual({ "a.gba": "antigo", "b.gba": "do b" });
  });

  it("restaurar um backup troca tudo", async () => {
    await writeGuideText("a.gba", "some");
    await replaceAllGuideTexts({ "c.gba": "veio do backup" });
    expect(await allGuideTexts()).toEqual({ "c.gba": "veio do backup" });
  });
});
