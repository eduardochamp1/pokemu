import { useState } from "react";
import { useLegacyAdventures } from "../lib/legacyAdventures";
import { useT } from "../i18n/lang";
import LegacySavePanel from "./LegacySavePanel";

export default function LegacyAdventures({ selectedRom }: { selectedRom?: string } = {}) {
  const entries = useLegacyAdventures();
  const [rom, setRom] = useState("");
  const t = useT();
  const entry = entries.find(e => e.rom === (selectedRom ?? rom)) ?? (selectedRom ? undefined : entries[0]);
  if (!entry) return null;
  return <section className="legacy-adventures">
    <h2>{t("Aventuras de Gen 1 e Gen 2", "Gen 1 and Gen 2 adventures")}</h2>
    {!selectedRom && <label>{t("Jogo", "Game")} <select value={entry.rom} onChange={e => setRom(e.target.value)}>
      {entries.map(e => <option key={e.rom} value={e.rom}>{e.rom.replace(/\.[^.]+$/, "")}</option>)}
    </select></label>}
    <LegacySavePanel save={entry.save} showBoxes />
    <details><summary>{t("Linha do tempo", "Timeline")} · {entry.events.length}</summary>
      <p>{t("O histórico começa na primeira leitura. Gen 1 e Gen 2 não têm um identificador individual confiável para rastrear evoluções automaticamente.", "History starts at the first reading. Gen 1 and Gen 2 have no reliable individual identifier for automatically tracking evolutions.")}</p>
      <ol>{[...entry.events].reverse().map((event, i) => <li key={`${event.at}-${i}`}>
        <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleString()}</time>{" · "}
        {event.kind === "start" ? t("Início do acompanhamento", "Tracking started") : event.kind === "captured" ? `${t("Capturou", "Caught")} #${event.value}` : event.kind === "badge" ? `${t("Ganhou a insígnia", "Earned badge")} #${(event.value ?? 0) + 1}` : t("Retomou um save anterior", "Returned to an earlier save")}
      </li>)}</ol>
    </details>
  </section>;
}
