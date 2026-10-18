import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLegacyAdventures } from "../lib/legacyAdventures";
import { loadLegacyCatalog, type LegacyCatalog } from "../lib/legacyCatalog";
import {
  calcLegacyDamage,
  isSpecialType,
  legacyHitsToKo,
  legacyStatsFor,
} from "../lib/legacyDamage";
import { parseScenario } from "../lib/damageScenario";
import { adventureLabel, pickAdventure, setActiveAdventure, useActiveAdventure } from "../lib/activeAdventure";
import { pokemonLabel } from "../lib/pokemonLabel";
import { prettyMoveName } from "../lib/moves";
import { tType } from "../data/i18n";
import { tr, useLang } from "../i18n/lang";
import "../styles/teamLab.css";

/**
 * Calculadora de dano de Gen 1 e Gen 2: um pokémon do seu time, com os status
 * que o jogo gravou no save, contra uma espécie num nível.
 *
 * Os status do alvo são uma suposição, e a tela diz qual: o save não tem o
 * pokémon do adversário.
 */
export default function LegacyDamage() {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const aventuras = useLegacyAdventures();
  const activeRom = useActiveAdventure();
  const [params] = useSearchParams();
  // Sem a ativa entre as de Gen 1/2, nada de análise de outra campanha: só o
  // seletor, esperando a pessoa escolher.
  const { entry: escolhida, matched } = pickAdventure(aventuras, activeRom);
  const entry = matched ? escolhida : undefined;
  const generation = entry?.save.generation;

  const [catalog, setCatalog] = useState<LegacyCatalog | null>(null);
  useEffect(() => {
    if (!generation) return;
    let vivo = true;
    void loadLegacyCatalog(generation).then((c) => {
      if (vivo) setCatalog(c);
    });
    return () => {
      vivo = false;
    };
  }, [generation]);
  const pronto = catalog && catalog.generation === generation ? catalog : null;

  const lutadores = useMemo(() => entry?.save.party.filter((m) => !m.egg && m.stats && m.level !== null) ?? [], [entry]);
  const cenario = parseScenario(params, entry?.save.party.length ?? 0);
  // `null` = ninguém escolheu ainda: vale o cenário da URL, depois o primeiro.
  const [atacante, setAtacante] = useState<number | null>(null);
  const [golpe, setGolpe] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [nivel, setNivel] = useState<number | null>(null);
  const [dv, setDv] = useState(15);
  const [crit, setCrit] = useState(false);
  const [burned, setBurned] = useState(false);
  const [screen, setScreen] = useState(false);
  const [weather, setWeather] = useState<"none" | "rain" | "sun">("none");

  // Outra aventura é outro contexto: escolhas e condições da anterior não
  // valem para ela (o time, a geração e o clima podem ser outros).
  const [deQual, setDeQual] = useState(entry?.rom);
  if (deQual !== entry?.rom) {
    setDeQual(entry?.rom);
    setAtacante(null);
    setGolpe(null);
    setAlvo(null);
    setNivel(null);
    setDv(15);
    setCrit(false);
    setBurned(false);
    setScreen(false);
    setWeather("none");
  }

  if (aventuras.length === 0) return null;

  // O cenário da URL fala em posição no time inteiro; aqui a lista não tem ovos.
  const doCenario = cenario.atk !== undefined && entry ? lutadores.indexOf(entry.save.party[cenario.atk]) : -1;
  const membro = (atacante !== null ? lutadores[atacante] : undefined) ?? lutadores[doCenario] ?? lutadores[0];
  const meusGolpes = pronto && membro
    ? membro.moves.flatMap((mv) => {
        const g = pronto.moves.find((m) => m[0] === mv.id);
        return g && g[3] !== null ? [g] : [];
      })
    : [];
  const g = meusGolpes.find((m) => m[0] === golpe) ?? meusGolpes[0];
  const alvoDoCenario = pronto && cenario.def ? pronto.species.find((s) => s[1] === cenario.def!.slug)?.[0] : undefined;
  const especieAlvo = pronto?.species.find((s) => s[0] === (alvo ?? alvoDoCenario ?? 1));
  const nivelAlvo = nivel ?? cenario.def?.level ?? membro?.level ?? 50;
  const especieMinha = pronto && membro ? pronto.species.find((s) => s[0] === membro.national) : undefined;

  const statsAlvo = especieAlvo ? legacyStatsFor(especieAlvo[3], nivelAlvo, dv) : null;
  const resultado =
    pronto && membro?.stats && g && especieAlvo && especieMinha && statsAlvo
      ? (() => {
          const especial = isSpecialType(g[2]);
          const meuEspecial = membro.stats.spa ?? membro.stats.special ?? 0;
          return calcLegacyDamage({
            generation: pronto.generation,
            level: membro.level ?? 1,
            attack: especial ? meuEspecial : membro.stats.atk,
            defense: especial ? statsAlvo.spd : statsAlvo.def,
            power: g[3]!,
            moveType: g[2],
            moveSlug: g[1],
            attackerTypes: especieMinha[2],
            defenderTypes: especieAlvo[2],
            chart: pronto.chart,
            crit,
            burned,
            screen,
            weather: pronto.generation === 2 ? weather : "none",
          });
        })()
      : null;
  const ko = resultado && statsAlvo ? legacyHitsToKo(resultado, statsAlvo.hp) : null;
  const pct = (n: number) => (statsAlvo ? `${Math.round((n / statsAlvo.hp) * 100)}%` : "");

  return (
    <section className="ui-panel team-lab" aria-label={t("Dano de Gen 1 e Gen 2", "Gen 1 and Gen 2 damage")}>
      <h2>{t("Dano de Gen 1 e Gen 2", "Gen 1 and Gen 2 damage")}</h2>
      <div className="legacy-damage-form">
        <label>
          {t("Aventura", "Adventure")}
          <select value={entry?.rom ?? ""} onChange={(e) => setActiveAdventure(e.target.value)}>
            {!entry && <option value="">{t("Escolha uma aventura de Gen 1/2…", "Choose a Gen 1/2 adventure…")}</option>}
            {aventuras.map((a) => (
              <option key={a.rom} value={a.rom}>{adventureLabel(a.rom)}</option>
            ))}
          </select>
        </label>
        {!entry ? null : !pronto ? (
          <p className="page-scope">{t("Carregando os dados da geração…", "Loading the generation's data…")}</p>
        ) : lutadores.length === 0 ? (
          <p className="page-scope">{t("O save não tem pokémon com status gravados no time.", "The save has no party pokémon with recorded stats.")}</p>
        ) : (
          <>
            <label>
              {t("Atacante", "Attacker")}
              <select value={lutadores.indexOf(membro)} onChange={(e) => { setAtacante(Number(e.target.value)); setGolpe(null); }}>
                {lutadores.map((m, i) => (
                  <option key={m.slot} value={i}>{m.nickname} · {t("nv", "lv")} {m.level}</option>
                ))}
              </select>
            </label>
            <label>
              {t("Golpe", "Move")}
              <select value={g?.[0] ?? ""} onChange={(e) => setGolpe(Number(e.target.value))} disabled={!meusGolpes.length}>
                {!meusGolpes.length && <option value="">{t("Sem golpe de dano com poder fixo", "No damaging move with set power")}</option>}
                {meusGolpes.map((m) => (
                  <option key={m[0]} value={m[0]}>{prettyMoveName(m[1])} · {tType(m[2], lang)} · {m[3]}</option>
                ))}
              </select>
            </label>
            <label>
              {t("Alvo", "Target")}
              <select value={especieAlvo?.[0] ?? 1} onChange={(e) => setAlvo(Number(e.target.value))}>
                {pronto.species.map((s) => (
                  <option key={s[0]} value={s[0]}>#{String(s[0]).padStart(3, "0")} {pokemonLabel(s[1])}</option>
                ))}
              </select>
            </label>
            <label>
              {t("Nível do alvo", "Target level")}
              <input type="number" min={1} max={100} value={nivelAlvo} onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 1 && n <= 100) setNivel(n);
              }} />
            </label>
            <label>
              {t("DVs do alvo", "Target DVs")}
              <select value={dv} onChange={(e) => setDv(Number(e.target.value))}>
                <option value={15}>{t("Máximos (15)", "Maximum (15)")}</option>
                <option value={8}>{t("Medianos (8), como os de treinador", "Middling (8), like a trainer's")}</option>
                <option value={0}>{t("Mínimos (0)", "Minimum (0)")}</option>
              </select>
            </label>
            <label className="legacy-damage-check"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} />{t("Acerto crítico", "Critical hit")}</label>
            <label className="legacy-damage-check"><input type="checkbox" checked={burned} onChange={(e) => setBurned(e.target.checked)} />{t("Atacante queimado", "Attacker burned")}</label>
            <label className="legacy-damage-check"><input type="checkbox" checked={screen} onChange={(e) => setScreen(e.target.checked)} />{t("Reflect / Light Screen no alvo", "Reflect / Light Screen on target")}</label>
            {pronto.generation === 2 && (
              <label>
                {t("Clima", "Weather")}
                <select value={weather} onChange={(e) => setWeather(e.target.value as typeof weather)}>
                  <option value="none">{t("Nenhum", "None")}</option>
                  <option value="rain">{t("Chuva", "Rain")}</option>
                  <option value="sun">{t("Sol", "Sun")}</option>
                </select>
              </label>
            )}
          </>
        )}
      </div>

      {resultado && statsAlvo && especieAlvo && g && (
        <div role="status">
          <p className="legacy-damage-result">
            {resultado.max === 0
              ? t("Não tem efeito.", "It has no effect.")
              : `${resultado.min}–${resultado.max} ${t("de dano", "damage")} · ${pct(resultado.min)}–${pct(resultado.max)} ${t("do HP", "of HP")} (${statsAlvo.hp})`}
          </p>
          <p>
            {resultado.effectiveness !== 1 && resultado.max > 0 && `${t("Efetividade", "Effectiveness")} ×${String(resultado.effectiveness).replace(".", ",")} · `}
            {ko && (ko.guaranteed
              ? t(`Derruba em ${ko.hits} ${ko.hits === 1 ? "golpe" : "golpes"}.`, `Knocks out in ${ko.hits} ${ko.hits === 1 ? "hit" : "hits"}.`)
              : t(`Pode derrubar em ${ko.hits} ${ko.hits === 1 ? "golpe" : "golpes"}, com sorte na rolagem.`, `May knock out in ${ko.hits} ${ko.hits === 1 ? "hit" : "hits"}, with a good roll.`))}
          </p>
        </div>
      )}
      <p className="trainer-sub">
        {t(
          "Seu pokémon entra com os status gravados no save. O alvo é uma suposição: status da espécie no nível, com os DVs escolhidos e sem experiência de status. Não entram estágios de status, itens, bônus de insígnia nem golpes de dano fixo.",
          "Your pokémon uses the stats recorded in the save. The target is an assumption: species stats at that level, with the chosen DVs and no stat experience. Stat stages, items, badge boosts and fixed-damage moves are not included."
        )}
      </p>
    </section>
  );
}
