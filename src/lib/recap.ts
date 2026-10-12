/**
 * "Onde parei?": o que dá para dizer de uma aventura sem abrir o jogo.
 *
 * Tudo aqui sai de dados que o site já guarda — objetivos e notas do diário,
 * eventos que o leitor de save registrou e os horários das sessões. Nada é
 * inferido: o site não sabe em que rota a pessoa está nem o que aconteceu
 * entre dois saves, então o resumo fala de saves lidos e do que ela mesma
 * anotou.
 */

export interface RecapItem {
  id: string;
  text: string;
  at: number;
  done?: boolean;
}

export interface Session {
  /** Quando o jogo foi aberto pela última vez. */
  current: number;
  /** A abertura anterior a essa. */
  previous?: number;
}

export interface RecapInput {
  goals: readonly RecapItem[];
  notes: readonly RecapItem[];
  events: readonly { at: number; kind: string }[];
  session?: Session;
}

export interface Recap {
  /** O objetivo aberto mais antigo: o que está esperando há mais tempo. */
  pendingGoal?: RecapItem;
  /** Quantos outros objetivos abertos existem além dele. */
  otherPending: number;
  lastNote?: RecapItem;
  /** Eventos da janela, por tipo. `start` não entra: não é algo que se fez. */
  counts: Record<string, number>;
  /** Início da janela dos eventos, ou `undefined` se não há sessão registrada. */
  since?: number;
  /** A janela é a sessão em andamento (`current`) ou a anterior (`previous`). */
  window: "current" | "previous" | "last-save" | "none";
}

/**
 * Escolhe a janela de eventos e monta o resumo. Pura.
 *
 * A janela é a sessão mais recente que tem eventos. Logo depois de abrir o
 * jogo, a sessão atual está vazia — e é exatamente aí que o resumo importa —
 * então vale a anterior. Para aventuras de antes de as sessões serem
 * registradas, vale o que veio no último save lido.
 */
export function buildRecap(input: RecapInput): Recap {
  const abertos = input.goals.filter((g) => !g.done).sort((a, b) => a.at - b.at);
  const lastNote = [...input.notes].sort((a, b) => b.at - a.at)[0];
  const feitos = input.events.filter((e) => e.kind !== "start");

  let since: number | undefined;
  let janela: Recap["window"] = "none";
  let naJanela: typeof feitos = [];

  const desde = (t: number) => feitos.filter((e) => e.at >= t);
  if (input.session && desde(input.session.current).length > 0) {
    since = input.session.current;
    janela = "current";
    naJanela = desde(since);
  } else if (input.session?.previous !== undefined && desde(input.session.previous).length > 0) {
    since = input.session.previous;
    janela = "previous";
    naJanela = desde(since);
  } else if (feitos.length > 0) {
    // Sem sessão registrada: o lote do último save lido, que entra todo com
    // o mesmo horário.
    const ultimo = Math.max(...feitos.map((e) => e.at));
    janela = "last-save";
    naJanela = feitos.filter((e) => e.at === ultimo);
  }

  const counts: Record<string, number> = {};
  for (const e of naJanela) counts[e.kind] = (counts[e.kind] ?? 0) + 1;

  return {
    pendingGoal: abertos[0],
    otherPending: Math.max(0, abertos.length - 1),
    lastNote,
    counts,
    since,
    window: janela,
  };
}

const ROTULOS: Record<string, [singularPt: string, pluralPt: string, singularEn: string, pluralEn: string]> = {
  captured: ["captura", "capturas", "catch", "catches"],
  badge: ["insígnia", "insígnias", "badge", "badges"],
  level: ["subida de nível", "subidas de nível", "level up", "level ups"],
  evolved: ["evolução", "evoluções", "evolution", "evolutions"],
  town: ["cidade nova", "cidades novas", "new town", "new towns"],
  achievement: ["conquista", "conquistas", "achievement", "achievements"],
  rewind: ["volta a um save anterior", "voltas a um save anterior", "return to an earlier save", "returns to an earlier save"],
};
/** A ordem em que os tipos aparecem na frase: o mais marcante primeiro. */
const ORDEM = ["badge", "evolved", "captured", "town", "level", "achievement", "rewind"];

/** "1 insígnia, 2 capturas e 3 subidas de nível" — vazio se não houve nada. */
export function describeCounts(counts: Record<string, number>, en: boolean): string {
  const partes = ORDEM.filter((k) => counts[k] > 0).map((k) => {
    const [sPt, pPt, sEn, pEn] = ROTULOS[k];
    const n = counts[k];
    return `${n} ${en ? (n === 1 ? sEn : pEn) : n === 1 ? sPt : pPt}`;
  });
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} ${en ? "and" : "e"} ${partes[partes.length - 1]}`;
}
