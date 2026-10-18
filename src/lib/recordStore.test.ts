// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { onOtherTab, StaleWriteError, writeRecordEntry } from "./recordStore";

afterEach(() => localStorage.clear());

it("evento de outra aba na chave recarrega; em outra chave, não", () => {
  const reload = vi.fn();
  const parar = onOtherTab("pokedex:map-marks", reload);
  window.dispatchEvent(new StorageEvent("storage", { key: "pokedex:map-marks" }));
  window.dispatchEvent(new StorageEvent("storage", { key: "pokedex:outra" }));
  expect(reload).toHaveBeenCalledTimes(1);
  parar();
  window.dispatchEvent(new StorageEvent("storage", { key: "pokedex:map-marks" }));
  expect(reload).toHaveBeenCalledTimes(1);
});

it("preserva entradas que o filtro do store não reconhece", () => {
  localStorage.setItem("k", JSON.stringify({ "b.gba": { estranho: true } }));
  writeRecordEntry("k", "a.gba", undefined, { n: 1 }, (v) => v as { n: number } | undefined);
  expect(JSON.parse(localStorage.getItem("k")!)).toEqual({ "b.gba": { estranho: true }, "a.gba": { n: 1 } });
});

it("entrada criada por outra aba quando esta achava que não havia nenhuma", () => {
  localStorage.setItem("k", JSON.stringify({ "a.gba": { n: 2 } }));
  expect(() => writeRecordEntry("k", "a.gba", undefined, { n: 1 }, (v) => v as { n: number } | undefined)).toThrow(StaleWriteError);
});
