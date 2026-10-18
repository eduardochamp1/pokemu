import { CHALLENGE_KEY, isChallenge } from "./challenge";
import { isLegacyAdventure } from "./legacyAdventures";
import { MAP_MARKS_KEY, MAX_MARKS, isMark } from "./mapMarks";
import { PERSONAL_KEY, validPersonalAdventure } from "./personalAdventures";
import { isPlayerDexEntry } from "./playerDex";
import { ROM_IDENTITY_KEY, isRomIdentity } from "./romIdentity";
import { isSession } from "./sessions";
import { isTrainerEntry } from "./trainerLog";

/**
 * A forma de cada registro que o backup carrega. Os stores descartam, ao
 * carregar, a entrada que não reconhecem — mas uma importação que descarta
 * calada é perda de dados, e uma entrada meio certa derruba a tela que a lê.
 * Aqui a importação confere tudo antes de mudar qualquer coisa e diz o que
 * não passou.
 *
 * Chaves sem esquema (preferências, recordes, atalhos) entram como texto:
 * cada tela já trata o valor dela como opcional.
 */

/** Teto de entradas por coleção: um arquivo de backup normal fica muito abaixo. */
export const MAX_BACKUP_ENTRIES = 2000;

type Problema = string;
type Validador = (v: unknown) => Problema[];

const porRom =
  (ok: (entry: unknown, rom: string) => boolean): Validador =>
  (v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return ["formato"];
    const entradas = Object.entries(v);
    if (entradas.length > MAX_BACKUP_ENTRIES) return ["entradas demais"];
    return entradas.filter(([rom, e]) => !ok(e, rom)).map(([rom]) => rom);
  };

const lista =
  (ok: (entry: unknown) => boolean): Validador =>
  (v) => {
    if (!Array.isArray(v)) return ["formato"];
    if (v.length > MAX_BACKUP_ENTRIES) return ["entradas demais"];
    return v.flatMap((e, i) => (ok(e) ? [] : [String((e as { rom?: unknown } | null)?.rom ?? `#${i + 1}`)]));
  };

const comRom = (e: unknown, rom: string) => (e as { rom?: unknown } | null)?.rom === rom;

const ESQUEMAS: Record<string, Validador> = {
  [PERSONAL_KEY]: lista(validPersonalAdventure),
  "pokedex:legacy-adventures": lista(isLegacyAdventure),
  "pokedex:trainer-log": porRom((e, rom) => isTrainerEntry(e) && comRom(e, rom)),
  "pokedex:player-dex": porRom((e, rom) => isPlayerDexEntry(e) && comRom(e, rom)),
  "pokedex:sessions": porRom((e) => isSession(e)),
  [CHALLENGE_KEY]: porRom((e, rom) => isChallenge(e) && comRom(e, rom)),
  [MAP_MARKS_KEY]: porRom((e) => {
    const marks = (e as { marks?: unknown } | null)?.marks;
    return Array.isArray(marks) && marks.length <= MAX_MARKS && marks.every(isMark);
  }),
  [ROM_IDENTITY_KEY]: porRom((e) => isRomIdentity(e)),
};

/**
 * O que não passa na conferência, como `chave` ou `chave: entrada`. Vazio
 * quando o backup inteiro pode ser importado.
 */
export function backupProblems(data: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [key, raw] of Object.entries(data)) {
    const validar = ESQUEMAS[key];
    if (!validar) continue;
    let v: unknown;
    try {
      v = JSON.parse(raw);
    } catch {
      out.push(`${key}: formato`);
      continue;
    }
    for (const p of validar(v)) out.push(`${key}: ${p}`);
  }
  return out;
}
