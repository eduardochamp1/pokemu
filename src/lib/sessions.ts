import { useSyncExternalStore } from "react";
import type { Session } from "./recap";

/**
 * Quando cada jogo foi aberto pela última vez, e a vez antes dessa.
 *
 * É o que dá limite ao "Onde parei?": sem isto o resumo não tem como separar
 * o que aconteceu ontem do que aconteceu há um mês. Só os dois horários mais
 * recentes por ROM — não é um histórico de sessões.
 */

const KEY = "pokedex:sessions";

/**
 * Reabrir dentro deste intervalo é a mesma sessão. Recarregar a página traz a
 * última ROM de volta sozinha, e isso não pode empurrar a sessão de verdade
 * para "anterior".
 */
export const SAME_SESSION_MS = 5 * 60 * 1000;

let sessions: Record<string, Session> = {};
const listeners = new Set<() => void>();

const isSession = (v: unknown): v is Session => {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.current === "number" &&
    Number.isFinite(s.current) &&
    (s.previous === undefined || (typeof s.previous === "number" && Number.isFinite(s.previous)))
  );
};

export function reloadSessions(): void {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const out: Record<string, Session> = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [rom, s] of Object.entries(parsed)) {
        // Só os dois campos: a migração de renomeação acrescenta `rom`.
        if (isSession(s)) out[rom] = { current: s.current, previous: s.previous };
      }
    }
    sessions = out;
  } catch {
    sessions = {};
  }
  listeners.forEach((l) => l());
}

reloadSessions();

/** A sessão seguinte, dado o horário de agora. Pura. */
export function nextSession(existing: Session | undefined, now: number): Session {
  if (!existing) return { current: now };
  if (now - existing.current < SAME_SESSION_MS) return existing;
  return { current: now, previous: existing.current };
}

/** Registra que o jogo foi aberto agora. */
export function markSession(rom: string, now: number = Date.now()): void {
  const next = nextSession(sessions[rom], now);
  if (next === sessions[rom]) return;
  sessions = { ...sessions, [rom]: next };
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions));
  } catch {
    // sem localStorage a sessão vale só nesta visita
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSession(rom: string | undefined): Session | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (rom ? sessions[rom] : undefined),
    () => undefined
  );
}
