import { Link, NavLink } from "react-router-dom";
import ScanlineToggle from "./ScanlineToggle";
import { InstallButton } from "./AppStatus";
import LangToggle from "./LangToggle";
import { useT } from "../i18n/lang";
import { usePausedGame } from "../emulator/usePausedGame";

const classe = ({ isActive }: { isActive: boolean }) =>
  "nav-link" + (isActive ? " nav-link-active" : "");

const Navbar = () => {
  // Sair do emulador pausa o jogo, e nenhuma outra tela dizia isso.
  const pausado = usePausedGame();
  const t = useT();
  return (
    <nav className="navbar">
      <Link to="/" aria-label={t("Ir para o emulador", "Go to the emulator")} className="navbar-brand">
        <span className="navbar-pokeball" aria-hidden="true" />
        <span className="navbar-title">Pokemu</span>
      </Link>
      <div className="nav-links">
        <NavLink to="/" end className={classe}>
          {t("Emulador", "Emulator")}
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
          {t("Treinador", "Trainer")}
        </NavLink>
        <NavLink to="/ginasios" className={classe}>
          {t("Ginásios", "Gyms")}
        </NavLink>
        <NavLink to="/dano" className={classe}>
          {t("Dano", "Damage")}
        </NavLink>
        <NavLink to="/dados" className={classe}>
          {t("Dados", "Data")}
        </NavLink>
      </div>
      <LangToggle />
      <InstallButton />
      <ScanlineToggle />
    </nav>
  );
};

export default Navbar;
