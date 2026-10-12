import { describe, expect, it } from "vitest";
import { prettyMoveName } from "./moves";

describe("prettyMoveName", () => {
  it("slug vira titulo legivel", () => {
    expect(prettyMoveName("thunder-shock")).toBe("Thunder Shock");
    expect(prettyMoveName("tackle")).toBe("Tackle");
  });

  it("aguenta numero e palavra unica", () => {
    expect(prettyMoveName("double-slap-2")).toBe("Double Slap 2");
  });
});
