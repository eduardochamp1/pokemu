import { useState } from "react";
import { Link } from "react-router-dom";
import { compareRomsChronologically, romRelease } from "../emulator/romChronology";
import { consoleOf } from "../emulator/types";
import { formatBytes } from "../emulator/storage";
import { usePersonalAdventures, updatePersonalAdventure } from "../lib/personalAdventures";
import { useTrainerEntries } from "../lib/trainerLog";
import { useLegacyAdventures } from "../lib/legacyAdventures";
import { useActiveAdventure } from "../lib/activeAdventure";
import {
  displayTitle,
  editionColor,
  progressSummary,
  resumeCandidate,
  type Progress,
} from "../lib/libraryView";
import { tr, useLang } from "../i18n/lang";
import "../styles/library.css";

interface LibraryGame { fileName: string; size?: number; local: boolean }
interface Props {
  games: LibraryGame[];
  currentRom?: string;
  loading: boolean;
  onPlay: (game: LibraryGame) => void;
  onContinue: () => void;
  onImport: () => void;
  onRefresh: () => void;
}

const SIGLA: Record<string, string> = {
  "Game Boy": "GB",
  "Game Boy Color": "GBC",
  "Game Boy Advance": "GBA",
};
const CLASSE: Record<string, string> = {
  "Game Boy": "is-gb",
  "Game Boy Color": "is-gbc",
  "Game Boy Advance": "is-gba",
};

/**
 * O progresso lido de cada ROM, das fichas de Gen 3 e de Gen 1/2.
 *
 * É o que o card mostra no lugar do tamanho do arquivo: "3 de 8 insígnias"
 * diz qual jogo é o seu; "16 MB" não diz nada.
 */
function useProgress(): { progress: Map<string, Progress>; lastSavedAt: Map<string, number> } {
  const gen3 = useTrainerEntries();
  const legacy = useLegacyAdventures();
  const progress = new Map<string, Progress>();
  const lastSavedAt = new Map<string, number>();
  const segundos = (t: { hours: number; minutes: number; seconds: number }) =>
    t.hours * 3600 + t.minutes * 60 + t.seconds;
  for (const e of gen3) {
    progress.set(e.rom, { badges: e.trainer.badges ?? [], playSeconds: segundos(e.trainer.playTime) });
    lastSavedAt.set(e.rom, e.updatedAt);
  }
  for (const e of legacy) {
    progress.set(e.rom, { badges: e.save.trainer.badges, playSeconds: segundos(e.save.trainer.playTime) });
    lastSavedAt.set(e.rom, e.updatedAt);
  }
  return { progress, lastSavedAt };
}

export default function GameLibrary({ games, currentRom, loading, onPlay, onContinue, onImport, onRefresh }: Props) {
  const lang = useLang();
  const en = lang === "en";
  const tx = (pt: string, enText: string) => tr(lang, pt, enText);
  const [search, setSearch] = useState("");
  const [consoleFilter, setConsoleFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [error, setError] = useState("");
  const personal = usePersonalAdventures();
  const activeRom = useActiveAdventure();
  const { progress, lastSavedAt } = useProgress();
  const favorites = new Set(personal.filter(entry => entry.favorite).map(entry => entry.rom));

  const visible = games
    .filter(game =>
      game.fileName.toLocaleLowerCase().includes(search.toLocaleLowerCase())
      && (!consoleFilter || consoleOf(game.fileName) === consoleFilter)
      && (!favoritesOnly || favorites.has(game.fileName)))
    .sort(compareRomsChronologically);
  const groups = new Map<string, LibraryGame[]>();
  for (const game of visible) {
    const year = romRelease(game.fileName)?.date.slice(0, 4) ?? "other";
    groups.set(year, [...(groups.get(year) ?? []), game]);
  }

  const retomar = resumeCandidate(games, currentRom, activeRom, lastSavedAt);
  const progressoDe = (rom: string) => {
    const p = progress.get(rom);
    return p ? progressSummary(p, en) : undefined;
  };
  const jogar = (game: LibraryGame) => (game.fileName === currentRom ? onContinue() : onPlay(game));

  return <section className="library-home" aria-label={tx("Biblioteca de jogos", "Game library")}>
    {/* Primeiro uso e uso recorrente são telas diferentes: quem já tem jogos
        quer voltar para um deles, não ler a apresentação de novo. */}
    {games.length === 0 ? (
      <div className="library-welcome">
        <div>
          <p className="library-eyebrow">{tx("Sua próxima aventura", "Your next adventure")}</p>
          <h2>{tx("Um lugar para todas as suas jornadas.", "A home for every journey.")}</h2>
          <p>{tx("Adicione um jogo para começar. O site não traz nenhum: você usa as suas ROMs.", "Add a game to get started. The site ships none: you bring your own ROMs.")}</p>
          <div className="library-actions">
            <button className="library-primary" onClick={onImport} disabled={loading}>{tx("Adicionar ROM", "Add ROM")}</button>
          </div>
        </div>
      </div>
    ) : retomar ? (
      <div className="library-resume" style={{ ["--edition" as string]: editionColor(retomar.fileName)?.color }}>
        <div>
          <small>
            {retomar.fileName === currentRom
              ? tx("Aventura em pausa", "Paused adventure")
              : tx("Continue de onde parou", "Pick up where you left off")}
          </small>
          <strong>{displayTitle(retomar.fileName)}</strong>
          <span>{progressoDe(retomar.fileName) ?? tx("Ainda sem save lido", "No save read yet")}</span>
        </div>
        <div className="library-resume-actions">
          <button className="library-primary" onClick={() => jogar(retomar)} disabled={loading}>
            {retomar.fileName === currentRom ? tx("Voltar ao jogo →", "Back to game →") : tx("Continuar →", "Continue →")}
          </button>
          <Link to="/treinador">{tx("Ver a aventura", "View adventure")}</Link>
        </div>
      </div>
    ) : null}

    <div className="library-toolbar">
      <label className="library-search"><span>{tx("Buscar jogo", "Find a game")}</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={tx("Nome do jogo…", "Game name…")} /></label>
      <label><span>{tx("Console", "Console")}</span><select value={consoleFilter} onChange={e => setConsoleFilter(e.target.value)}><option value="">{tx("Todos os consoles", "All consoles")}</option>{Object.keys(SIGLA).map(console => <option key={console}>{console}</option>)}</select></label>
      <button onClick={onRefresh}>{tx("Atualizar", "Refresh")}</button>
      <button onClick={onImport} disabled={loading}>+ {tx("Adicionar ROM", "Add ROM")}</button>
      <label className="library-favorites"><input type="checkbox" checked={favoritesOnly} onChange={event => setFavoritesOnly(event.target.checked)} />{tx("Só favoritos", "Favorites only")}</label>
    </div>
    {error && <p role="alert">{error}</p>}
    {games.length > 0 && <p className="library-order">
      {games.length} {games.length === 1 ? tx("jogo", "game") : tx("jogos", "games")} · {tx("em ordem de lançamento do título original.", "in order of the original title's release.")}
    </p>}

    {visible.length === 0 && games.length > 0 && (
      <div className="library-empty">
        <h3>{tx("Nenhum jogo encontrado", "No games found")}</h3>
        <p>{tx("Tente outro nome ou console.", "Try another name or console.")}</p>
        <button onClick={() => { setSearch(""); setConsoleFilter(""); setFavoritesOnly(false); }}>{tx("Limpar filtros", "Clear filters")}</button>
      </div>
    )}

    {[...groups].map(([year, entries]) => <section key={year} className="library-era">
      <div className="library-era-heading">
        <h3>{year === "other" ? tx("Mais aventuras · data não cadastrada", "More adventures · release unknown") : year}</h3>
        <span>{entries.length} {entries.length === 1 ? tx("jogo", "game") : tx("jogos", "games")}</span>
      </div>
      <div className="library-grid">{entries.map(game => {
        const title = displayTitle(game.fileName);
        const console = consoleOf(game.fileName);
        const edicao = editionColor(game.fileName);
        const feito = progressoDe(game.fileName);
        const atual = game.fileName === currentRom;
        return <div key={game.fileName} className="library-entry">
          <button className={"library-card" + (atual ? " is-current" : "")} onClick={() => onPlay(game)} disabled={loading} title={game.fileName}>
            <div
              className={"library-cartridge " + (CLASSE[console] ?? "is-gb") + (edicao ? " has-edition" : "")}
              style={edicao ? { ["--edition" as string]: edicao.color, ["--edition-ink" as string]: edicao.ink } : undefined}
              aria-hidden="true"
            >
              <span>{SIGLA[console] ?? "GB"}</span><strong>{title}</strong><i />
            </div>
            <div className="library-card-body">
              <span className="library-card-console">{console}</span>
              <h4>{title}</h4>
              <p>{feito ?? tx("Ainda sem save lido", "No save read yet")}</p>
              <div className="library-card-footer">
                <span>{game.size !== undefined ? formatBytes(game.size) : tx("Importado", "Imported")}</span>
                <strong>{atual ? tx("Continuar →", "Continue →") : tx("Jogar →", "Play →")}</strong>
              </div>
            </div>
          </button>
          <button className="library-favorite" aria-pressed={favorites.has(game.fileName)} aria-label={tx(`Favoritar ${game.fileName}`, `Favorite ${game.fileName}`)} onClick={() => {
            try { updatePersonalAdventure(game.fileName, { favorite: !favorites.has(game.fileName) }); setError(""); }
            catch { setError(tx("Não foi possível guardar o favorito.", "Could not save the favorite.")); }
          }}>{favorites.has(game.fileName) ? "★" : "☆"}</button>
        </div>;
      })}</div>
    </section>)}

    <div className="library-links">
      <Link to="/ajuda"><strong>{tx("Ajuda na jornada", "Journey help")}</strong><span>{tx("Consulte detonados e organize seus próximos objetivos.", "Read walkthroughs and organize your next goals.")}</span></Link>
      <Link to="/dados"><strong>{tx("Cuide do seu progresso", "Protect your progress")}</strong><span>{tx("Exporte e restaure os dados das suas aventuras.", "Export and restore your adventure data.")}</span></Link>
    </div>
  </section>;
}
