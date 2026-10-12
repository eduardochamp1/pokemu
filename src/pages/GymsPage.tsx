import { useEffect, useMemo, useState } from "react";
import { useLegacyAdventures } from "../lib/legacyAdventures";
import { legacyBattleTeam } from "../lib/legacyBattle";
import { loadCatalog, type Catalog } from "../lib/offlineCatalog";
import { JOHTO_BADGES, resolveJohtoGyms } from "../data/gymLeadersJohto";
import { Link } from "react-router-dom";
import { useMoveDetails, usePokemonIndex, usePokemonsByNames } from "../hooks/usePokemon";
import { useTrainerEntries, type TrainerEntry } from "../lib/trainerLog";
import { namesForIds } from "../lib/filters";
import { moveSlugById } from "../lib/teamSheet";
import { gen3MoveData, gen3PokemonTypes } from "../lib/gen3Damage";
import { nextGym, prepareForGym, rankForGym, type BattleMember } from "../lib/gymGuide";
import { EMERALD_GYMS, FRLG_GYMS, type Gym } from "../data/gymLeaders";
import { badgesOf } from "../lib/gen3Game";
import { prettyMoveName } from "../lib/moves";
import { pokemonLabel } from "../lib/pokemonLabel";
import { tType } from "../data/i18n";
import PokemonMini from "../components/PokemonMini";
import { adventureLabel, pickAdventure, setActiveAdventure, useActiveAdventure } from "../lib/activeAdventure";
import { scenarioUrl } from "../lib/damageScenario";
import { useLang, tr } from "../i18n/lang";
import "../styles/trainer.css";
import "../styles/gyms.css";

type Jogo = "emerald" | "frlg" | "gsc";

/** O catálogo embarcado, carregado sob demanda: é o que resolve Johto. */
function useCatalog(ativo: boolean): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    if (!ativo || catalog) return;
    let vivo = true;
    void loadCatalog().then((c) => {
      if (vivo) setCatalog(c);
    });
    return () => {
      vivo = false;
    };
  }, [ativo, catalog]);
  return catalog;
}

/** O seu time do save como `BattleMember`: tipos e golpes de Gen 3. */
function useMeuTime(entry: TrainerEntry | undefined): BattleMember[] {
  const team = useMemo(() => entry?.team ?? [], [entry]);
  const { index } = usePokemonIndex();
  const nomes = useMemo(() => (index ? namesForIds(team.map((m) => m.national), index) : []), [team, index]);
  const { pokemons } = usePokemonsByNames(nomes);

  // Golpe que a espécie não lista vai pelo número: /move/{id} também responde.
  // `pokemons` sai filtrado enquanto carrega: casar pelo número, não pela posição.
  const especie = (national: number) => pokemons.find((p) => p.id === national);
  const chaves = team.map((m) => {
    const p = especie(m.national);
    return m.moves.map((mv) => (p ? moveSlugById(p.moves, mv.id) : undefined) ?? String(mv.id));
  });
  const golpes = useMoveDetails([...new Set(chaves.flat())]);

  return team.flatMap((m, i) => {
    const p = especie(m.national);
    if (!p) return [];
    return [
      {
        name: m.nickname,
        national: m.national,
        level: m.level,
        types: gen3PokemonTypes(p),
        moves: chaves[i].flatMap((k) => {
          const d = golpes[k];
          if (!d) return [];
          const g = gen3MoveData(d);
          return [{ slug: d.name, type: g.type, power: g.power }];
        }),
      },
    ];
  });
}

const mult = (m: number | null) => (m === null ? "—" : `×${String(m).replace(".", ",")}`);
const classe = (m: number | null, bom: boolean) =>
  m === null || m === 1 ? undefined : (m > 1) === bom ? "gym-bom" : "gym-ruim";

/**
 * Os oito ginásios do seu jogo: o time de cada líder como a decompilação
 * define, e o seu time do save contra ele.
 */
const GymsPage = () => {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const entries = useTrainerEntries();
  // Gen 2: o guia de Johto. Gen 1 fica de fora — a tabela de tipos era outra.
  const johto = useLegacyAdventures().filter(e => e.save.generation === 2);
  const activeRom = useActiveAdventure();
  const [escolhido, setEscolhido] = useState<Jogo | null>(null);
  // O jogo da aventura ativa manda; sem ela (ou se ela não tem guia), o do
  // save mais recente.
  const daAtiva = entries.find(entry => entry.rom === activeRom && (entry.game ?? "emerald") !== "rs");
  const ativaEmJohto = johto.some(e => e.rom === activeRom);
  const jogo: Jogo = escolhido
    ?? (ativaEmJohto ? "gsc" : (daAtiva ?? entries[0])?.game === "frlg" ? "frlg" : !daAtiva && !entries.length && johto.length ? "gsc" : "emerald");
  const catalog = useCatalog(jogo === "gsc");

  const gen3Compativeis = jogo === "gsc" ? [] : entries.filter(entry => (entry.game ?? "emerald") === jogo);
  const compatible: { rom: string }[] = jogo === "gsc" ? johto : gen3Compativeis;
  const { entry: escolhida, matched } = pickAdventure(compatible, activeRom);
  const entry = jogo === "gsc" ? undefined : gen3Compativeis.find(e => e.rom === escolhida?.rom);
  const legacy = jogo === "gsc" ? johto.find(e => e.rom === escolhida?.rom) : undefined;

  const gyms = jogo === "gsc" ? (catalog ? resolveJohtoGyms(catalog) : []) : jogo === "frlg" ? FRLG_GYMS : EMERALD_GYMS;
  const insignias = jogo === "gsc" ? JOHTO_BADGES : badgesOf(jogo);
  // Em Gen 2 o save tem 16 insígnias: as oito primeiras são as de Johto.
  const doSave = jogo === "gsc" ? (legacy ? legacy.save.trainer.badges.slice(0, 8) : null) : entry ? entry.trainer.badges : null;
  const proximo = nextGym(doSave);
  const timeGen3 = useMeuTime(entry);
  const meuTime = jogo === "gsc" ? (catalog && legacy ? legacyBattleTeam(catalog, legacy.save) : []) : timeGen3;

  return (
    <div className="trainer-shell">
      <header className="trainer-header">
        <h1>{t("Ginásios", "Gyms")}</h1>
        <label className="trainer-sub">
          {t("Jogo", "Game")}{" "}
          <select value={jogo} onChange={(e) => setEscolhido(e.target.value as Jogo)}>
            <option value="emerald">Emerald</option>
            <option value="frlg">FireRed/LeafGreen</option>
            <option value="gsc">Gold/Silver/Crystal</option>
          </select>
        </label>
      </header>
      <label className="page-selector">{t("Time da aventura", "Adventure team")}
        <select value={escolhida?.rom ?? ""} onChange={event => setActiveAdventure(event.target.value)} disabled={!compatible.length}>
          {!compatible.length && <option value="">{t("Sem save compatível — consultando os líderes", "No compatible save — viewing leaders")}</option>}
          {compatible.map(entry => <option key={entry.rom} value={entry.rom}>{entry.rom.replace(/\.[^.]+$/, "")}</option>)}
        </select>
      </label>
      {activeRom && !matched && escolhido === null && <p className="page-scope" role="status">{t(`A aventura ativa (${adventureLabel(activeRom)}) não tem guia de ginásios; mostrando ${escolhida ? adventureLabel(escolhida.rom) : "só os líderes"}.`, `The active adventure (${adventureLabel(activeRom)}) has no gym guide; showing ${escolhida ? adventureLabel(escolhida.rom) : "leaders only"}.`)}</p>}
      <p className="page-scope">{t("Guia disponível para Emerald, FireRed/LeafGreen e os oito líderes de Johto em Gold/Silver/Crystal. Só comparamos times de saves do jogo selecionado. Gen 1 e Ruby/Sapphire ainda não têm guia próprio.", "Guide available for Emerald and FireRed/LeafGreen. Only saves matching the selected game are compared. Gen 1, Gen 2 and Ruby/Sapphire do not yet have their own guide.")}</p>
      <p className="trainer-sub">
        {jogo === "gsc" ? t(
          "Times de Johto transcritos de memória da decompilação (pret/pokecrystal) e ainda não conferidos linha a linha. A conta usa a tabela de tipos da Gen 2, que é a mesma da Gen 3.",
          "Johto teams transcribed from memory of the decompilation (pret/pokecrystal), not yet checked line by line. The math uses the Gen 2 type chart, which matches Gen 3."
        ) : t(
          "Times tirados da decompilação (pret/pokeemerald e pret/pokefirered): a primeira luta de cada líder. Ruby/Sapphire têm times um pouco diferentes.",
          "Teams taken from the decompilation (pret/pokeemerald and pret/pokefirered): each leader's first battle. Ruby/Sapphire have slightly different teams."
        )}{" "}
        {meuTime.length === 0 && (
          <>
            {t("Com um save lido em", "With a save read in")} <Link to="/">{t("Biblioteca", "Library")}</Link>,{" "}
            {t("o seu time aparece contra cada líder.", "your team shows up against each leader.")}
          </>
        )}
      </p>

      <ol className="gyms">
        {gyms.map((g, i) => (
          <GymCard
            key={g.leader}
            gym={g}
            badge={insignias[i]?.name ?? ""}
            ganho={doSave?.[i] ?? false}
            proximo={doSave !== null && proximo === i}
            meuTime={meuTime}
            comCalculadora={jogo !== "gsc"}
          />
        ))}
      </ol>
    </div>
  );
};

interface CardProps {
  gym: Gym;
  badge: string;
  ganho: boolean;
  proximo: boolean;
  meuTime: BattleMember[];
  /** A calculadora de dano é de Gen 3: em Johto os atalhos para ela não aparecem. */
  comCalculadora: boolean;
}

const GymCard = ({ gym, badge, ganho, proximo, meuTime, comCalculadora }: CardProps) => {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const ranking = meuTime.length ? rankForGym(meuTime, gym) : [];
  // A ordem das colunas é a do time; o ranking só escolhe quem destacar.
  const destaque = ranking[0]?.member.name;
  // Só para o próximo ginásio: é o único que a pessoa está de fato preparando.
  const prep = proximo && meuTime.length ? prepareForGym(meuTime, gym) : null;

  return (
    <li className={`gym${proximo ? " gym-proximo" : ""}`}>
      <details open={proximo}>
        <summary>
          <span className="card-type-dot card-type-dot-lg" data-type={gym.type}>
            {tType(gym.type)}
          </span>
          <strong>{gym.leader}</strong>
          <span className="trainer-sub">
            {gym.city} · {badge}
          </span>
          {ganho && <span className="gym-ganho">✓ {t("insígnia", "badge")}</span>}
          {proximo && <span className="gym-ganho">{t("próximo", "next")}</span>}
        </summary>

        <div className="gym-corpo">
          {ranking.length > 0 && (
            <p>
              {t("Melhor escolha pelo tipo:", "Best pick by type:")} <strong>{destaque}</strong>
              {ranking[1] && ranking[1].score > 0 && (
                <>
                  {t(", depois ", ", then ")}
                  <strong>{ranking[1].member.name}</strong>
                </>
              )}
            </p>
          )}
          {prep && (
            <div className="gym-prep">
              <h3>{t("Preparação", "Preparation")}</h3>
              <ul>
                <li>
                  {prep.topLevel >= prep.aceLevel
                    ? t(
                        `Seu pokémon mais forte está no nível ${prep.topLevel}; o mais forte do líder, no ${prep.aceLevel}.`,
                        `Your strongest is level ${prep.topLevel}; the leader's strongest is ${prep.aceLevel}.`
                      )
                    : t(
                        `O mais forte do líder está no nível ${prep.aceLevel}, ${prep.aceLevel - prep.topLevel} acima do seu melhor (${prep.topLevel}).`,
                        `The leader's strongest is level ${prep.aceLevel}, ${prep.aceLevel - prep.topLevel} above your best (${prep.topLevel}).`
                      )}
                </li>
                {prep.uncovered.length > 0 && (
                  <li>
                    {t("Sem golpe super efetivo contra: ", "No super effective move against: ")}
                    {prep.uncovered.map((m) => pokemonLabel(m.species)).join(", ")}.
                  </li>
                )}
              </ul>
              {comCalculadora && <p className="trainer-sub">{t("Abrir na calculadora de dano:", "Open in the damage calculator:")}</p>}
              {comCalculadora && <ul className="gym-prep-links">
                {prep.scenarios.map((s, k) => (
                  <li key={k}>
                    <Link to={scenarioUrl(s.attackerIndex, s.defender.species, s.defender.level)}>
                      {s.attacker} × {pokemonLabel(s.defender.species)} {t("nv", "lv")} {s.defender.level}
                    </Link>
                  </li>
                ))}
              </ul>}
            </div>
          )}
          <div className="gym-tabela-rolagem">
            <table className="gym-tabela">
              <thead>
                <tr>
                  <th scope="col">{t("Time do líder", "Leader's team")}</th>
                  {meuTime.map((m) => (
                    <th scope="col" key={m.name + m.national} className={m.name === destaque ? "gym-destaque" : undefined}>
                      {m.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gym.party.map((mon, j) => (
                  <tr key={j}>
                    <th scope="row">
                      <div className="gym-mon">
                        <PokemonMini id={mon.national} label={pokemonLabel(mon.species)} sub={`${t("nv", "lv")} ${mon.level}`} slug={mon.species} />
                        <div>
                          <p className="gym-tipos">
                            {mon.types.map((ty) => (
                              <span key={ty} className="card-type-dot card-type-dot-lg" data-type={ty}>
                                {tType(ty)}
                              </span>
                            ))}
                          </p>
                          <p className="trainer-sub">{mon.moves.map((mv) => prettyMoveName(mv.slug)).join(" · ")}</p>
                          <p className="trainer-sub">
                            IV {mon.iv}
                            {mon.item ? ` · ${prettyMoveName(mon.item)}` : ""}
                          </p>
                        </div>
                      </div>
                    </th>
                    {ranking.length > 0 &&
                      meuTime.map((m) => {
                        const r = ranking.find((x) => x.member === m)!.matchups[j];
                        return (
                          <td key={m.name + m.national}>
                            <span className={classe(r.offense.mult, true)} title={r.offense.move ? prettyMoveName(r.offense.move) : undefined}>
                              {t("bate", "hits")} {mult(r.offense.mult)}
                              {r.offense.move && <span className="gym-golpe"> {prettyMoveName(r.offense.move)}</span>}
                            </span>
                            <span className={classe(r.defense.mult, false)}>
                              {t("apanha", "takes")} {mult(r.defense.mult)}
                              {r.defense.move && <span className="gym-golpe"> {prettyMoveName(r.defense.move)}</span>}
                            </span>
                          </td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </li>
  );
};

export default GymsPage;
