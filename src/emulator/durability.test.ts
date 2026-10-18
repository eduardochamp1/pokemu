import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDurability, requestPersist, resetDurabilityForTests, RETRY_DELAYS_MS } from "./durability";

beforeEach(() => {
  vi.useRealTimers();
  resetDurabilityForTests(() => 1000);
});

function controlada() {
  const chamadas: { resolve: () => void; reject: (e: Error) => void }[] = [];
  const sync = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        chamadas.push({ resolve, reject });
      })
  );
  return { sync, chamadas };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("persistência observável (AUD-09)", () => {
  it("cota cheia não vira sucesso, e o erro fica", async () => {
    vi.useFakeTimers();
    const sync = vi.fn().mockRejectedValue(new Error("QuotaExceededError"));
    await requestPersist(sync);
    expect(getDurability()).toMatchObject({ state: "pending", error: "QuotaExceededError" });
    for (const espera of RETRY_DELAYS_MS) await vi.advanceTimersByTimeAsync(espera);
    expect(sync).toHaveBeenCalledTimes(1 + RETRY_DELAYS_MS.length);
    expect(getDurability()).toMatchObject({ state: "failed", error: "QuotaExceededError" });
    // Não some sozinho.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(getDurability().state).toBe("failed");
  });

  it("sucesso depois da falha limpa o alerta e marca o último sucesso", async () => {
    const sync = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined);
    await requestPersist(sync);
    await requestPersist(sync);
    expect(getDurability()).toEqual({ state: "saved", lastOk: 1000 });
  });

  it("pedidos durante uma gravação não se sobrepõem: viram uma só a seguir", async () => {
    const { sync, chamadas } = controlada();
    const a = requestPersist(sync);
    const b = requestPersist(sync);
    const c = requestPersist(sync);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(getDurability().state).toBe("saving");
    chamadas[0].resolve();
    await tick();
    expect(sync).toHaveBeenCalledTimes(2);
    chamadas[1].resolve();
    await Promise.all([a, b, c]);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(getDurability().state).toBe("saved");
  });
});
