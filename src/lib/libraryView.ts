import { romRelease } from "../emulator/romChronology";

/**
 * O que a biblioteca mostra de cada jogo, separado do componente para poder
 * ser testado sem montar a tela.
 */

/** Nome curto do cartucho: sem extensão, sem "(USA)", sem o prefixo "Pokémon". */
export function displayTitle(fileName: string): string {
  return fileName
    .split(/[\\/]/)
    .pop()!
    .replace(/\.(gb|gbc|gba)$/i, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^(?:Pok[eé]mon|Pocket Monsters)\s*-?\s*/i, "");
}

/**
 * Cor de cada edição oficial, para dois cartuchos do mesmo console não
 * parecerem o mesmo jogo. `ink` é a cor do texto por cima.
 *
 * Só as edições que `romRelease` reconhece pelo nome têm cor. Romhack fica com
 * a cor do console: pintar um Unbound de vermelho-FireRed seria dizer que ele
 * é o que não é.
 */
const EDITION_COLORS: Record<string, { color: string; ink: string }> = {
  red: { color: "#b3261e", ink: "#fff" },
  green: { color: "#2e7d32", ink: "#fff" },
  blue: { color: "#1f4fa3", ink: "#fff" },
  yellow: { color: "#e3b505", ink: "#1b1b1b" },
  gold: { color: "#b8860b", ink: "#fff" },
  silver: { color: "#8a93a0", ink: "#111" },
  crystal: { color: "#3f9fc2", ink: "#06202b" },
  ruby: { color: "#9b1b30", ink: "#fff" },
  sapphire: { color: "#1c3f8f", ink: "#fff" },
  firered: { color: "#d9480f", ink: "#fff" },
  leafgreen: { color: "#4f9d2d", ink: "#fff" },
  emerald: { color: "#0f8a5f", ink: "#fff" },
};

export function editionColor(fileName: string): { color: string; ink: string } | undefined {
  const id = romRelease(fileName)?.id;
  return id ? EDITION_COLORS[id] : undefined;
}

export interface Progress {
  badges: boolean[];
  playSeconds: number;
}

/** "3 de 8 insígnias · 12h05", ou só o tempo quando ainda não há insígnia. */
export function progressSummary(p: Progress, en: boolean): string {
  const horas = Math.floor(p.playSeconds / 3600);
  const minutos = Math.floor((p.playSeconds % 3600) / 60);
  const tempo = `${horas}h${String(minutos).padStart(2, "0")}`;
  const ganhas = p.badges.filter(Boolean).length;
  if (ganhas === 0) return tempo;
  return en
    ? `${ganhas} of ${p.badges.length} badges · ${tempo}`
    : `${ganhas} de ${p.badges.length} insígnias · ${tempo}`;
}

/**
 * O jogo que a biblioteca oferece para retomar.
 *
 * Primeiro o que está carregado agora; depois a aventura ativa; depois a que
 * teve o save lido por último. Só vale um jogo que ainda está na biblioteca —
 * oferecer "continuar" para um arquivo que saiu da pasta levaria a um erro.
 */
export function resumeCandidate<T extends { fileName: string }>(
  games: readonly T[],
  currentRom: string | undefined,
  activeRom: string | undefined,
  lastSavedAt: ReadonlyMap<string, number>
): T | undefined {
  const porNome = (rom: string | undefined) =>
    rom === undefined ? undefined : games.find((g) => g.fileName === rom);
  const maisRecente = [...games]
    .filter((g) => lastSavedAt.has(g.fileName))
    .sort((a, b) => lastSavedAt.get(b.fileName)! - lastSavedAt.get(a.fileName)!)[0];
  return porNome(currentRom) ?? porNome(activeRom) ?? maisRecente;
}
