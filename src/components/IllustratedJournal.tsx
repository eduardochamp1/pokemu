import { useCallback, useMemo } from "react";
import { usePersonalAdventure } from "../lib/personalAdventures";
import { useTrainerEntries } from "../lib/trainerLog";
import { useLegacyAdventures, type LegacyEvent } from "../lib/legacyAdventures";
import { describeEvent } from "../lib/trainerText";
import { pokemonLabel } from "../lib/pokemonLabel";
import { buildTimeline } from "../lib/journalTimeline";
import { usePokemonIndex } from "../hooks/usePokemon";
import ScreenshotThumb from "./ScreenshotThumb";
import { localeOf, tr, useLang, type Lang } from "../i18n/lang";
import "../styles/journal.css";

interface Props {
  rom: string;
  /**
   * As capturas deste jogo e como ler a imagem de cada uma. Vêm do emulador;
   * fora dele (em Aventuras) ficam ausentes e o diário sai só com texto.
   */
  screenshots?: { fileName: string; when: Date }[];
  readScreenshot?: (fileName: string) => string | undefined;
}

function describeLegacyEvent(e: LegacyEvent, lang: Lang): string {
  const t = (pt: string, en: string) => tr(lang, pt, en);
  if (e.kind === "start") return t("Início do acompanhamento", "Tracking started");
  if (e.kind === "captured") return `${t("Capturou", "Caught")} #${e.value}`;
  if (e.kind === "badge") return `${t("Ganhou a insígnia", "Earned badge")} ${(e.value ?? 0) + 1}`;
  return t("Retomou um save anterior", "Returned to an earlier save");
}

/**
 * O diário da aventura numa cronologia: o que a pessoa escreveu, as fotos que
 * tirou e o que o leitor de save registrou, dia a dia.
 */
export default function IllustratedJournal({ rom, screenshots, readScreenshot }: Props) {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const personal = usePersonalAdventure(rom);
  const gen3 = useTrainerEntries().find((e) => e.rom === rom);
  const legacy = useLegacyAdventures().find((e) => e.rom === rom);
  const { index } = usePokemonIndex();

  const nameOf = useCallback(
    (national: number) => {
      for (const [name, id] of index ?? []) if (id === national) return pokemonLabel(name);
      return `#${national}`;
    },
    [index]
  );

  const dias = useMemo(() => {
    const events = gen3
      ? gen3.events.map((e) => ({ at: e.at, text: describeEvent(e, nameOf, lang, gen3.game ?? "emerald") }))
      : (legacy?.events ?? []).map((e) => ({ at: e.at, text: describeLegacyEvent(e, lang) }));
    return buildTimeline({
      notes: personal.notes,
      goals: personal.goals,
      events,
      screenshots: (screenshots ?? []).map((s) => ({ fileName: s.fileName, at: s.when.getTime() })),
    });
  }, [gen3, legacy, personal.notes, personal.goals, screenshots, nameOf, lang]);

  const total = dias.reduce((n, d) => n + d.items.length, 0);
  const hora = (at: number) => new Date(at).toLocaleTimeString(localeOf(lang), { hour: "2-digit", minute: "2-digit" });
  const data = (day: string) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(localeOf(lang), { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <section className="adventure-journal" aria-label={t("Diário ilustrado", "Illustrated journal")}>
      <details>
        <summary>
          {t("Diário ilustrado", "Illustrated journal")} · {total}
        </summary>
        {total === 0 ? (
          <p className="page-scope">
            {t(
              "Notas, objetivos, capturas de tela e o que o save registrar aparecem aqui, dia a dia.",
              "Notes, goals, screenshots and what the save records show up here, day by day."
            )}
          </p>
        ) : (
          <>
            <p className="trainer-sub">
              {t(
                "O que vem do save entra com a hora em que o site o leu, não a hora em que aconteceu no jogo.",
                "Save entries carry the time the site read the save, not when it happened in-game."
              )}
            </p>
            {dias.map((d) => (
              <div key={d.day} className="timeline-day">
                <h3>{data(d.day)}</h3>
                <ol>
                  {d.items.map((item, i) => (
                    <li key={`${item.kind}:${item.at}:${i}`} className={`timeline-item timeline-${item.kind}`}>
                      <time dateTime={new Date(item.at).toISOString()}>{hora(item.at)}</time>
                      {item.kind === "screenshot" ? (
                        readScreenshot ? (
                          <ScreenshotThumb fileName={item.fileName} read={readScreenshot} />
                        ) : (
                          <span>{t("Captura de tela", "Screenshot")}</span>
                        )
                      ) : (
                        <span>
                          <small>
                            {item.kind === "note"
                              ? t("Nota", "Note")
                              : item.kind === "goal"
                                ? item.done
                                  ? t("Objetivo concluído", "Goal done")
                                  : t("Objetivo", "Goal")
                                : t("Registrado no save", "Recorded in the save")}
                          </small>{" "}
                          {item.text}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </>
        )}
      </details>
    </section>
  );
}
