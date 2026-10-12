import { describe, expect, it } from "vitest";
import { buildTimeline } from "./journalTimeline";

const em = (dia: number, hora: number, min = 0) => new Date(2026, 9, dia, hora, min).getTime();

describe("buildTimeline", () => {
  it("junta tudo por dia, do mais recente para o mais antigo", () => {
    const dias = buildTimeline({
      notes: [{ text: "Parei no Mt. Moon", at: em(11, 21) }],
      goals: [{ text: "Vencer o Brock", at: em(10, 9), done: true }],
      events: [{ text: "Capturou Zubat", at: em(11, 20) }],
      screenshots: [{ fileName: "Red-20261012-080000.png", at: em(12, 8) }],
    });
    expect(dias.map((d) => d.day)).toEqual(["2026-10-12", "2026-10-11", "2026-10-10"]);
    expect(dias[1].items.map((i) => i.kind)).toEqual(["event", "note"]);
    expect(dias[2].items[0]).toEqual({ kind: "goal", at: em(10, 9), text: "Vencer o Brock", done: true });
  });

  it("dentro do dia segue a ordem em que aconteceu", () => {
    const [d] = buildTimeline({
      notes: [{ text: "tarde", at: em(12, 15) }, { text: "manhã", at: em(12, 9) }],
      goals: [],
      events: [{ text: "meio-dia", at: em(12, 12) }],
      screenshots: [],
    });
    expect(d.items.map((i) => ("text" in i ? i.text : ""))).toEqual(["manhã", "meio-dia", "tarde"]);
  });

  /** Os eventos de uma leitura de save entram todos com o mesmo horário. */
  it("no mesmo instante, a foto vem antes do que o save registrou", () => {
    const t = em(12, 10);
    const [d] = buildTimeline({
      notes: [],
      goals: [],
      events: [{ text: "Ganhou a insígnia", at: t }],
      screenshots: [{ fileName: "x.png", at: t }],
    });
    expect(d.items.map((i) => i.kind)).toEqual(["screenshot", "event"]);
  });

  it("sem nada, não há dia nenhum", () => {
    expect(buildTimeline({ notes: [], goals: [], events: [], screenshots: [] })).toEqual([]);
  });

  it("horário inválido fica de fora em vez de criar um dia 'NaN'", () => {
    expect(buildTimeline({ notes: [{ text: "x", at: NaN }], goals: [], events: [], screenshots: [] })).toEqual([]);
  });
});
