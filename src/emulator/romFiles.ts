import { romBaseName } from "./saveStates";
import { RollbackError } from "../lib/capsule";

/**
 * Renomeia, dentro do FS do core, o que pertence a uma ROM que mudou de nome.
 *
 * O core nomeia tudo pelo nome da ROM sem extensão: o save de bateria
 * (`<base>.sav`), os pontos de retorno (`<base>.ssN` e `<base>_auto.ss`), as
 * miniaturas deles (`<base>.ssN.png`) e as capturas (`<base>-AAAAMMDD-HHMMSS.png`).
 * Levar só o diário e deixar o save para trás seria renomear a ficha e perder
 * a partida.
 */

/** O pedaço do FS do Emscripten que isto usa. */
export interface FsLike {
  readdir(path: string): string[];
  rename(from: string, to: string): void;
}

export interface RomDirs {
  savePath: string;
  saveStatePath: string;
  screenshotsPath: string;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * O que renomear uma ROM moveria, sem mover: cada arquivo dela e o nome
 * novo. `conflicts` são os que já existem com o nome novo — mover por cima
 * perderia um deles, então a renomeação inteira para e pede decisão.
 *
 * O padrão é ancorado nos sufixos que o core produz, e não em "começa com a
 * base": `Emerald (2).sav` começa com `Emerald` e não é desta ROM.
 */
export interface RenamePlan {
  moves: [string, string][];
  conflicts: string[];
}

export function planRomFileRename(fs: FsLike, dirs: RomDirs, fromRom: string, toRom: string): RenamePlan {
  const de = romBaseName(fromRom);
  const para = romBaseName(toRom);
  const plano: RenamePlan = { moves: [], conflicts: [] };
  if (de === para) return plano;

  const sufixo = new RegExp(
    `^${escapar(de)}(\\.sav|\\.ss\\d|_auto\\.ss|\\.ss\\d\\.png|-\\d{8}-\\d{6}\\.png)$`
  );
  for (const dir of new Set([dirs.savePath, dirs.saveStatePath, dirs.screenshotsPath])) {
    let nomes: string[];
    try {
      nomes = fs.readdir(dir);
    } catch {
      continue; // diretório ainda não existe: nada a levar
    }
    const existentes = new Set(nomes);
    for (const nome of nomes) {
      const m = sufixo.exec(nome);
      if (!m) continue;
      const novo = para + m[1];
      if (existentes.has(novo)) plano.conflicts.push(`${dir}/${novo}`);
      else plano.moves.push([`${dir}/${nome}`, `${dir}/${novo}`]);
    }
  }
  return plano;
}

/**
 * Faz as mudanças do plano, tudo ou nada: se um arquivo não renomeia, os que
 * já foram voltam ao nome antigo e o erro sobe. Se nem voltar der, sobe
 * `RollbackError` com os que ficaram no nome novo.
 */
export function applyRomFileRename(fs: FsLike, moves: readonly [string, string][]): void {
  const feitos: [string, string][] = [];
  try {
    for (const [de, para] of moves) {
      fs.rename(de, para);
      feitos.push([de, para]);
    }
  } catch (error) {
    const falhas: string[] = [];
    for (const [de, para] of feitos.reverse()) {
      try {
        fs.rename(para, de);
      } catch {
        falhas.push(para);
      }
    }
    if (falhas.length > 0) throw new RollbackError(falhas, error);
    throw error;
  }
}

/** O inverso de um plano aplicado, para desfazer depois. */
export const reverseMoves = (moves: readonly [string, string][]): [string, string][] =>
  [...moves].reverse().map(([de, para]) => [para, de]);
