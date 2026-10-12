import { useState } from "react";
import { hintFamilyOf, hintsFor } from "../data/hints";
import { nextGym } from "../lib/gymGuide";
import { tr, useLang } from "../i18n/lang";
import "../styles/journal.css";

interface Props {
  rom: string;
  /** Insígnias do último save lido, quando há. */
  badges?: boolean[];
}

/**
 * Dicas em três níveis para a próxima insígnia: uma pista, depois o próximo
 * passo, depois a solução. Cada nível só aparece quando a pessoa pede — quem
 * quer só um empurrão não lê o resto sem querer.
 *
 * A etapa sugerida é a primeira insígnia que falta no último save lido. É um
 * palpite: insígnias não dizem onde exatamente a pessoa travou, então dá para
 * trocar de etapa à mão.
 */
export default function ProgressiveHints({ rom, badges }: Props) {
  const lang = useLang();
  const en = lang === "en";
  const t = (pt: string, enText: string) => tr(lang, pt, enText);
  const family = hintFamilyOf(rom);
  const sugerida = nextGym(badges ?? null) ?? 7;
  const [etapa, setEtapa] = useState<number | null>(null);
  const [nivel, setNivel] = useState(0);

  if (!family) {
    return (
      <section className="adventure-journal">
        <h2>{t("Dicas passo a passo", "Step-by-step hints")}</h2>
        <p className="page-scope">
          {t(
            "Ainda não há dicas próprias para este jogo. Elas existem para Emerald e FireRed/LeafGreen; para os outros, use os guias na internet acima ou cadastre um detonado.",
            "There are no built-in hints for this game yet. They exist for Emerald and FireRed/LeafGreen; for others, use the online guides above or add a walkthrough."
          )}
        </p>
      </section>
    );
  }

  const steps = hintsFor(family);
  const atual = steps[etapa ?? sugerida] ?? steps[0];
  const idx = en ? 1 : 0;
  const escolher = (i: number) => {
    setEtapa(i);
    setNivel(0);
  };
  const completo = badges?.every(Boolean) ?? false;

  return (
    <section className="adventure-journal" aria-label={t("Dicas passo a passo", "Step-by-step hints")}>
      <h2>{t("Dicas passo a passo", "Step-by-step hints")}</h2>
      <label className="page-selector">
        {t("Etapa", "Step")}
        <select value={atual.badge} onChange={(e) => escolher(Number(e.target.value))}>
          {steps.map((s) => (
            <option key={s.badge} value={s.badge}>
              {s.title[idx]}
              {badges?.[s.badge] ? ` ✓` : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="trainer-sub">
        {completo
          ? t("O último save lido já tem as oito insígnias.", "The last save read already has all eight badges.")
          : badges
            ? t(
                "Sugerida pela primeira insígnia que falta no último save lido. Troque acima se você travou em outro ponto.",
                "Suggested by the first missing badge in the last save read. Change it above if you're stuck elsewhere."
              )
            : t("Sem save lido: começando pela primeira. Troque acima se quiser.", "No save read: starting at the first. Change it above if you like.")}
      </p>

      <ol className="hint-levels">
        <li>
          <strong>{t("Pista", "Hint")}</strong>
          {nivel >= 1 ? <p>{atual.hint[idx]}</p> : <button type="button" onClick={() => setNivel(1)}>{t("Mostrar uma pista", "Show a hint")}</button>}
        </li>
        {nivel >= 1 && (
          <li>
            <strong>{t("Próximo passo", "Next step")}</strong>
            {nivel >= 2 ? <p>{atual.next[idx]}</p> : <button type="button" onClick={() => setNivel(2)}>{t("Mostrar o próximo passo", "Show the next step")}</button>}
          </li>
        )}
        {nivel >= 2 && (
          <li>
            <strong>{t("Solução", "Solution")}</strong>
            {nivel >= 3 ? <p>{atual.solution[idx]}</p> : <button type="button" onClick={() => setNivel(3)}>{t("Mostrar a solução", "Show the solution")}</button>}
          </li>
        )}
      </ol>
      {nivel > 0 && (
        <button type="button" className="journal-help" onClick={() => setNivel(0)}>
          {t("Esconder de novo", "Hide again")}
        </button>
      )}
      <p className="trainer-sub">{t("Texto próprio do Pokemu.", "Pokemu's own text.")}</p>
    </section>
  );
}
