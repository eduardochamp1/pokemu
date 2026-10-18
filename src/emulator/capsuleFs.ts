import { romBaseName } from "./saveStates";
import {
  capsuleFile,
  CapsuleIncompleteError,
  fromBase64,
  RollbackError,
  SUFFIX_KINDS,
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

/** Onde o core guarda cada tipo. O tipo vem da tabela única de `capsule.ts`. */
const DIR_DE: Record<CapsuleFileKind, keyof CapsuleDirs> = {
  save: "savePath",
  thumbnail: "screenshotsPath",
  screenshot: "screenshotsPath",
  state: "saveStatePath",
};

const TIPOS = SUFFIX_KINDS.map((t) => ({ ...t, dir: DIR_DE[t.kind] }));

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

/**
 * Lê do FS todos os arquivos de uma ROM, já com tamanho e hash. Um arquivo
 * listado que não dá para ler derruba a coleta com `CapsuleIncompleteError`:
 * uma cápsula sem o save não pode sair parecendo completa.
 */
export async function collectRomFiles(
  fs: CapsuleFs,
  dirs: CapsuleDirs,
  rom: string,
  /** Sem as capturas de tela: as ramificações não as levam. */
  opts: { screenshots?: boolean } = {}
): Promise<CapsuleFile[]> {
  const base = romBaseName(rom);
  const out: CapsuleFile[] = [];
  const vistos = new Set<string>();
  const falhas: string[] = [];
  for (const t of TIPOS) {
    for (const suffix of sufixosEm(fs, dirs[t.dir], base)) {
      if (!t.re.test(suffix) || vistos.has(suffix)) continue;
      if (opts.screenshots === false && t.kind === "screenshot") continue;
      vistos.add(suffix);
      try {
        out.push(await capsuleFile(t.kind, suffix, fs.readFile(`${dirs[t.dir]}/${base}${suffix}`)));
      } catch {
        falhas.push(suffix);
      }
    }
  }
  if (falhas.length > 0) throw new CapsuleIncompleteError(falhas);
  return out;
}

export const BAK = ".antes-da-capsula";

function existe(fs: CapsuleFs, path: string): boolean {
  const i = path.lastIndexOf("/");
  try {
    return fs.readdir(path.slice(0, i)).includes(path.slice(i + 1));
  } catch {
    return false;
  }
}

/**
 * As mudanças de arquivo de uma restauração, ainda sem fazer: o que vira
 * reserva (renomeado para `<nome>.antes-da-capsula`) e o que é gravado.
 * Quem substitui o quê é conferido no FS agora, não na prévia.
 */
export interface FileOps {
  /** Caminhos que existem e serão renomeados para a reserva. */
  reserve: string[];
  write: { path: string; base64: string }[];
}

export function planFileOps(
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
): FileOps {
  const base = romBaseName(rom);
  const reserve: string[] = [];
  const write: FileOps["write"] = [];
  const gravados = new Set(steps.filter((s) => s.action === "write").map((s) => s.file.suffix));
  if (exact) {
    for (const suffix of existingSuffixes(fs, dirs, rom)) {
      const tipo = tipoDe(suffix);
      // Captura de tela é foto, não estado do jogo: fica em qualquer ramificação.
      if (!tipo || tipo.kind === "screenshot" || gravados.has(suffix)) continue;
      reserve.push(`${dirs[tipo.dir]}/${base}${suffix}`);
    }
  }
  for (const step of steps) {
    if (step.action !== "write") continue;
    const tipo = tipoDe(step.file.suffix);
    if (!tipo) continue;
    const path = `${dirs[tipo.dir]}/${base}${step.file.suffix}`;
    if (existe(fs, path)) reserve.push(path);
    write.push({ path, base64: step.file.base64 });
  }
  return { reserve, write };
}

/** Faz as mudanças. Para no primeiro erro; desfazer é com `revertFileOps`. */
export function applyFileOps(fs: CapsuleFs, ops: FileOps): void {
  for (const path of ops.reserve) fs.rename(path, path + BAK);
  for (const { path, base64 } of ops.write) fs.writeFile(path, fromBase64(base64));
}

/**
 * Põe os arquivos como estavam antes de `applyFileOps`, a partir de qualquer
 * ponto em que ele tenha parado — ou de um FS que nunca o viu, depois de um
 * fechamento no meio. Decide pelo que existe: reserva presente volta ao
 * lugar; arquivo gravado sem reserva é apagado. Devolve o que não conseguiu.
 */
export function revertFileOps(fs: CapsuleFs, ops: FileOps): string[] {
  const falhas: string[] = [];
  const reservados = new Set(ops.reserve);
  for (const { path } of ops.write) {
    if (reservados.has(path) || !existe(fs, path)) continue;
    try {
      fs.unlink(path);
    } catch {
      falhas.push(path);
    }
  }
  for (const path of ops.reserve) {
    if (!existe(fs, path + BAK)) continue;
    try {
      if (existe(fs, path)) fs.unlink(path);
      fs.rename(path + BAK, path);
    } catch {
      falhas.push(path);
    }
  }
  return falhas;
}

/** Com tudo confirmado, as reservas saem. Uma que sobre não afeta o jogo. */
export function dropReserves(fs: CapsuleFs, ops: FileOps): void {
  for (const path of ops.reserve) {
    try {
      if (existe(fs, path + BAK)) fs.unlink(path + BAK);
    } catch {
      // sobra um arquivo de reserva; não afeta o jogo
    }
  }
}

/**
 * Grava os arquivos do plano sob o nome `rom`. Tudo ou nada, só no FS: se
 * qualquer gravação falhar, o que foi escrito é apagado e as reservas voltam
 * ao lugar; se nem isso der, sobe `RollbackError`. A restauração completa,
 * com registros, detonado e sincronização, é a de `restoreTx.ts`.
 */
export function writeRestore(
  fs: CapsuleFs,
  dirs: CapsuleDirs,
  rom: string,
  steps: readonly RestoreStep[],
  exact = false
): number {
  const ops = planFileOps(fs, dirs, rom, steps, exact);
  try {
    applyFileOps(fs, ops);
  } catch (error) {
    const falhas = revertFileOps(fs, ops);
    if (falhas.length > 0) throw new RollbackError(falhas, error);
    throw error;
  }
  dropReserves(fs, ops);
  return ops.write.length;
}
