/** Primeiro lançamento de cada título, independentemente da região da ROM.
 * Datas: https://www.pokemon.co.jp/game/ e cronologia oficial da Nintendo:
 * https://www.nintendo.co.jp/topics/article_pdf/413f58f1-f52b-11e9-b641-063b7ac45a6d.html/00001812_20191101.pdf
 * O nome é uma indicação para organizar a biblioteca, não autentica a ROM.
 * Não usamos o cabeçalho: hacks podem compartilhar o código do jogo original.
 */
const RELEASES = [
  { title: "red", date: "1996-02-27" },
  { title: "green|midori", date: "1996-02-27" },
  { title: "blue", date: "1996-10-15" },
  { title: "yellow", date: "1998-09-12" },
  { title: "gold", date: "1999-11-21" },
  { title: "silver", date: "1999-11-21" },
  { title: "crystal", date: "2000-12-14" },
  { title: "ruby", date: "2002-11-21" },
  { title: "sapphire", date: "2002-11-21" },
  { title: "fire[ -]?red", date: "2004-01-29" },
  { title: "leaf[ -]?green", date: "2004-01-29" },
  { title: "emerald", date: "2004-09-16" },
].map(({ title, date }, order) => ({
  date,
  order,
  // Aceita nomes simples e nomes de dumps com região/revisão entre parênteses.
  // Um sufixo como "Rocket Edition" não corresponde ao título oficial.
  pattern: new RegExp(`^(?:pokemon|pocket monsters)[ -]+(?:${title})(?: version)?(?: - special pikachu edition)?\\s*(?:\\([^)]*\\)\\s*)*\\.(?:gb|gbc|gba)$`, "i"),
}));

export function romRelease(fileName: string) {
  const name = fileName.split(/[\\/]/).pop()!.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return RELEASES.find(({ pattern }) => pattern.test(name));
}

export function compareRomsChronologically(a: { fileName: string }, b: { fileName: string }): number {
  const first = romRelease(a.fileName);
  const second = romRelease(b.fileName);
  return (first?.date ?? "9999").localeCompare(second?.date ?? "9999")
    || (first?.order ?? 99) - (second?.order ?? 99)
    || a.fileName.localeCompare(b.fileName, "pt-BR", { numeric: true });
}
