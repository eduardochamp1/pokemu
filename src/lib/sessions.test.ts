import { describe, expect, it } from "vitest";
import { SAME_SESSION_MS, nextSession } from "./sessions";

describe("nextSession", () => {
  it("a primeira vez não tem anterior", () => {
    expect(nextSession(undefined, 1000)).toEqual({ current: 1000 });
  });

  it("abrir de novo mais tarde empurra a atual para anterior", () => {
    const depois = 1000 + SAME_SESSION_MS + 1;
    expect(nextSession({ current: 1000, previous: 5 }, depois)).toEqual({ current: depois, previous: 1000 });
  });

  /** F5 recarrega a última ROM sozinho: não é uma sessão nova. */
  it("reabrir logo em seguida é a mesma sessão", () => {
    const atual = { current: 1000, previous: 5 };
    expect(nextSession(atual, 1000 + SAME_SESSION_MS - 1)).toBe(atual);
  });
});
