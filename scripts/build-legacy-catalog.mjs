#!/usr/bin/env node
/**
 * Gera `src/data/catalog/gen1.json` e `gen2.json` a partir das decompilações
 * pret/pokered, pret/pokeyellow e pret/pokecrystal: espécies (tipos e status
 * base da época), golpes (tipo, poder, precisão, PP), a tabela de tipos e os
 * times dos líderes de ginásio.
 *
 *   npm run catalog:legacy
 *
 * Tudo sai do código-fonte dos jogos, não da memória de ninguém nem de uma
 * API que guarda os valores de hoje. Os nomes (slugs) vêm do catálogo de
 * Gen 3, pelo número da espécie e do golpe, que não mudou.
 *
 * Os golpes de um pokémon de treinador da Gen 1 não estão escritos em lugar
 * nenhum: o jogo os deriva do nível, como faz com um selvagem, e depois
 * aplica as exceções dos líderes. `movesAtLevel` repete essa conta.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "catalog");
const RAW = "https://raw.githubusercontent.com/pret";
const CONCURRENCY = 12;

async function texto(repo, path, tentativas = 4) {
  const url = `${RAW}/${repo}/master/${path}`;
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.text();
    } catch (error) {
      if (i >= tentativas) throw new Error(`${url}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

async function pool(items, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        out[i] = await worker(items[i], i);
      }
    })
  );
  return out;
}

const semComentario = (linha) => linha.replace(/;.*$/, "").trim();
// PSYCHIC_TYPE -> psychic; CURSE_TYPE (o "???" da Gen 2) -> unknown, como na PokéAPI.
const tipo = (t) => (t === "CURSE_TYPE" ? "unknown" : t.replace(/_TYPE$/, "").toLowerCase());
const MULT = { SUPER_EFFECTIVE: 2, NOT_VERY_EFFECTIVE: 0.5, NO_EFFECT: 0 };

/** `const NOME` em ordem -> ["NOME", ...], a partir do valor inicial do arquivo. */
function constantes(src, prefixo = "") {
  const out = [];
  for (const linha of src.split("\n")) {
    const m = semComentario(linha).match(/^const\s+([A-Z0-9_]+)$/);
    if (m && m[1].startsWith(prefixo)) out.push(m[1].slice(prefixo.length));
  }
  return out;
}

function tabelaDeTipos(src) {
  const out = [];
  for (const linha of src.split("\n")) {
    const m = semComentario(linha).match(/^db\s+([A-Z_]+),\s+([A-Z_]+),\s+([A-Z_]+)$/);
    if (m && m[3] in MULT) out.push([tipo(m[1]), tipo(m[2]), MULT[m[3]]]);
  }
  return out;
}

/** Linhas `move NOME, EFEITO, poder, TIPO, precisão, pp` na ordem dos ids. */
function golpes(src, slugs) {
  const out = [];
  for (const linha of src.split("\n")) {
    const m = semComentario(linha).match(/^move\s+([A-Z0-9_]+),\s+([A-Z0-9_]+),\s+(\d+),\s+([A-Z_]+),\s+(\d+),\s+(\d+)/);
    if (!m) continue;
    const id = out.length + 1;
    // Poder 0 ou 1 é golpe de status ou de dano especial. Na Gen 2, SonicBoom
    // e Dragon Rage guardam o próprio dano fixo (20 e 40) no campo do poder:
    // não é poder, e não entra na fórmula.
    const poder = Number(m[3]);
    const fixo = /STATIC_DAMAGE/.test(m[2]);
    out.push([id, slugs.get(id) ?? m[1].toLowerCase(), tipo(m[4]), poder > 1 && !fixo ? poder : null, Number(m[5]), Number(m[6])]);
  }
  return out;
}

const incluidos = (src) => [...src.matchAll(/INCLUDE "(data\/pokemon\/base_stats\/[a-z0-9_]+\.asm)"/g)].map((m) => m[1]);

function baseStats(src, colunas) {
  const linhas = src.split("\n").map(semComentario).filter(Boolean);
  const stats = linhas.find((l) => new RegExp(`^db\\s+\\d+(,\\s*\\d+){${colunas - 1}}$`).test(l));
  const tipos = linhas.find((l) => /^db\s+[A-Z_]+,\s+[A-Z_]+$/.test(l) && !/NO_ITEM|EGG_|NO_MOVE/.test(l));
  if (!stats || !tipos) throw new Error("base stats ilegível");
  const [a, b] = tipos.replace(/^db\s+/, "").split(/,\s*/).map(tipo);
  const level1 = linhas.find((l) => /^db\s+[A-Z0-9_]+(,\s*[A-Z0-9_]+){3}$/.test(l) && !/^db\s+\d/.test(l));
  return {
    stats: stats.replace(/^db\s+/, "").split(/,\s*/).map(Number),
    types: a === b ? [a] : [a, b],
    level1: level1 ? level1.replace(/^db\s+/, "").split(/,\s*/).filter((m) => m !== "NO_MOVE") : [],
  };
}

/** `XxxEvosMoves:` -> [[nível, GOLPE], ...]; a chave é o nome sem maiúsculas nem `_`. */
function learnsets(src) {
  const out = new Map();
  let atual = null;
  let noLearnset = false;
  for (const bruta of src.split("\n")) {
    const rotulo = bruta.match(/^([A-Za-z0-9]+)EvosMoves:/);
    if (rotulo) {
      atual = [];
      noLearnset = false;
      out.set(rotulo[1].toLowerCase(), atual);
      continue;
    }
    if (!atual) continue;
    if (/;\s*Learnset/i.test(bruta)) {
      noLearnset = true;
      continue;
    }
    const m = semComentario(bruta).match(/^db\s+(\d+),\s+([A-Z0-9_]+)$/);
    if (noLearnset && m) atual.push([Number(m[1]), m[2]]);
  }
  return out;
}

/**
 * Os golpes de um pokémon no nível dado, como o jogo monta: começa com os de
 * nível 1 e, a cada golpe do learnset até o nível, ocupa um espaço vazio ou
 * empurra a fila (sai o mais antigo). Golpe já conhecido não entra de novo.
 */
function movesAtLevel(level1, learnset, level) {
  const moves = [...level1];
  for (const [nivel, golpe] of learnset) {
    if (nivel > level || moves.includes(golpe)) continue;
    if (moves.length < 4) moves.push(golpe);
    else {
      moves.shift();
      moves.push(golpe);
    }
  }
  return moves;
}

const KANTO = [
  { leader: "Brock", city: "Pewter City", type: "rock", badge: "Boulder Badge", label: "Brock" },
  { leader: "Misty", city: "Cerulean City", type: "water", badge: "Cascade Badge", label: "Misty" },
  { leader: "Lt. Surge", city: "Vermilion City", type: "electric", badge: "Thunder Badge", label: "LtSurge" },
  { leader: "Erika", city: "Celadon City", type: "grass", badge: "Rainbow Badge", label: "Erika" },
  { leader: "Koga", city: "Fuchsia City", type: "poison", badge: "Soul Badge", label: "Koga" },
  { leader: "Sabrina", city: "Saffron City", type: "psychic", badge: "Marsh Badge", label: "Sabrina" },
  { leader: "Blaine", city: "Cinnabar Island", type: "fire", badge: "Volcano Badge", label: "Blaine" },
  { leader: "Giovanni", city: "Viridian City", type: "ground", badge: "Earth Badge", label: "Giovanni" },
];

/** A linha de party de um líder: a última do bloco (Giovanni tem três; a do ginásio é a terceira). */
function partyGen1(src, label) {
  const bloco = src.split(`${label}Data:`)[1]?.split(/\n[A-Za-z0-9]+Data:/)[0];
  if (!bloco) throw new Error(`party de ${label} não encontrada`);
  const linhas = bloco.split("\n").map(semComentario).filter((l) => /^db\s+\$FF/.test(l));
  const campos = linhas[linhas.length - 1].replace(/^db\s+\$FF,\s*/, "").split(/,\s*/);
  const party = [];
  for (let i = 0; i + 1 < campos.length; i += 2) party.push([Number(campos[i]), campos[i + 1]]);
  return party;
}

async function gen1(nome, repo, slugsDeGolpe, slugsDeEspecie) {
  console.log(`${nome}: constantes, golpes e tabela de tipos…`);
  const moveConst = constantes(await texto(repo, "constants/move_constants.asm")).filter((c) => c !== "NO_MOVE");
  const idDoGolpe = new Map(moveConst.map((c, i) => [c, i + 1]));
  const dex = constantes(await texto(repo, "constants/pokedex_constants.asm"), "DEX_");
  const dexDe = new Map(dex.map((c, i) => [c, i + 1]));
  const moves = golpes(await texto(repo, "data/moves/moves.asm"), slugsDeGolpe).slice(0, 165);
  const chart = tabelaDeTipos(await texto(repo, "data/types/type_matchups.asm"));

  console.log(`${nome}: 151 espécies…`);
  const arquivos = incluidos(await texto(repo, "data/pokemon/base_stats.asm")).slice(0, 151);
  // O Mew fica fora da tabela nesses jogos (foi acrescentado depois, em outro banco).
  if (arquivos.length === 150) arquivos.push("data/pokemon/base_stats/mew.asm");
  if (arquivos.length !== 151) throw new Error(`esperava 151 espécies, vieram ${arquivos.length}`);
  const bases = await pool(arquivos, async (path) => baseStats(await texto(repo, path), 5));
  const species = bases.map((b, i) => [i + 1, slugsDeEspecie.get(i + 1), b.types, b.stats]);

  const learn = learnsets(await texto(repo, "data/pokemon/evos_moves.asm"));
  const golpesDe = (constante, nivel) => {
    const n = dexDe.get(constante);
    const chave = constante.toLowerCase().replace(/_/g, "");
    if (!n || !learn.has(chave)) throw new Error(`sem learnset: ${constante}`);
    return movesAtLevel(bases[n - 1].level1, learn.get(chave), nivel);
  };

  const parties = await texto(repo, "data/trainers/parties.asm");
  const especiais = await texto(repo, "data/trainers/special_moves.asm");
  const gyms = KANTO.map((g, ordem) => {
    const party = partyGen1(parties, g.label).map(([nivel, constante]) => ({ constante, nivel, moves: golpesDe(constante, nivel) }));
    if (nome === "yellow") {
      // db CLASSE, id / db posição, espaço, GOLPE … / db 0
      const classe = g.label === "LtSurge" ? "LT_SURGE" : g.label.toUpperCase();
      const id = g.label === "Giovanni" ? 3 : 1;
      const bloco = especiais.split(new RegExp(`db ${classe}, ${id}\\n`))[1]?.split(/\n\s*db 0/)[0] ?? "";
      for (const linha of bloco.split("\n")) {
        const m = semComentario(linha).match(/^db\s+(\d+),\s+(\d+),\s+([A-Z0-9_]+)$/);
        if (m) party[Number(m[1]) - 1].moves[Number(m[2]) - 1] = m[3];
      }
    } else {
      // LoneMoves: a n-ésima linha é do n-ésimo líder; índice do pokémon a partir de 0,
      // e o golpe entra no terceiro espaço.
      const lone = [...especiais.split("LoneMoves:")[1].split("TeamMoves:")[0].matchAll(/db\s+(\d+),\s+([A-Z0-9_]+)/g)][ordem];
      party[Number(lone[1])].moves[2] = lone[2];
    }
    return {
      leader: g.leader,
      city: g.city,
      type: g.type,
      badge: g.badge,
      party: party.map((p) => [dexDe.get(p.constante), p.nivel, p.moves.filter(Boolean).map((m) => idDoGolpe.get(m))]),
    };
  });
  return { species, moves, chart, gyms };
}

const JOHTO_E_KANTO = [
  ["Falkner", "Violet City", "flying", "Zephyr Badge"],
  ["Bugsy", "Azalea Town", "bug", "Hive Badge"],
  ["Whitney", "Goldenrod City", "normal", "Plain Badge"],
  ["Morty", "Ecruteak City", "ghost", "Fog Badge"],
  ["Chuck", "Cianwood City", "fighting", "Storm Badge"],
  ["Jasmine", "Olivine City", "steel", "Mineral Badge"],
  ["Pryce", "Mahogany Town", "ice", "Glacier Badge"],
  ["Clair", "Blackthorn City", "dragon", "Rising Badge"],
  ["Brock", "Pewter City", "rock", "Boulder Badge"],
  ["Misty", "Cerulean City", "water", "Cascade Badge"],
  ["LtSurge", "Vermilion City", "electric", "Thunder Badge"],
  ["Erika", "Celadon City", "grass", "Rainbow Badge"],
  ["Janine", "Fuchsia City", "poison", "Soul Badge"],
  ["Sabrina", "Saffron City", "psychic", "Marsh Badge"],
  ["Blaine", "Cinnabar Island", "fire", "Volcano Badge"],
  ["Blue", "Viridian City", "normal", "Earth Badge"],
];

async function gen2(slugsDeGolpe, slugsDeEspecie) {
  const repo = "pokecrystal";
  console.log("crystal: constantes, golpes e tabela de tipos…");
  const moveConst = constantes(await texto(repo, "constants/move_constants.asm")).filter((c) => c !== "NO_MOVE");
  const idDoGolpe = new Map(moveConst.map((c, i) => [c, i + 1]));
  const monConst = constantes(await texto(repo, "constants/pokemon_constants.asm")).slice(0, 251);
  const dexDe = new Map(monConst.map((c, i) => [c, i + 1]));
  const moves = golpes(await texto(repo, "data/moves/moves.asm"), slugsDeGolpe).slice(0, 251);
  const chart = tabelaDeTipos(await texto(repo, "data/types/type_matchups.asm"));

  console.log("crystal: 251 espécies…");
  const arquivos = incluidos(await texto(repo, "data/pokemon/base_stats.asm")).slice(0, 251);
  const bases = await pool(arquivos, async (path) => baseStats(await texto(repo, path), 6));
  const species = bases.map((b, i) => [i + 1, slugsDeEspecie.get(i + 1), b.types, b.stats]);

  const parties = await texto(repo, "data/trainers/parties.asm");
  const gyms = JOHTO_E_KANTO.map(([label, city, type, badge]) => {
    const bloco = parties.split(`${label}Group:`)[1]?.split("db -1")[0];
    if (!bloco) throw new Error(`party de ${label} não encontrada`);
    const party = [];
    for (const linha of bloco.split("\n")) {
      const m = semComentario(linha).match(/^db\s+(\d+),\s+([A-Z0-9_]+),\s+(.+)$/);
      if (!m) continue;
      const ids = m[3].split(/,\s*/).filter((g) => g !== "NO_MOVE").map((g) => idDoGolpe.get(g));
      if (ids.some((x) => !x) || !dexDe.get(m[2])) throw new Error(`linha ilegível em ${label}: ${linha}`);
      party.push([dexDe.get(m[2]), Number(m[1]), ids]);
    }
    return { leader: label === "LtSurge" ? "Lt. Surge" : label, city, type, badge, party };
  });
  return { species, moves, chart, gyms };
}

async function main() {
  const base = JSON.parse(await readFile(join(OUT, "gen3.json"), "utf8"));
  const slugsDeEspecie = new Map(base.species.map((s) => [s[0], s[1]]));
  const slugsDeGolpe = new Map(base.moves.map((m) => [m[0], m[1]]));
  const hoje = new Date().toISOString().slice(0, 10);

  const rb = await gen1("red", "pokered", slugsDeGolpe, slugsDeEspecie);
  const yellow = await gen1("yellow", "pokeyellow", slugsDeGolpe, slugsDeEspecie);
  const g2 = await gen2(slugsDeGolpe, slugsDeEspecie);

  await mkdir(OUT, { recursive: true });
  const g1 = {
    source: "https://github.com/pret/pokered e https://github.com/pret/pokeyellow",
    generatedAt: hoje,
    generation: 1,
    species: rb.species,
    moves: rb.moves,
    chart: rb.chart,
    gyms: { rb: rb.gyms, yellow: yellow.gyms },
  };
  await writeFile(join(OUT, "gen1.json"), JSON.stringify(g1) + "\n");
  await writeFile(
    join(OUT, "gen2.json"),
    JSON.stringify({ source: "https://github.com/pret/pokecrystal", generatedAt: hoje, generation: 2, ...g2 }) + "\n"
  );
  console.log(`Pronto: gen1.json (${Math.round(JSON.stringify(g1).length / 1024)} kB) e gen2.json`);
}

main().catch((error) => {
  console.error(`\nFalhou: ${error.message}`);
  process.exit(1);
});
