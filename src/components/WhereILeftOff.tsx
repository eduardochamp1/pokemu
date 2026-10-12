import { usePersonalAdventure } from "../lib/personalAdventures";
import { useTrainerEntries } from "../lib/trainerLog";
import { useLegacyAdventures } from "../lib/legacyAdventures";
import { useSession } from "../lib/sessions";
import { buildRecap, describeCounts } from "../lib/recap";
import { localeOf, tr, useLang } from "../i18n/lang";
import "../styles/journal.css";

/**
 * "Onde parei?" de uma aventura: o objetivo que está esperando, a última
 * nota e o que o leitor de save registrou na sessão mais recente.
 *
 * Só afirma o que o site viu. Quando o resumo vem do último save e não de uma
 * sessão registrada, a tela diz isso em vez de chamar de "última sessão".
 */
export default function WhereILeftOff({ rom }: { rom: string }) {
  const lang = useLang();
  const en = lang === "en";
  const t = (pt: string, enText: string) => tr(lang, pt, enText);
  const personal = usePersonalAdventure(rom);
  const gen3 = useTrainerEntries().find((e) => e.rom === rom);
  const legacy = useLegacyAdventures().find((e) => e.rom === rom);
  const session = useSession(rom);

  const events = gen3?.events ?? legacy?.events ?? [];
  const lastSaveAt = gen3?.updatedAt ?? legacy?.updatedAt;
  const recap = buildRecap({ goals: personal.goals, notes: personal.notes, events, session });
  const feitos = describeCounts(recap.counts, en);

  const data = (at: number) =>
    new Date(at).toLocaleString(localeOf(lang), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const curto = (texto: string) => (texto.length > 160 ? `${texto.slice(0, 157)}…` : texto);

  const vazio = !recap.pendingGoal && !recap.lastNote && !feitos && lastSaveAt === undefined;

  return (
    <section className="adventure-journal where-left-off" aria-label={t("Onde parei?", "Where did I leave off?")}>
      <h2>{t("Onde parei?", "Where did I leave off?")}</h2>
      {vazio ? (
        <p className="page-scope">
          {t(
            "Ainda não há nada para resumir. Salve dentro do jogo, ou anote um objetivo no diário, e ele aparece aqui.",
            "Nothing to summarize yet. Save in-game, or write a goal in the journal, and it shows up here."
          )}
        </p>
      ) : (
        <dl className="recap-list">
          {recap.pendingGoal && (
            <div>
              <dt>{t("Próximo objetivo", "Next goal")}</dt>
              <dd>
                {curto(recap.pendingGoal.text)}
                {recap.otherPending > 0 && (
                  <small> {t(`e mais ${recap.otherPending} em aberto`, `and ${recap.otherPending} more open`)}</small>
                )}
              </dd>
            </div>
          )}
          {recap.lastNote && (
            <div>
              <dt>{t("Última nota", "Last note")} · <time>{data(recap.lastNote.at)}</time></dt>
              <dd>{curto(recap.lastNote.text)}</dd>
            </div>
          )}
          {feitos && (
            <div>
              <dt>
                {recap.window === "current"
                  ? t("Nesta sessão", "This session")
                  : recap.window === "previous"
                    ? t("Na sessão anterior", "Last session")
                    : t("No último save lido", "In the last save read")}
                {recap.since !== undefined && <> · <time>{t("desde", "since")} {data(recap.since)}</time></>}
              </dt>
              <dd>{feitos}</dd>
            </div>
          )}
          {lastSaveAt !== undefined && (
            <div>
              <dt>{t("Último save lido", "Last save read")}</dt>
              <dd>{data(lastSaveAt)}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="trainer-sub">
        {t(
          "O resumo usa os saves que o site leu e o que você anotou. Ele não sabe em que lugar do jogo você está.",
          "The summary uses the saves the site has read and what you wrote down. It doesn't know where in the game you are."
        )}
      </p>
    </section>
  );
}
