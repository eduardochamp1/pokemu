import { afterEach, expect, it, vi } from "vitest";
import { FETCH_TIMEOUT_MS, fetchJsonPublic } from "./api";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("PokéAPI lenta desiste no tempo-limite em vez de carregar para sempre (E09)", async () => {
  // O relógio do AbortSignal.timeout é interno: o teste entrega um sinal que
  // ele mesmo dispara, e confere o prazo pedido.
  const relogio = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(relogio.signal);
  vi.stubGlobal(
    "fetch",
    (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason)))
  );
  const r = fetchJsonPublic("https://pokeapi.co/api/v2/pokemon/1").catch((e: unknown) => e);
  expect(timeout).toHaveBeenCalledWith(FETCH_TIMEOUT_MS);
  relogio.abort(new DOMException("tempo esgotado", "TimeoutError"));
  expect(await r).toMatchObject({ name: "TimeoutError" });
});

it("quem chamou ainda pode cancelar antes", async () => {
  vi.stubGlobal(
    "fetch",
    (_url: string, init: { signal: AbortSignal }) =>
      new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("cancelado"))))
  );
  const ctl = new AbortController();
  const r = fetchJsonPublic("https://pokeapi.co/api/v2/pokemon/1", ctl.signal).catch((e: unknown) => e);
  ctl.abort();
  expect(((await r) as Error).message).toBe("cancelado");
});
