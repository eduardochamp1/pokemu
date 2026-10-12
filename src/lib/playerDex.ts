/**
 * A dex do jogador, lida do save de Gen 3 e guardada no `localStorage`.
 *
 * Uma entrada por ROM. Quem lê o save no emulador grava aqui, e o backup de
 * "Seus dados" leva junto.
 */

export interface PlayerDexEntry {
  /** Nome do arquivo da ROM, que é como o site identifica o jogo. */
  rom: string;
  playerName: string;
  /** Números nacionais, crescentes. `owned` está contido em `seen`. */
  seen: number[];
  owned: number[];
  updatedAt: number;
}

/** Tamanho da dex nacional que um jogo de Gen 3 consegue marcar. */
export const TOTAL_DA_DEX_GEN3 = 386;

const KEY = "pokedex:player-dex";

const isNumeros = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.every((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_DA_DEX_GEN3);

function isEntry(v: unknown): v is PlayerDexEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.rom === "string" &&
    typeof e.playerName === "string" &&
    isNumeros(e.seen) &&
    isNumeros(e.owned) &&
    typeof e.updatedAt === "number"
  );
}

/**
 * Lê e valida. O que foi gravado por outra versão do site com outra forma é
 * descartado entrada por entrada, em vez de derrubar a Home.
 */
function load(): Record<string, PlayerDexEntry> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, PlayerDexEntry> = {};
    for (const [rom, entry] of Object.entries(parsed)) {
      if (isEntry(entry) && entry.rom === rom) out[rom] = entry;
    }
    return out;
  } catch {
    return {};
  }
}

let entradas: Record<string, PlayerDexEntry> = {};

/** Relê do `localStorage`. Usado ao iniciar. */
export function reloadPlayerDex(): void {
  entradas = load();
}

reloadPlayerDex();

/** Grava a dex de uma ROM. Falhar em gravar não pode quebrar o jogo. */
export function recordPlayerDex(
  rom: string,
  playerName: string,
  pokedex: { seen: number[]; owned: number[] },
  now: number = Date.now()
): void {
  const entry: PlayerDexEntry = {
    rom,
    playerName,
    seen: [...pokedex.seen],
    owned: [...pokedex.owned],
    updatedAt: now,
  };
  entradas = { ...entradas, [rom]: entry };
  try {
    localStorage.setItem(KEY, JSON.stringify(entradas));
  } catch {
    // sem localStorage: a dex vale só nesta aba
  }
}
