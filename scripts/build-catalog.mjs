#!/usr/bin/env node
/**
 * Gera `src/data/catalog/gen3.json`: o essencial das 386 espécies e dos 354
 * golpes da 3ª geração, para o time, o dano e os ginásios funcionarem sem
 * rede e sem cache anterior da PokéAPI.
 *
 *   npm run catalog
 *
 * Os valores já saem "da época": tipos, habilidades, poder e tipo de golpe
 * como eram em Gen 3, resolvidos aqui a partir de `past_types`,
 * `past_abilities` e `past_values`. O catálogo é o plano B — com rede, o site
 * continua lendo a PokéAPI, que tem mais do que isto.
 *
 * Fonte: https://pokeapi.co (dados de Pokémon © Nintendo/Game Freak/Creatures).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "catalog", "gen3.json");
const API = "https://pokeapi.co/api/v2";
const ESPECIES = 386;
const GOLPES = 354;
const CONCURRENCY = 8;

const ROMANOS = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
const geracao = (nome) => ROMANOS[nome.replace("generation-", "")] ?? 0;
const GRUPOS_DA_GEN_3 = new Set(["ruby-sapphire", "emerald", "firered-leafgreen", "colosseum", "xd"]);
const DA_GEN_3_OU_ANTES = new Set([
  "red-green-japan", "blue-japan", "red-blue", "yellow", "gold-silver", "crystal",
  ...GRUPOS_DA_GEN_3,
]);
const idDaUrl = (url) => Number(url.match(/\/(\d+)\/?$/)?.[1]);

async function fetchJson(url, tentativas = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (error) {
      if (i >= tentativas) throw new Error(`${url}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
}

async function pool(ids, worker) {
  const out = new Array(ids.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < ids.length) {
        const i = cursor++;
        out[i] = await worker(ids[i]);
      }
    })
  );
  return out;
}

/** Os tipos até a Gen 3: a entrada de `past_types` de menor geração >= 3. */
function tiposDaGen3(p) {
  const antigo = (p.past_types ?? [])
    .filter((pt) => geracao(pt.generation.name) >= 3)
    .sort((a, b) => geracao(a.generation.name) - geracao(b.generation.name))[0];
  return [...(antigo ? antigo.types : p.types)].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
}

/** As habilidades da Gen 3: sem oculta, com o que `past_abilities` desfaz. */
function habilidadesDaGen3(p) {
  const porSlot = new Map();
  for (const a of p.abilities) if (!a.is_hidden) porSlot.set(a.slot, a.ability.name);
  const depois = (p.past_abilities ?? [])
    .map((e) => ({ e, g: geracao(e.generation.name) }))
    .filter((x) => x.g > 3)
    .sort((a, b) => a.g - b.g)[0];
  for (const a of depois?.e.abilities ?? []) {
    if (!a.is_hidden) porSlot.set(a.slot, a.ability?.name ?? null);
  }
  return [...porSlot.entries()].sort(([a], [b]) => a - b).flatMap(([, n]) => (n ? [n] : []));
}

/** Poder e tipo em Gen 3: a mudança mais antiga que veio depois dela. */
function golpeDaGen3(m, ordem) {
  const depois = (m.past_values ?? [])
    .filter((v) => !DA_GEN_3_OU_ANTES.has(v.version_group.name))
    .sort((a, b) => (ordem.get(a.version_group.name) ?? Infinity) - (ordem.get(b.version_group.name) ?? Infinity));
  const campo = (k) => {
    const achado = depois.find((v) => v[k] !== null && v[k] !== undefined);
    return achado ? achado[k] : m[k];
  };
  const tipo = depois.find((v) => v.type)?.type?.name ?? m.type.name;
  return { power: campo("power"), accuracy: campo("accuracy"), pp: campo("pp"), type: tipo };
}

const STATS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

/**
 * Os status base da Gen 3. A PokéAPI dá os de hoje, e trinta espécies das
 * primeiras gerações foram reforçadas depois (o Pikachu ganhou Defesa na
 * Gen 6). `past_stats` diz o valor que valia **até** cada geração; para a
 * Gen 3 vale a entrada da menor geração que seja 3 ou mais, campo a campo.
 */
function statusDaGen3(p) {
  const antigos = (p.past_stats ?? [])
    .filter((e) => geracao(e.generation.name) >= 3)
    .sort((a, b) => geracao(a.generation.name) - geracao(b.generation.name));
  return STATS.map((nome) => {
    const antes = antigos.find((e) => e.stats.some((s) => s.stat.name === nome));
    return antes ? antes.stats.find((s) => s.stat.name === nome).base_stat : p.stats.find((x) => x.stat.name === nome).base_stat;
  });
}

async function main() {
  console.log("Ordem dos grupos de versão…");
  const grupos = await fetchJson(`${API}/version-group?limit=200`);
  const detalhes = await pool(grupos.results, (g) => fetchJson(g.url));
  const ordem = new Map(detalhes.sort((a, b) => a.order - b.order).map((g, i) => [g.name, i]));

  console.log(`${GOLPES} golpes…`);
  const golpes = await pool(Array.from({ length: GOLPES }, (_, i) => i + 1), async (id) => {
    const m = await fetchJson(`${API}/move/${id}`);
    const g = golpeDaGen3(m, ordem);
    return [m.id, m.name, g.type, g.power, g.accuracy, g.pp, m.priority, m.damage_class.name];
  });

  console.log(`${ESPECIES} espécies…`);
  const especies = await pool(Array.from({ length: ESPECIES }, (_, i) => i + 1), async (id) => {
    const p = await fetchJson(`${API}/pokemon/${id}`);
    const stats = statusDaGen3(p);
    const learnset = p.moves
      .filter((m) => m.version_group_details.some((d) => GRUPOS_DA_GEN_3.has(d.version_group.name)))
      .map((m) => idDaUrl(m.move.url))
      .filter((n) => n >= 1 && n <= GOLPES)
      .sort((a, b) => a - b);
    return [p.id, p.name, tiposDaGen3(p), stats, habilidadesDaGen3(p), learnset];
  });

  const catalogo = {
    source: "https://pokeapi.co",
    generatedAt: new Date().toISOString().slice(0, 10),
    generation: 3,
    species: especies,
    moves: golpes,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(catalogo) + "\n");
  console.log(`Pronto: ${OUT} (${Math.round(JSON.stringify(catalogo).length / 1024)} kB)`);
}

main().catch((error) => {
  console.error(`\nFalhou: ${error.message}`);
  process.exit(1);
});
