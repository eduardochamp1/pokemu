import { describe, expect, it } from "vitest";
import { buildRecap, describeCounts } from "./recap";

const item = (id: string, at: number, done = false) => ({ id, text: id, at, done });
const ev = (kind: string, at: number) => ({ kind, at });

describe("buildRecap", () => {
  it("o objetivo aberto mais antigo vem primeiro, e conta os outros", () => {
    const r = buildRecap({
      goals: [item("novo", 30), item("feito", 5, true), item("antigo", 10), item("meio", 20)],
      notes: [],
      events: [],
    });
    expect(r.pendingGoal?.id).toBe("antigo");
    expect(r.otherPending).toBe(2);
  });

  it("a nota mais recente", () => {
    const r = buildRecap({ goals: [], notes: [item("a", 1), item("c", 9), item("b", 5)], events: [] });
    expect(r.lastNote?.id).toBe("c");
  });

  it("conta o que aconteceu na sessão em andamento", () => {
    const r = buildRecap({
      goals: [],
      notes: [],
      events: [ev("captured", 50), ev("captured", 120), ev("badge", 130), ev("start", 125)],
      session: { current: 100, previous: 10 },
    });
    expect(r.window).toBe("current");
    expect(r.since).toBe(100);
    expect(r.counts).toEqual({ captured: 1, badge: 1 });
  });

  /** Acabou de abrir o jogo: a sessão atual está vazia, vale a anterior. */
  it("sessão atual sem eventos recua para a anterior", () => {
    const r = buildRecap({
      goals: [],
      notes: [],
      events: [ev("captured", 50), ev("level", 60)],
      session: { current: 100, previous: 40 },
    });
    expect(r.window).toBe("previous");
    expect(r.since).toBe(40);
    expect(r.counts).toEqual({ captured: 1, level: 1 });
  });

  it("sem sessão registrada, vale o lote do último save lido", () => {
    const r = buildRecap({
      goals: [],
      notes: [],
      events: [ev("captured", 10), ev("captured", 90), ev("badge", 90)],
    });
    expect(r.window).toBe("last-save");
    expect(r.since).toBeUndefined();
    expect(r.counts).toEqual({ captured: 1, badge: 1 });
  });

  it("aventura sem nada registrado não inventa resumo", () => {
    const r = buildRecap({ goals: [], notes: [], events: [ev("start", 1)] });
    expect(r).toEqual({ pendingGoal: undefined, otherPending: 0, lastNote: undefined, counts: {}, since: undefined, window: "none" });
  });
});

describe("describeCounts", () => {
  it("singular, plural e a ordem do mais marcante para o menos", () => {
    expect(describeCounts({ level: 3, captured: 2, badge: 1 }, false)).toBe("1 insígnia, 2 capturas e 3 subidas de nível");
    expect(describeCounts({ captured: 1 }, false)).toBe("1 captura");
    expect(describeCounts({ badge: 2, evolved: 1 }, true)).toBe("2 badges and 1 evolution");
  });

  it("nada aconteceu, nada a dizer", () => {
    expect(describeCounts({}, false)).toBe("");
  });

  it("tipo que não conhece é ignorado", () => {
    expect(describeCounts({ misterio: 4, captured: 1 }, false)).toBe("1 captura");
  });
});
