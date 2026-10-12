import { useEffect, useMemo, useState } from "react";
import type { TrainerEntry } from "../lib/trainerLog";
import { loadCatalog, type Catalog } from "../lib/offlineCatalog";
import {
  coverageGaps,
  defensiveTable,
  labMonFromCatalog,
  sharedWeaknesses,
  suggestFromBox,
  type LabMon,
} from "../lib/teamLab";
import { tType } from "../data/i18n";
import { pokemonLabel } from "../lib/pokemonLabel";
import { tr, useLang } from "../i18n/lang";
import "../styles/teamLab.css";

/**
 * Laboratório do time: fraquezas que o time divide, o que ele não atinge bem
 * e quem do PC ajudaria. Lê o time e as caixas da ficha do save e os tipos do
 * catálogo embarcado — funciona sem rede.
 */
export default function TeamLab({ entry }: { entry?: TrainerEntry }) {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  useEffect(() => {
    let vivo = true;
    void loadCatalog().then((c) => {
      if (vivo) setCatalog(c);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const analise = useMemo(() => {
    if (!catalog || !entry?.team?.length) return null;
    const montar = (national: number, nickname: string, moves: { id: number }[]) =>
      labMonFromCatalog(catalog, national, nickname, moves.map((m) => m.id));
    const team = entry.team.flatMap((m) => montar(m.national, m.nickname, m.moves) ?? []);
    const box = entry.boxes.flatMap((b) =>
      b.pokemon.flatMap((m): LabMon[] => {
        const especie = catalog.species.find((s) => s[0] === m.national);
        const mon = montar(m.national, especie ? pokemonLabel(especie[1]) : m.nickname, []);
        return mon ? [mon] : [];
      })
    );
    const tabela = defensiveTable(team);
    const shared = sharedWeaknesses(tabela, team.length);
    return { team, shared, gaps: coverageGaps(team), suggestions: suggestFromBox(box, shared, team), boxCount: box.length };
  }, [catalog, entry]);

  const tipos = (lista: readonly string[]) => lista.map((x) => tType(x, lang)).join(", ");

  return (
    <section className="team-lab" aria-label={t("Laboratório do time", "Team lab")}>
      <h2>{t("Laboratório do time", "Team lab")}</h2>
      {!entry?.team?.length ? (
        <p className="page-scope">
          {t(
            "Com um save de Gen 3 lido, o time aparece aqui com as fraquezas em comum e a cobertura dos golpes.",
            "Once a Gen 3 save is read, the team shows up here with shared weaknesses and move coverage."
          )}
        </p>
      ) : !analise ? (
        <p className="page-scope">{t("Carregando os tipos…", "Loading types…")}</p>
      ) : (
        <>
          <h3>{t("Fraquezas em comum", "Shared weaknesses")}</h3>
          {analise.shared.length === 0 ? (
            <p>{t("Nenhum tipo derruba metade do time de uma vez.", "No single type hits half the team hard.")}</p>
          ) : (
            <ul className="team-lab-list">
              {analise.shared.map((r) => (
                <li key={r.type}>
                  <span className="lab-type" style={{ ["--type-fill" as string]: `var(--t-${r.type})` }}>
                    {tType(r.type, lang)}
                  </span>
                  <span>
                    {t("derruba", "hits")} {r.weak.join(", ")}
                    {r.resist.length + r.immune.length > 0
                      ? ` · ${t("seguram", "held by")}: ${[...r.immune, ...r.resist].join(", ")}`
                      : ` · ${t("ninguém resiste", "nobody resists")}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3>{t("Cobertura dos golpes", "Move coverage")}</h3>
          {analise.gaps.length === 0 ? (
            <p>{t("O time tem golpe super efetivo contra todos os tipos.", "The team has a super effective move against every type.")}</p>
          ) : (
            <p>
              {t("Sem golpe super efetivo contra: ", "No super effective move against: ")}
              {tipos(analise.gaps.filter((g) => g.best === 1).map((g) => g.type)) || "—"}
              {analise.gaps.some((g) => g.best < 1) && (
                <>
                  . {t("Só golpes resistidos contra: ", "Only resisted moves against: ")}
                  {tipos(analise.gaps.filter((g) => g.best < 1).map((g) => g.type))}
                </>
              )}
              .
            </p>
          )}

          <h3>{t("Quem do PC ajudaria", "Who in the PC would help")}</h3>
          {analise.shared.length === 0 ? (
            <p>{t("Sem fraqueza em comum, não há troca a sugerir.", "With no shared weakness there's no swap to suggest.")}</p>
          ) : analise.suggestions.length === 0 ? (
            <p>
              {analise.boxCount === 0
                ? t("O PC está vazio.", "The PC is empty.")
                : t("Ninguém no PC cobre essas fraquezas sem trazer outra.", "Nobody in the PC covers these weaknesses without adding another.")}
            </p>
          ) : (
            <ul className="team-lab-list">
              {analise.suggestions.map((s) => (
                <li key={s.mon.national}>
                  <strong>{s.mon.name}</strong>
                  <span>
                    {t("resiste a", "resists")} {tipos(s.covers)}
                    {s.alsoWeak.length > 0 && ` · ${t("mas é fraco a", "but weak to")} ${tipos(s.alsoWeak)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="trainer-sub">
            {t(
              "Leitura pela tabela de tipos da Gen 3. Não considera nível, status, habilidade nem item, e não simula a batalha.",
              "Read from the Gen 3 type chart. It ignores level, stats, ability and item, and does not simulate the battle."
            )}
          </p>
        </>
      )}
    </section>
  );
}
