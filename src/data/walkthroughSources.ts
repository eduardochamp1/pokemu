import { romRelease } from "../emulator/romChronology";

export interface WalkthroughSource {
  title: string;
  url: string;
  language: "pt" | "en";
  scope: string;
  scopeEn: string;
  note?: string;
  noteEn?: string;
}

const officialGroups = [
  { title: "Red / Blue", slug: "red-blue", wiki: "Red_and_Blue", orders: [0, 2] },
  { title: "Yellow", slug: "yellow", wiki: "Yellow", orders: [3] },
  { title: "Gold / Silver", slug: "gold-silver", wiki: "Gold_and_Silver", orders: [4, 5] },
  { title: "Crystal", slug: "crystal", wiki: "Crystal", orders: [6] },
  { title: "Ruby / Sapphire", slug: "ruby-sapphire", wiki: "Ruby_and_Sapphire", orders: [7, 8] },
  { title: "FireRed / LeafGreen", slug: "firered-leafgreen", wiki: "FireRed_and_LeafGreen", orders: [9, 10] },
  { title: "Emerald", slug: "emerald", wiki: "Emerald", orders: [11] },
];

/** Catálogo de links, sem copiar o conteúdo dos guias. Pesquisa: docs/levantamento-detonados.md.
 * Associação pelo nome estrito, nunca pelo cabeçalho compartilhado por ROM hacks.
 */
export function walkthroughSources(fileName: string): WalkthroughSource[] {
  const name = fileName.split(/[\\/]/).pop()!.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const release = romRelease(name);
  const group = officialGroups.find(group => group.orders.includes(release?.order ?? -1));
  if (group) return [
    { title: "Pokémon Mythology", url: `https://www.pokemythology.net/detonados/detonado-${group.slug}/`, language: "pt", scope: group.title, scopeEn: group.title,
      ...(group.slug === "emerald" ? { note: "Guia localizado; o acesso automático falhou no levantamento.", noteEn: "Guide located; automated access failed during research." } : {}) },
    { title: "Bulbapedia", url: `https://bulbapedia.bulbagarden.net/wiki/Walkthrough:Pok%C3%A9mon_${group.wiki}`, language: "en", scope: group.title, scopeEn: group.title },
  ];
  if (release?.order === 1) return [{ title: "GameFAQs — KeyBlade999", url: "https://gamefaqs.gamespot.com/gameboy/924467-pokemon-green/faqs/64468", language: "en", scope: "Green japonês / Midori", scopeEn: "Japanese Green / Midori", note: "Guia localizado na pesquisa; leitura integral ainda não verificada.", noteEn: "Guide found in search; full text has not been verified." }];
  if (/^pokemon[ -]+fire[ -]?red[ :_-]+rocket edition\s*(?:\([^)]*\)\s*)*\.gba$/i.test(name)) return [{ title: "ROM Hack Guides", url: "https://romhackguides.com/hacks/rocket-edition/walkthrough/", language: "en", scope: "FireRed: Rocket Edition", scopeEn: "FireRed: Rocket Edition", note: "Guia comunitário em 15 partes. Confirme a versão do hack; o guia registra lacunas.", noteEn: "Community guide in 15 parts. Check your hack version; the guide lists gaps." }];
  if (/^pokemon[ -]+unbound\s*(?:\([^)]*\)\s*)*\.gba$/i.test(name)) return [
    { title: "Unbound — Location Guide", url: "https://docs.google.com/spreadsheets/d/1PyGm-yrit5Ow6cns2tBA9VEMwLVMzn3YhDRipABjLUM/edit", language: "en", scope: "Unbound 2.1.1.1 · locais e itens", scopeEn: "Unbound 2.1.1.1 · locations and items", note: "Documentação vinculada pelo criador. Confira a versão da sua ROM.", noteEn: "Documentation linked by the creator. Check your ROM version." },
    { title: "Unbound — General Guide", url: "https://docs.google.com/spreadsheets/d/1LFSBZuPDtJrwAz7t6ZkJ-il4j8M3qCdaKLNe6EZdPmQ/edit", language: "en", scope: "Unbound 2.0+ · referência geral", scopeEn: "Unbound 2.0+ · general reference", note: "Referência complementar; não é um detonado narrativo completo.", noteEn: "Supplementary reference; not a complete story walkthrough." },
    { title: "Unbound — Trainer Teams", url: "https://docs.google.com/spreadsheets/d/1Ha06sD9mKw5yXXT2icVZjVQapcArU5C5gLEvA-hkq9o/edit", language: "en", scope: "Unbound 2.1.1.1 · treinadores", scopeEn: "Unbound 2.1.1.1 · trainers", note: "Confira também a dificuldade e o modo da partida.", noteEn: "Also check your difficulty and game mode." },
  ];
  return [];
}
