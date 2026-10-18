import type { RomRegistry } from "./romIdentity";

/**
 * Colisões de nome que o core não sabe separar.
 *
 * Dentro do core cada ROM vira um nome plano em `/data/games`, e o save, os
 * pontos de retorno e as capturas são achados pelo nome-base, sem extensão.
 * Então `pasta-a/demo.gba` e `pasta-b/demo.gba` seriam o mesmo jogo, e
 * `demo.gb` e `demo.gba` dividiriam o mesmo `.sav`. Isto é conferido antes de
 * qualquer byte ir para o core: melhor recusar e pedir para renomear do que
 * misturar duas aventuras.
 */

export type RomConflict =
  /** Duas ROMs da pasta com o mesmo nome em subpastas diferentes. */
  | { kind: "same-name-in-folders"; paths: string[] }
  /** Outra ROM já usada tem o mesmo nome-base: o save seria o mesmo arquivo. */
  | { kind: "same-save-name"; other: string }
  /** O nome é conhecido, mas o conteúdo mudou: patch, versão nova ou outro jogo. */
  | { kind: "content-changed" };

const basename = (name: string) => name.replace(/^.*[/\\]/, "");
const semExtensao = (name: string) => basename(name).replace(/\.(gb|gbc|gba)$/i, "").toLowerCase();

export interface RomConflictInput {
  /** O caminho como veio: com subpasta, quando vem da pasta `roms/`. */
  path: string;
  hash: string;
  registry: RomRegistry;
  /** As ROMs que já estão no core. */
  coreRoms: readonly string[];
  /** Os caminhos da pasta `roms/`, ou `null` sem pasta. */
  folderPaths: readonly string[] | null;
}

export function findRomConflict({ path, hash, registry, coreRoms, folderPaths }: RomConflictInput): RomConflict | null {
  const nome = basename(path);
  const xaras = (folderPaths ?? []).filter((p) => basename(p) === nome);
  if (xaras.length > 1) return { kind: "same-name-in-folders", paths: xaras };

  // Só o que está na biblioteca agora ocupa o nome do save. Mesmo conteúdo
  // com outra extensão é a mesma ROM renomeada, e leva o save junto.
  const base = semExtensao(nome);
  const presentes = new Set([...coreRoms.map(basename), ...(folderPaths ?? []).map(basename)]);
  for (const outra of presentes) {
    if (outra === nome || semExtensao(outra) !== base) continue;
    if (registry[outra]?.hash === hash) continue;
    return { kind: "same-save-name", other: outra };
  }

  const known = registry[nome];
  if (known && known.hash !== hash) return { kind: "content-changed" };
  return null;
}

/**
 * O destino de uma cápsula neste aparelho. A aventura exata (`adventureId`)
 * vence; o hash só lista candidatos, porque cópias idênticas podem ser
 * campanhas diferentes. Com mais de um candidato, quem escolhe é a pessoa.
 */
export interface CapsuleTarget {
  /** O destino decidido sem dúvida, ou `undefined` quando é preciso escolher. */
  target?: string;
  /** As opções, quando há mais de uma. */
  candidates: string[];
  /** Existe aqui uma ROM com o nome da cápsula, mas com outro conteúdo. */
  nameMismatch: boolean;
}

export function capsuleTarget(
  capsule: { rom: { fileName: string; hash?: string }; adventureId?: string },
  registry: RomRegistry
): CapsuleTarget {
  const entradas = Object.entries(registry).sort(([a], [b]) => a.localeCompare(b));
  const doNome = registry[capsule.rom.fileName];
  const nameMismatch = !!doNome && !!capsule.rom.hash && doNome.hash !== capsule.rom.hash;
  if (capsule.adventureId) {
    const exata = entradas.find(([, e]) => e.adventureId === capsule.adventureId);
    if (exata) return { target: exata[0], candidates: [exata[0]], nameMismatch };
  }
  const mesmoHash = capsule.rom.hash ? entradas.filter(([, e]) => e.hash === capsule.rom.hash).map(([n]) => n) : [];
  if (mesmoHash.length === 1) return { target: mesmoHash[0], candidates: mesmoHash, nameMismatch };
  if (mesmoHash.length > 1) return { candidates: mesmoHash, nameMismatch };
  return { target: capsule.rom.fileName, candidates: [capsule.rom.fileName], nameMismatch };
}
