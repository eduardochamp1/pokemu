import { Link, NavLink } from "react-router-dom";
import ScanlineToggle from "./ScanlineToggle";
import { InstallButton } from "./AppStatus";
import LangToggle from "./LangToggle";
import { useT } from "../i18n/lang";
import { usePausedGame } from "../emulator/usePausedGame";
import { adventureLabel, useActiveAdventure } from "../lib/activeAdventure";

const classe = ({ isActive }: { isActive: boolean }) =>
  "nav-link" + (isActive ? " nav-link-active" : "");

const Navbar = () => {
  // Sair do emulador pausa o jogo, e nenhuma outra tela dizia isso.
  const pausado = usePausedGame();
  const t = useT();
  const ativa = useActiveAdventure();
  return (
    <nav className="navbar">
      <Link to="/" aria-label={t("Ir para a biblioteca", "Go to the library")} className="navbar-brand">
        <span className="navbar-pokeball" aria-hidden="true" />
        <span className="navbar-title">Pokemu</span>
      </Link>
      <div className="nav-links">
        <NavLink to="/" end className={classe}>
          {t("Jogos", "Games")}
          {pausado && (
            <span
              className="nav-paused"
              title={t(`${pausado} está pausado`, `${pausado} is paused`)}
              aria-label={t(`${pausado} está pausado`, `${pausado} is paused`)}
            >
              <span aria-hidden="true">❚❚</span>
            </span>
          )}
        </NavLink>
        <NavLink to="/treinador" className={classe}>
          {t("Aventuras", "Adventures")}
        </NavLink>
        <NavLink to="/ginasios" className={classe}>
          {t("Ginásios", "Gyms")}
        </NavLink>
        <NavLink to="/ajuda" className={classe}>{t("Ajuda", "Help")}</NavLink>
        <NavLink to="/dano" className={classe}>
          {t("Planejar batalhas", "Plan battles")}
        </NavLink>
        <NavLink to="/dados" className={classe}>
          {t("Backup", "Backup")}
        </NavLink>
      </div>
      <div className="nav-tail">
      {/* A aventura que as páginas estão usando, sempre à vista: é o que
          evita simular uma batalha com o time de outro jogo sem perceber. */}
      {ativa && (
        <Link to="/treinador" className="nav-adventure" title={t(`Aventura ativa: ${adventureLabel(ativa)}`, `Active adventure: ${adventureLabel(ativa)}`)}>
          <span className="visually-hidden">{t("Aventura ativa: ", "Active adventure: ")}</span>
          {adventureLabel(ativa)}
        </Link>
      )}
      <LangToggle />
      <InstallButton />
      <ScanlineToggle />
      </div>
    </nav>
  );
};

export default Navbar;
