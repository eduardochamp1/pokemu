import { romBaseName } from "./saveStates";

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
 * Devolve os arquivos renomeados (caminho antigo → novo).
 *
 * O padrão é ancorado nos sufixos que o core produz, e não em "começa com a
 * base": `Emerald (2).sav` começa com `Emerald` e não é desta ROM. E nunca
 * sobrescreve — se já existe um arquivo com o nome novo, o antigo fica onde
 * está, intacto.
 */
export function renameRomFiles(
  fs: FsLike,
  dirs: RomDirs,
  fromRom: string,
  toRom: string
): [string, string][] {
  const de = romBaseName(fromRom);
  const para = romBaseName(toRom);
  if (de === para) return [];

  const sufixo = new RegExp(
    `^${escapar(de)}(\\.sav|\\.ss\\d|_auto\\.ss|\\.ss\\d\\.png|-\\d{8}-\\d{6}\\.png)$`
  );
  const feitos: [string, string][] = [];
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
      if (existentes.has(novo)) continue;
      try {
        fs.rename(`${dir}/${nome}`, `${dir}/${novo}`);
        existentes.add(novo);
        feitos.push([`${dir}/${nome}`, `${dir}/${novo}`]);
      } catch {
        // um arquivo que não renomeia não impede os outros
      }
    }
  }
  return feitos;
}
