import { romBaseName } from "./saveStates";
import {
  capsuleFile,
  fromBase64,
  type CapsuleFile,
  type CapsuleFileKind,
  type RestoreStep,
} from "../lib/capsule";

/**
 * A parte da cápsula que mexe no FS do core: juntar os arquivos de uma ROM e
 * gravá-los de volta.
 */

export interface CapsuleFs {
  readdir(path: string): string[];
  readFile(path: string): Uint8Array;
  writeFile(path: string, data: Uint8Array): void;
  rename(from: string, to: string): void;
  unlink(path: string): void;
}

export interface CapsuleDirs {
  savePath: string;
  saveStatePath: string;
  screenshotsPath: string;
}

/** Sufixo -> tipo e diretório. A ordem importa: `.ssN.png` antes de `.ssN`. */
const TIPOS: { re: RegExp; kind: CapsuleFileKind; dir: keyof CapsuleDirs }[] = [
  { re: /^\.sav$/, kind: "save", dir: "savePath" },
  { re: /^\.ss\d\.png$/, kind: "thumbnail", dir: "screenshotsPath" },
  { re: /^-\d{8}-\d{6}\.png$/, kind: "screenshot", dir: "screenshotsPath" },
  { re: /^(\.ss\d|_auto\.ss)$/, kind: "state", dir: "saveStatePath" },
];

const tipoDe = (suffix: string) => TIPOS.find((t) => t.re.test(suffix));

function sufixosEm(fs: CapsuleFs, dir: string, base: string): string[] {
  let nomes: string[];
  try {
    nomes = fs.readdir(dir);
  } catch {
    return [];
  }
  return nomes.filter((n) => n.startsWith(base)).map((n) => n.slice(base.length));
}

/** Os sufixos que já existem para uma ROM, para a prévia dizer o que substitui. */
export function existingSuffixes(fs: CapsuleFs, dirs: CapsuleDirs, rom: string): Set<string> {
  const base = romBaseName(rom);
  const out = new Set<string>();
  for (const t of TIPOS) {
    for (const s of sufixosEm(fs, dirs[t.dir], base)) if (t.re.test(s)) out.add(s);
  }
  return out;
}

/** Lê do FS todos os arquivos de uma ROM, já com tamanho e hash. */
export async function collectRomFiles(fs: CapsuleFs, dirs: CapsuleDirs, rom: string): Promise<CapsuleFile[]> {
  const base = romBaseName(rom);
  const out: CapsuleFile[] = [];
  const vistos = new Set<string>();
  for (const t of TIPOS) {
    for (const suffix of sufixosEm(fs, dirs[t.dir], base)) {
      if (!t.re.test(suffix) || vistos.has(suffix)) continue;
      vistos.add(suffix);
      try {
        out.push(await capsuleFile(t.kind, suffix, fs.readFile(`${dirs[t.dir]}/${base}${suffix}`)));
      } catch {
        // arquivo ilegível: a cápsula sai sem ele
      }
    }
  }
  return out;
}

const BAK = ".antes-da-capsula";

/**
 * Grava os arquivos do plano sob o nome `rom`. Tudo ou nada.
 *
 * Cada arquivo que seria substituído é primeiro renomeado para um nome de
 * reserva. Se qualquer gravação falhar, o que foi escrito é apagado e as
 * reservas voltam ao lugar: restaurar uma cápsula nunca deixa a aventura pior
 * do que estava. Só com tudo gravado as reservas são removidas.
 */
export function writeRestore(
  fs: CapsuleFs,
  dirs: CapsuleDirs,
  rom: string,
  steps: readonly RestoreStep[],
  /**
   * Deixa a ROM só com o que o plano grava, tirando o que existe a mais. É o
   * que trocar de ramificação precisa: um ponto de retorno da outra linha do
   * tempo, deixado para trás, carregaria um jogo que não é o desta.
   */
  exact = false
): number {
  const base = romBaseName(rom);
  const reservas: string[] = [];
  const escritos: string[] = [];
  try {
    if (exact) {
      const gravados = new Set(steps.filter((s) => s.action === "write").map((s) => s.file.suffix));
      for (const suffix of existingSuffixes(fs, dirs, rom)) {
        const tipo = tipoDe(suffix);
        // Captura de tela é foto, não estado do jogo: fica em qualquer ramificação.
        if (!tipo || tipo.kind === "screenshot" || gravados.has(suffix)) continue;
        const path = `${dirs[tipo.dir]}/${base}${suffix}`;
        fs.rename(path, path + BAK);
        reservas.push(path);
      }
    }
    for (const step of steps) {
      if (step.action !== "write") continue;
      const tipo = tipoDe(step.file.suffix);
      if (!tipo) continue;
      const path = `${dirs[tipo.dir]}/${base}${step.file.suffix}`;
      if (step.overwrites) {
        fs.rename(path, path + BAK);
        reservas.push(path);
      }
      fs.writeFile(path, fromBase64(step.file.base64));
      escritos.push(path);
    }
  } catch (error) {
    for (const path of escritos) {
      try {
        fs.unlink(path);
      } catch {
        // não chegou a existir
      }
    }
    for (const path of reservas) {
      try {
        fs.rename(path + BAK, path);
      } catch {
        // a reserva continua lá, com o nome de reserva
      }
    }
    throw error;
  }
  for (const path of reservas) {
    try {
      fs.unlink(path + BAK);
    } catch {
      // sobra um arquivo de reserva; não afeta o jogo
    }
  }
  return escritos.length;
}
