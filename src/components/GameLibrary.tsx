import { useState } from "react";
import { Link } from "react-router-dom";
import { compareRomsChronologically, romRelease } from "../emulator/romChronology";
import { consoleOf } from "../emulator/types";
import { formatBytes } from "../emulator/storage";
import { usePersonalAdventures, updatePersonalAdventure } from "../lib/personalAdventures";
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

export default function GameLibrary({ games, currentRom, loading, onPlay, onContinue, onImport, onRefresh }: Props) {
  const lang = useLang();
  const tx = (pt: string, en: string) => tr(lang, pt, en);
  const [search, setSearch] = useState("");
  const [consoleFilter, setConsoleFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [error, setError] = useState("");
  const personal = usePersonalAdventures();
  const favorites = new Set(personal.filter(entry => entry.favorite).map(entry => entry.rom));
  const visible = games.filter(game => game.fileName.toLocaleLowerCase().includes(search.toLocaleLowerCase())
    && (!consoleFilter || consoleOf(game.fileName) === consoleFilter) && (!favoritesOnly || favorites.has(game.fileName))).sort(compareRomsChronologically);
  const groups = new Map<string, LibraryGame[]>();
  for (const game of visible) {
    const year = romRelease(game.fileName)?.date.slice(0, 4) ?? "other";
    groups.set(year, [...(groups.get(year) ?? []), game]);
  }
  return <section className="library-home" aria-label={tx("Biblioteca de jogos", "Game library")}>
    <div className="library-welcome">
      <div>
        <p className="library-eyebrow">{tx("Sua próxima aventura", "Your next adventure")}</p>
        <h2>{tx("Um lugar para todas as suas jornadas.", "A home for every journey.")}</h2>
        <p>{tx("Escolha um jogo, continue seu progresso e acompanhe suas conquistas.", "Pick a game, continue your progress and follow your achievements.")}</p>
        <div className="library-actions">
          <button className="library-primary" onClick={currentRom ? onContinue : onImport} disabled={loading}>
            {currentRom ? tx("Continuar aventura", "Continue adventure") : tx("Adicionar ROM", "Add ROM")}
          </button>
          <Link to="/treinador">{tx("Minhas aventuras →", "My adventures →")}</Link>
        </div>
      </div>
      <div className="library-summary"><strong>{games.length}</strong><span>{tx("jogos na biblioteca", "games in your library")}</span><small>GB · GBC · GBA</small></div>
    </div>
    {currentRom && <div className="library-resume"><div><small>{tx("Aventura em pausa", "Paused adventure")}</small><strong>{currentRom}</strong></div><button onClick={onContinue}>{tx("Voltar ao jogo →", "Back to game →")}</button></div>}
    <div className="library-toolbar">
      <label className="library-search"><span>{tx("Buscar jogo", "Find a game")}</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={tx("Nome do jogo…", "Game name…")} /></label>
      <label><span>{tx("Console", "Console")}</span><select value={consoleFilter} onChange={e => setConsoleFilter(e.target.value)}><option value="">{tx("Todos os consoles", "All consoles")}</option>{["Game Boy", "Game Boy Color", "Game Boy Advance"].map(console => <option key={console}>{console}</option>)}</select></label>
      <button onClick={onRefresh}>{tx("Atualizar", "Refresh")}</button>
      <button onClick={onImport} disabled={loading}>+ {tx("Adicionar ROM", "Add ROM")}</button>
      <label className="library-favorites"><input type="checkbox" checked={favoritesOnly} onChange={event => setFavoritesOnly(event.target.checked)} />{tx("Só favoritos", "Favorites only")}</label>
    </div>
    {error && <p role="alert">{error}</p>}
    <p className="library-order">{tx("Do primeiro lançamento às novas jornadas. Datas do título original, independentemente da região da ROM.", "From the first release to new journeys. Original title release dates, regardless of ROM region.")}</p>
    {visible.length === 0 && <div className="library-empty"><h3>{games.length ? tx("Nenhum jogo encontrado", "No games found") : tx("Sua biblioteca começa aqui", "Your library starts here")}</h3><p>{games.length ? tx("Tente outro nome ou console.", "Try another name or console.") : tx("Adicione uma ROM ou coloque seus jogos na pasta de ROMs do aplicativo.", "Add a ROM or place your games in the app's ROM folder.")}</p>{games.length > 0 && <button onClick={() => {setSearch(""); setConsoleFilter(""); setFavoritesOnly(false);}}>{tx("Limpar filtros", "Clear filters")}</button>}</div>}
    {[...groups].map(([year, entries]) => <section key={year} className="library-era">
      <div className="library-era-heading"><h3>{year === "other" ? tx("Mais aventuras · data não cadastrada", "More adventures · release unknown") : year}</h3><span>{entries.length} {entries.length === 1 ? tx("jogo", "game") : tx("jogos", "games")}</span></div>
      <div className="library-grid">{entries.map(game => {
        const title = game.fileName.split(/[\\/]/).pop()!.replace(/\.(gb|gbc|gba)$/i, "").replace(/\s*\([^)]*\)/g, "").replace(/^(?:Pok[eé]mon|Pocket Monsters)\s*-?\s*/i, "");
        const console = consoleOf(game.fileName);
        return <div key={game.fileName} className="library-entry"><button className={"library-card" + (game.fileName === currentRom ? " is-current" : "")} onClick={() => onPlay(game)} disabled={loading}>
          <div className={"library-cartridge " + (console === "Game Boy Advance" ? "is-gba" : console === "Game Boy Color" ? "is-gbc" : "is-gb")} aria-hidden="true"><span>{console === "Game Boy Advance" ? "GBA" : console === "Game Boy Color" ? "GBC" : "GB"}</span><strong>{title}</strong><i /></div>
          <div className="library-card-body"><span className="library-card-console">{console}</span><h4>{title}</h4><p title={game.fileName}>{game.fileName}</p><div className="library-card-footer"><span>{game.size !== undefined ? formatBytes(game.size) : tx("Importado", "Imported")}</span><strong>{game.fileName === currentRom ? tx("Continuar →", "Continue →") : tx("Jogar →", "Play →")}</strong></div></div>
        </button><button className="library-favorite" aria-pressed={favorites.has(game.fileName)} aria-label={tx(`Favoritar ${game.fileName}`, `Favorite ${game.fileName}`)} onClick={() => {
          try { updatePersonalAdventure(game.fileName, { favorite: !favorites.has(game.fileName) }); setError(""); }
          catch { setError(tx("Não foi possível guardar o favorito.", "Could not save the favorite.")); }
        }}>{favorites.has(game.fileName) ? "★" : "☆"}</button></div>;
      })}</div>
    </section>)}
    <div className="library-links"><Link to="/ajuda"><strong>{tx("Ajuda na jornada", "Journey help")}</strong><span>{tx("Consulte detonados e organize seus próximos objetivos.", "Read walkthroughs and organize your next goals.")}</span></Link><Link to="/dados"><strong>{tx("Cuide do seu progresso", "Protect your progress")}</strong><span>{tx("Exporte e restaure os dados das suas aventuras.", "Export and restore your adventure data.")}</span></Link></div>
  </section>;
}
