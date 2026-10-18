import { afterEach, expect, it, vi } from "vitest";
import { IDB_BLOCKED_TIMEOUT_MS, IdbBlockedError, kv } from "./idb";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("banco segurado por outra aba vira erro com motivo, e não espera para sempre (E09)", async () => {
  vi.useFakeTimers();
  const req: { onblocked?: () => void; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void } = {};
  vi.stubGlobal("indexedDB", { open: () => req });
  const leitura = kv<string>("guides").get("x");
  const resultado = leitura.catch((e: unknown) => e);
  req.onblocked?.();
  await vi.advanceTimersByTimeAsync(IDB_BLOCKED_TIMEOUT_MS);
  expect(await resultado).toBeInstanceOf(IdbBlockedError);
});
