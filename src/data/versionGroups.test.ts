import { describe, expect, it } from "vitest";
import { VERSION_GROUPS } from "./versionGroups";

describe("VERSION_GROUPS", () => {
  it("nao repete id", () => {
    const ids = VERSION_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
