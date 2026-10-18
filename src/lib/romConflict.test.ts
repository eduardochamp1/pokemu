import { describe, expect, it } from "vitest";
import { capsuleTarget, findRomConflict } from "./romConflict";
import type { RomIdentity, RomRegistry } from "./romIdentity";

const H1 = "1".repeat(64);
const H2 = "2".repeat(64);
const id = (hash: string, adventureId: string): RomIdentity => ({ hash, adventureId, size: 1, firstSeen: 0 });

describe("colisões antes de carregar (AUD-06)", () => {
  it("duas subpastas com o mesmo nome", () => {
    expect(
      findRomConflict({ path: "pasta-a/demo.gba", hash: H1, registry: {}, coreRoms: [], folderPaths: ["pasta-a/demo.gba", "pasta-b/demo.gba"] })
    ).toEqual({ kind: "same-name-in-folders", paths: ["pasta-a/demo.gba", "pasta-b/demo.gba"] });
  });

  it("mesmo nome-base em consoles diferentes divide o save", () => {
    expect(findRomConflict({ path: "demo.gba", hash: H1, registry: { "demo.gb": id(H2, "a") }, coreRoms: ["demo.gb"], folderPaths: null })).toEqual({
      kind: "same-save-name",
      other: "demo.gb",
    });
  });

  it("mesmo conteúdo com outra extensão é renomeação, não colisão", () => {
    expect(findRomConflict({ path: "demo.gbc", hash: H1, registry: { "demo.gb": id(H1, "a") }, coreRoms: ["demo.gb"], folderPaths: null })).toBeNull();
  });

  it("nome conhecido com conteúdo novo pede confirmação (patch não é presumido)", () => {
    expect(findRomConflict({ path: "demo.gba", hash: H2, registry: { "demo.gba": id(H1, "a") }, coreRoms: ["demo.gba"], folderPaths: null })).toEqual({
      kind: "content-changed",
    });
  });

  it("duas campanhas do mesmo conteúdo com nomes diferentes não colidem", () => {
    expect(findRomConflict({ path: "copia.gba", hash: H1, registry: { "demo.gba": id(H1, "a") }, coreRoms: ["demo.gba"], folderPaths: null })).toBeNull();
  });

  it("nome sumido da biblioteca não ocupa o save", () => {
    expect(findRomConflict({ path: "demo.gba", hash: H1, registry: { "demo.gb": id(H2, "a") }, coreRoms: [], folderPaths: null })).toBeNull();
  });
});

describe("destino da cápsula (AUD-08)", () => {
  const capsula = { rom: { fileName: "demo.gba", hash: H1 }, adventureId: "b" };

  it("a aventura exata vence, em qualquer ordem de registro", () => {
    const r1: RomRegistry = { "x.gba": id(H1, "a"), "y.gba": id(H1, "b") };
    const r2: RomRegistry = { "y.gba": id(H1, "b"), "x.gba": id(H1, "a") };
    expect(capsuleTarget(capsula, r1).target).toBe("y.gba");
    expect(capsuleTarget(capsula, r2).target).toBe("y.gba");
  });

  it("sem a aventura exata e com duas cópias iguais, não escolhe sozinho", () => {
    const r: RomRegistry = { "y.gba": id(H1, "c"), "x.gba": id(H1, "a") };
    expect(capsuleTarget(capsula, r)).toEqual({ candidates: ["x.gba", "y.gba"], nameMismatch: false });
  });

  it("uma cópia só com o mesmo conteúdo: vai para ela", () => {
    expect(capsuleTarget(capsula, { "outro-nome.gba": id(H1, "z") }).target).toBe("outro-nome.gba");
  });

  it("nome igual com outro conteúdo é avisado", () => {
    expect(capsuleTarget(capsula, { "demo.gba": id(H2, "z") })).toEqual({
      target: "demo.gba",
      candidates: ["demo.gba"],
      nameMismatch: true,
    });
  });
});
