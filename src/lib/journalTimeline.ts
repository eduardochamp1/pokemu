/**
 * Diário ilustrado: notas, objetivos, capturas de tela e eventos do save numa
 * cronologia só.
 *
 * Cada coisa entra com o horário que o site realmente tem. Nota e objetivo: a
 * hora em que foram escritos. Captura: a hora da foto. Evento do save: a hora
 * em que o site **leu** o save — não a hora em que a captura ou a insígnia
 * aconteceu dentro do jogo, que o save não guarda. Por isso os eventos de uma
 * leitura aparecem juntos, e a tela os chama de "registrado no save".
 */

export type TimelineItem =
  | { kind: "note"; at: number; text: string }
  | { kind: "goal"; at: number; text: string; done: boolean }
  | { kind: "event"; at: number; text: string }
  | { kind: "screenshot"; at: number; fileName: string };

export interface TimelineDay {
  /** AAAA-MM-DD, no fuso de quem está lendo. */
  day: string;
  items: TimelineItem[];
}

export interface TimelineInput {
  notes: readonly { text: string; at: number }[];
  goals: readonly { text: string; at: number; done?: boolean }[];
  events: readonly { at: number; text: string }[];
  screenshots: readonly { fileName: string; at: number }[];
}

const dia = (at: number) => {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Desempate dentro do mesmo instante: a foto, depois o que foi escrito, depois o save. */
const ORDEM = { screenshot: 0, note: 1, goal: 2, event: 3 } as const;

/** Do dia mais recente para o mais antigo; dentro do dia, na ordem em que aconteceu. */
export function buildTimeline(input: TimelineInput): TimelineDay[] {
  const itens: TimelineItem[] = [
    ...input.notes.map((n) => ({ kind: "note" as const, at: n.at, text: n.text })),
    ...input.goals.map((g) => ({ kind: "goal" as const, at: g.at, text: g.text, done: g.done === true })),
    ...input.events.map((e) => ({ kind: "event" as const, at: e.at, text: e.text })),
    ...input.screenshots.map((s) => ({ kind: "screenshot" as const, at: s.at, fileName: s.fileName })),
  ].filter((i) => Number.isFinite(i.at));

  const porDia = new Map<string, TimelineItem[]>();
  for (const item of itens) {
    const d = dia(item.at);
    porDia.set(d, [...(porDia.get(d) ?? []), item]);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, items]) => ({
      day,
      items: items.sort((a, b) => a.at - b.at || ORDEM[a.kind] - ORDEM[b.kind]),
    }));
}
