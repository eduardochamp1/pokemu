import { useCallback, useMemo } from "react";
import { pickAdventure, setActiveAdventure, useActiveAdventure } from "../lib/activeAdventure";
import { Link } from "react-router-dom";
import PokedexLink from "../components/PokedexLink";
import { useTrainerEntries } from "../lib/trainerLog";
import {
  describeEvent,
  formatMoney,
  formatPlayTime,
  formatTrainerId,
} from "../lib/trainerText";
import { HOENN_TOWNS, hoennLocationName } from "../data/hoenn";
import { badgesOf, gameLabel, regionOfGame } from "../lib/gen3Game";
import { usePokemonIndex } from "../hooks/usePokemon";
import PokemonMini from "../components/PokemonMini";
import PcBoxes from "../components/PcBoxes";
import Achievements from "../components/Achievements";
import TrainerCardShare from "../components/TrainerCardShare";
import LegacyAdventures from "../components/LegacyAdventures";
import AdventureJournal from "../components/AdventureJournal";
import { usePersonalAdventures } from "../lib/personalAdventures";
import { useLegacyAdventures } from "../lib/legacyAdventures";
import { pokemonLabel } from "../lib/pokemonLabel";
import { TOTAL_DA_DEX_GEN3 } from "../lib/playerDex";
import "../styles/trainer.css";
import { localeOf, useLang, tr } from "../i18n/lang";

/**
 * A ficha do treinador e a linha do tempo da partida, lidas do save de um
 * jogo da 3ª geração e guardadas por `trainerLog`. Não carrega o emulador: a página vive
 * do que o `/jogar` gravou da última vez que leu o save.
 */
const TrainerPage = () => {
  const entries = useTrainerEntries();
  const legacyEntries = useLegacyAdventures();
  const personal = usePersonalAdventures();
  const activeRom = useActiveAdventure();
  const adventures = [
    ...entries.map(entry => ({ key: `gen3:${entry.rom}`, rom: entry.rom, updatedAt: entry.updatedAt })),
    ...legacyEntries.map(entry => ({ key: `legacy:${entry.rom}`, rom: entry.rom, updatedAt: entry.updatedAt })),
    ...personal.filter(entry => (entry.notes.length || entry.goals.length || entry.guide) && !entries.some(saved => saved.rom === entry.rom) && !legacyEntries.some(saved => saved.rom === entry.rom)).map(entry => ({ key: `personal:${entry.rom}`, rom: entry.rom, updatedAt: Math.max(0, ...entry.notes.map(note => note.at), ...entry.goals.map(goal => goal.at)) })),
  ].sort((a, b) => b.updatedAt - a.updatedAt);
  const selected = pickAdventure(adventures, activeRom).entry;
  const entry = selected?.key.startsWith("gen3:") ? entries.find(entry => entry.rom === selected.rom) : undefined;
  const lang = useLang();
  // `t` aqui é o treinador; a tradução se chama `tx`.
  const tx = (pt: string, en: string) => tr(lang, pt, en);
  const { index } = usePokemonIndex();

  /** Número nacional -> slug da PokéAPI, para link e nome. */
  const slugOf = useMemo(() => {
    const m = new Map<number, string>();
    for (const [name, id] of index ?? []) if (!m.has(id)) m.set(id, name);
    return m;
  }, [index]);
  const nameOf = useCallback(
    (n: number) => {
      const slug = slugOf.get(n);
      return slug ? pokemonLabel(slug) : `#${n}`;
    },
    [slugOf]
  );
  const slugDe = useCallback((n: number) => slugOf.get(n), [slugOf]);
  const selector = adventures.length > 0 && <label className="page-selector">
    {tx("Aventura acompanhada", "Tracked adventure")}
    <select value={selected?.key ?? ""} onChange={event => { const chosen = adventures.find(adventure => adventure.key === event.target.value); if (chosen) setActiveAdventure(chosen.rom); }}>
      {adventures.map(adventure => <option key={adventure.key} value={adventure.key}>{adventure.rom.replace(/\.[^.]+$/, "")}</option>)}
    </select>
  </label>;

  if (!entry) {
    return (
      <div className="trainer-shell">
        <header className="trainer-header">
          <h1>{tx("Minhas aventuras", "My adventures")}</h1>
          <span className="trainer-rom"><Link to="/treinador/comparar">{tx("Comparar saves da Gen 3", "Compare Gen 3 saves")}</Link></span>
        </header>
        {selector}
        <LegacyAdventures selectedRom={selected?.rom} />
        {selected && <AdventureJournal key={selected.rom} rom={selected.rom} />}
        {legacyEntries.length === 0 &&
        <p className="trainer-vazio">
          {tx("Ainda não há ficha. Ela nasce do save de", "No card yet. It comes from the save of")}{" "}
          <strong>{tx("um jogo de Gen 1, Gen 2 ou Gen 3 da biblioteca", "a Gen 1, Gen 2 or Gen 3 game from the library")}</strong>{" "}
          {tx("aberto em", "opened in")} <Link to="/">{tx("Biblioteca", "Library")}</Link>. {tx("Salve pelo menu do jogo para iniciar o acompanhamento.", "Save from the game's menu to start tracking.")}
        </p>}
      </div>
    );
  }

  const t = entry.trainer;
  const game = entry.game ?? "emerald";
  const regiao = regionOfGame(game);
  const segundos = t.playTime.hours * 3600 + t.playTime.minutes * 60 + t.playTime.seconds;
  const insignias = t.badges?.filter(Boolean).length;
  const lugar = t.location ? hoennLocationName(t.location.group, t.location.num) : undefined;
  const eventos = [...entry.events].reverse();

  return (
    <div className="trainer-shell">
      <header className="trainer-header">
        <h1>{tx("Minhas aventuras", "My adventures")}</h1>
        <span className="trainer-rom">
          {entry.rom.replace(/\.[^.]+$/, "")} · {gameLabel(game)} ·{" "}
          <Link to="/treinador/comparar">{tx("comparar saves", "compare saves")}</Link>
        </span>
      </header>

      {selector}
      <AdventureJournal key={entry.rom} rom={entry.rom} />
      <p className="trainer-sub">{tx("Dados da última gravação lida deste jogo. Troque a aventura acima para consultar outro progresso.", "Data from this game's last recorded save. Select another adventure above to view other progress.")}</p>

      <section className="trainer-card" aria-label={tx("Cartão de treinador", "Trainer card")}>
        <div className="trainer-card-nome">
          <span className="trainer-card-rotulo">{tx("Nome", "Name")}</span>
          <strong>
            {entry.playerName}{" "}
            <span aria-label={t.gender === "female" ? tx("feminino", "female") : tx("masculino", "male")}>
              {t.gender === "female" ? "♀" : "♂"}
            </span>
          </strong>
        </div>
        <dl className="trainer-card-dados">
          <div>
            <dt>ID</dt>
            <dd>{formatTrainerId(t.trainerId)}</dd>
          </div>
          <div>
            <dt>{tx("Tempo", "Time")}</dt>
            <dd>{formatPlayTime(segundos)}</dd>
          </div>
          {t.money !== null && (
            <div>
              <dt>{tx("Dinheiro", "Money")}</dt>
              <dd>{formatMoney(t.money)}</dd>
            </div>
          )}
          <div>
            <dt>Pokédex</dt>
            <dd>
              {entry.owned.length}
              <span className="trainer-de"> / {TOTAL_DA_DEX_GEN3}</span>
            </dd>
          </div>
          {insignias !== undefined && (
            <div>
              <dt>{tx("Insígnias", "Badges")}</dt>
              <dd>{insignias} / 8</dd>
            </div>
          )}
          {lugar && (
            <div>
              <dt>{tx("Salvo em", "Saved at")}</dt>
              <dd>{lugar}</dd>
            </div>
          )}
        </dl>
      </section>
      <TrainerCardShare entry={entry} />

      {game === "rs" && (
        <p className="trainer-sub">
          {tx(
            "Em Ruby/Sapphire o site lê time, Pokédex, PC e tempo de jogo; dinheiro e insígnias ficam de fora — não houve save desses jogos para medir onde eles ficam.",
            "In Ruby/Sapphire the site reads team, Pokédex, PC and play time; money and badges are left out — there was no save of those games to measure where they live."
          )}
        </p>
      )}

      <div className="trainer-grade">
        {t.badges && (
        <section>
          <h2>{tx("Insígnias", "Badges")}</h2>
          <ol className="trainer-insignias">
            {badgesOf(game).map((b, i) => (
              <li key={b.name} className={t.badges?.[i] ? "tem" : undefined}>
                <span className="trainer-insignia-marca" aria-hidden="true">
                  {t.badges?.[i] ? "◆" : "◇"}
                </span>
                <span>
                  <strong>{b.name}</strong>
                  <span className="trainer-sub">
                    {b.leader} · {b.city}
                  </span>
                </span>
                <span className="visually-hidden">
                  {t.badges?.[i] ? tx("conquistada", "earned") : tx("ainda não", "not yet")}
                </span>
              </li>
            ))}
          </ol>
        </section>
        )}

        {t.visitedTowns ? (
        <section>
          <h2>
            {tx("Cidades", "Towns")} <span className="trainer-de">{t.visitedTowns.length} / 16</span>
          </h2>
          <ul className="trainer-cidades">
            {HOENN_TOWNS.map((nome, i) => {
              const foi = t.visitedTowns?.includes(i);
              return (
                <li key={nome} className={foi ? "foi" : undefined}>
                  {nome}
                  <span className="visually-hidden">
                    {foi ? tx(" — visitada", " — visited") : tx(" — ainda não", " — not yet")}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="trainer-sub">
            <PokedexLink to="/mapa?region=hoenn">{tx("Ver Hoenn no mapa →", "See Hoenn on the map →")}</PokedexLink>
          </p>
        </section>
        ) : (
          <p className="trainer-sub">
            <PokedexLink to={`/mapa?region=${regiao}`}>
              {regiao === "kanto" ? tx("Ver Kanto no mapa →", "See Kanto on the map →") : tx("Ver Hoenn no mapa →", "See Hoenn on the map →")}
            </PokedexLink>
          </p>
        )}
      </div>

      <Achievements entry={entry} />

      <section>
        <h2>{tx("Time", "Team")}</h2>
        <div className="trainer-minis">
          {entry.party.map((m) => (
            <PokemonMini
              key={m.personality}
              id={m.national}
              label={m.nickname}
              sub={`${tx("nv", "lv")} ${m.level}`}
              slug={slugOf.get(m.national)}
            />
          ))}
        </div>
      </section>

      <PcBoxes boxes={entry.boxes} nameOf={nameOf} slugOf={slugDe} />

      <section>
        <h2>{tx("Linha do tempo", "Timeline")}</h2>
        <p className="trainer-sub">
          {tx(
            "Cada vez que o jogo salva, o site compara com o save anterior. O que veio antes do primeiro registro não tem como ser recuperado.",
            "Every time the game saves, the site compares it with the previous save. What happened before the first record can't be recovered."
          )}
        </p>
        <ol className="trainer-linha">
          {eventos.map((e, i) => (
            <li key={`${e.at}-${i}`} className={`trainer-evento trainer-evento-${e.kind}`}>
              <span className="trainer-evento-tempo">{formatPlayTime(e.playSeconds)}</span>
              <span className="trainer-evento-texto">{describeEvent(e, nameOf, lang, game)}</span>
              <time className="trainer-evento-data" dateTime={new Date(e.at).toISOString()}>
                {new Date(e.at).toLocaleString(localeOf(lang), {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};

export default TrainerPage;
