import { useSyncExternalStore } from "react";
import { EMERALD_GYMS, FRLG_GYMS } from "../data/gymLeaders";
import { nextGym } from "./gymGuide";
import { onOtherTab, StaleWriteError, writeRecordEntry } from "./recordStore";

/**
 * Modo desafio: regras que a pessoa impõe a si mesma (Nuzlocke e parentes).
 *
 * Quase tudo aqui é confirmado à mão, de propósito. Um save isolado não prova
 * qual foi o primeiro encontro de uma rota nem que um pokémon desmaiou — ele
 * só mostra como as coisas estão. O que o save consegue provar, o site
 * confere sozinho: o nível do time contra o limite escolhido.
 */

export interface Encounter {
  id: string;
  area: string;
  outcome: "caught" | "failed" | "skipped";
  species?: string;
  at: number;
}

export interface Loss {
  id: string;
  name: string;
  cause: string;
  at: number;
}

export interface Challenge {
  rom: string;
  startedAt: number;
  /** Ids das regras prontas ligadas. */
  rules: string[];
  /** Regras escritas pela pessoa. */
  custom: string[];
  /**
   * `gym`: até o nível do pokémon mais forte do próximo líder; número: fixo;
   * ausente: sem limite.
   */
  levelCap?: "gym" | number;
  encounters: Encounter[];
  losses: Loss[];
}

export const RULES: { id: string; pt: string; en: string }[] = [
  { id: "first-encounter", pt: "Só o primeiro encontro de cada área pode ser capturado", en: "Only the first encounter in each area may be caught" },
  { id: "faint-is-loss", pt: "Pokémon que desmaia não é mais usado", en: "A pokémon that faints is no longer used" },
  { id: "nickname-all", pt: "Todo pokémon recebe apelido", en: "Every pokémon gets a nickname" },
  { id: "no-battle-items", pt: "Sem itens durante as batalhas", en: "No items during battles" },
  { id: "set-mode", pt: "Sem trocar de pokémon de graça após derrubar um adversário", en: "No free switch after knocking out a foe" },
];

export const CHALLENGE_KEY = "pokedex:challenges";

const texto = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const quando = (v: unknown) => typeof v === "number" && Number.isFinite(v);

export function isChallenge(v: unknown): v is Challenge {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  const listaDe = (x: unknown, max: number, ok: (i: Record<string, unknown>) => boolean) =>
    Array.isArray(x) && x.length <= max && x.every((i) => i && typeof i === "object" && ok(i as Record<string, unknown>));
  return (
    texto(c.rom, 300) &&
    (c.rom as string).length > 0 &&
    quando(c.startedAt) &&
    Array.isArray(c.rules) &&
    c.rules.every((r) => RULES.some((k) => k.id === r)) &&
    Array.isArray(c.custom) &&
    c.custom.length <= 20 &&
    c.custom.every((r) => texto(r, 200)) &&
    (c.levelCap === undefined ||
      c.levelCap === "gym" ||
      (Number.isInteger(c.levelCap) && (c.levelCap as number) >= 1 && (c.levelCap as number) <= 100)) &&
    listaDe(c.encounters, 500, (e) =>
      texto(e.id, 60) &&
      texto(e.area, 80) &&
      (e.area as string).trim().length > 0 &&
      ["caught", "failed", "skipped"].includes(e.outcome as string) &&
      (e.species === undefined || texto(e.species, 40)) &&
      quando(e.at)
    ) &&
    listaDe(c.losses, 500, (l) => texto(l.id, 60) && texto(l.name, 40) && (l.name as string).trim().length > 0 && texto(l.cause, 200) && quando(l.at))
  );
}

let challenges: Record<string, Challenge> = {};
const valido = (rom: string) => (c: unknown): Challenge | undefined => (isChallenge(c) && c.rom === rom ? c : undefined);
const listeners = new Set<() => void>();

export function reloadChallenges(): void {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CHALLENGE_KEY) ?? "{}");
    const out: Record<string, Challenge> = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [rom, c] of Object.entries(parsed)) {
        const ok = valido(rom)(c);
        if (ok) out[rom] = ok;
      }
    }
    challenges = out;
  } catch {
    challenges = {};
  }
  listeners.forEach((l) => l());
}
reloadChallenges();

/**
 * Grava e só então publica: falha de armazenamento não finge ter salvado.
 * Troca só a entrada desta ROM, relida na hora: o que outra aba gravou em
 * outra aventura fica. Se a outra aba mexeu neste mesmo desafio, sobe
 * `StaleWriteError` e o desafio é recarregado.
 */
function persist(rom: string, next: Challenge | undefined): void {
  try {
    writeRecordEntry(CHALLENGE_KEY, rom, challenges[rom], next, valido(rom));
  } catch (error) {
    if (error instanceof StaleWriteError) reloadChallenges();
    throw error;
  }
  reloadChallenges();
}

export function startChallenge(rom: string, now: number = Date.now()): void {
  if (challenges[rom]) return;
  persist(rom, { rom, startedAt: now, rules: ["first-encounter", "faint-is-loss"], custom: [], encounters: [], losses: [] });
}

export function updateChallenge(rom: string, patch: Partial<Omit<Challenge, "rom" | "startedAt">>): void {
  const atual = challenges[rom];
  if (!atual) throw new Error("No challenge for this game");
  const next = { ...atual, ...patch };
  if (!isChallenge(next)) throw new Error("Invalid challenge data");
  persist(rom, next);
}

export function endChallenge(rom: string): void {
  persist(rom, undefined);
}

let pararDeOuvir: (() => void) | null = null;

function subscribe(l: () => void) {
  if (listeners.size === 0) pararDeOuvir = onOtherTab(CHALLENGE_KEY, reloadChallenges);
  listeners.add(l);
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) {
      pararDeOuvir?.();
      pararDeOuvir = null;
    }
  };
}

export function useChallenge(rom: string | undefined): Challenge | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (rom ? challenges[rom] : undefined),
    () => undefined
  );
}

/**
 * O limite de nível em vigor. No modo `gym`, é o nível do pokémon mais forte
 * do próximo líder — só existe para os jogos com guia de ginásios e com as
 * insígnias lidas do save. `null` quando não dá para saber.
 */
export function levelCapFor(
  cap: Challenge["levelCap"],
  game: "emerald" | "frlg" | "rs" | undefined,
  badges: boolean[] | undefined
): number | null {
  if (cap === undefined) return null;
  if (cap !== "gym") return cap;
  const gyms = game === "emerald" ? EMERALD_GYMS : game === "frlg" ? FRLG_GYMS : undefined;
  if (!gyms || !badges) return null;
  const proximo = nextGym(badges);
  if (proximo === null) return 100;
  return Math.max(...gyms[proximo].party.map((m) => m.level));
}

/** Quem do time está acima do limite: a única regra que o save prova. */
export function overCap(team: readonly { nickname: string; level: number }[], cap: number | null): { nickname: string; level: number }[] {
  if (cap === null) return [];
  return team.filter((m) => m.level > cap);
}

/** Uma área já tem encontro registrado? Compara sem caixa nem acento. */
export function areaUsed(encounters: readonly Encounter[], area: string): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return encounters.some((e) => norm(e.area) === norm(area));
}
