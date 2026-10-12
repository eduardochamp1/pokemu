import { useState } from "react";
import { useLegacyAdventures } from "../lib/legacyAdventures";
import { compareLegacy, type LegacyRowKey } from "../lib/compareLegacy";
import { adventureLabel } from "../lib/activeAdventure";
import { formatMoney, formatPlayTime } from "../lib/trainerText";
import PokemonMini from "./PokemonMini";
import { tr, useLang } from "../i18n/lang";

const ROTULOS: Record<LegacyRowKey, [pt: string, en: string]> = {
  owned: ["Capturados", "Caught"],
  seen: ["Vistos", "Seen"],
  badges: ["Insígnias", "Badges"],
  topLevel: ["Maior nível do time", "Highest team level"],
  pc: ["Pokémon no PC", "Pokémon in the PC"],
  time: ["Tempo de jogo", "Play time"],
  money: ["Dinheiro", "Money"],
};

/**
 * Comparar dois saves de Gen 1 ou Gen 2, entre as aventuras que o site já
 * leu. Fica separado da comparação de Gen 3, que tem conquistas, natureza e
 * leitura de arquivo `.sav` na hora.
 */
export default function LegacyCompare() {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const aventuras = useLegacyAdventures();
  const [romA, setRomA] = useState("");
  const [romB, setRomB] = useState("");

  if (aventuras.length < 2) {
    return (
      <section aria-labelledby="savecmp-legacy">
        <h2 id="savecmp-legacy">{t("Gen 1 e Gen 2", "Gen 1 and Gen 2")}</h2>
        <p className="trainer-vazio">
          {t(
            "Para comparar saves de Gen 1 ou Gen 2, o site precisa ter lido pelo menos dois: jogue e salve dentro de cada jogo.",
            "To compare Gen 1 or Gen 2 saves, the site needs to have read at least two: play and save in each game."
          )}
        </p>
      </section>
    );
  }

  const a = aventuras.find((e) => e.rom === romA) ?? aventuras[0];
  const b = aventuras.find((e) => e.rom === romB && e.rom !== a.rom) ?? aventuras.find((e) => e.rom !== a.rom)!;
  const cmp = compareLegacy(a.save, b.save);

  const formatar = (key: LegacyRowKey, v: number | null) =>
    v === null ? "—" : key === "time" ? formatPlayTime(v) : key === "money" ? formatMoney(v, lang) : String(v);
  const seletor = (rotulo: string, valor: string, outro: string, mudar: (rom: string) => void) => (
    <label className="page-selector">
      {rotulo}
      <select value={valor} onChange={(e) => mudar(e.target.value)}>
        {aventuras
          .filter((e) => e.rom !== outro)
          .map((e) => (
            <option key={e.rom} value={e.rom}>
              {adventureLabel(e.rom)} · {e.save.playerName}
            </option>
          ))}
      </select>
    </label>
  );

  return (
    <section aria-labelledby="savecmp-legacy">
      <h2 id="savecmp-legacy">{t("Gen 1 e Gen 2", "Gen 1 and Gen 2")}</h2>
      <div className="savecmp-lados">
        {seletor("A", a.rom, b.rom, setRomA)}
        {seletor("B", b.rom, a.rom, setRomB)}
      </div>
      <table className="savecmp-tabela">
        <thead>
          <tr>
            <th scope="col"><span className="visually-hidden">{t("Dado", "Stat")}</span></th>
            <th scope="col">A · {a.save.playerName}</th>
            <th scope="col">B · {b.save.playerName}</th>
          </tr>
        </thead>
        <tbody>
          {cmp.rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{ROTULOS[r.key][lang === "en" ? 1 : 0]}</th>
              <td className={r.ahead === "a" ? "frente" : undefined}>
                {formatar(r.key, r.a)}
                {r.ahead === "a" && <span className="visually-hidden">{t(" (à frente)", " (ahead)")}</span>}
              </td>
              <td className={r.ahead === "b" ? "frente" : undefined}>
                {formatar(r.key, r.b)}
                {r.ahead === "b" && <span className="visually-hidden">{t(" (à frente)", " (ahead)")}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {a.save.generation !== b.save.generation && (
        <p className="trainer-sub">
          {t(
            "Gerações diferentes: as insígnias aparecem, mas não dizem quem está à frente — são 8 num jogo e 16 no outro.",
            "Different generations: badges are shown but don't say who's ahead — there are 8 in one game and 16 in the other."
          )}
        </p>
      )}
      <div className="savecmp-lados">
        {[a, b].map((e, i) => (
          <div key={e.rom}>
            <h3>{i === 0 ? "A" : "B"} · {e.save.playerName}</h3>
            <div className="trainer-minis">
              {e.save.party.map((m) => (
                <PokemonMini
                  key={m.slot}
                  id={m.national}
                  label={m.nickname}
                  sub={m.egg ? t("ovo", "egg") : m.level === null ? "" : `${t("nv", "lv")} ${m.level}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="trainer-sub">
        {t("Só A capturou", "Only A caught")}: {cmp.onlyA.length} · {t("só B capturou", "only B caught")}: {cmp.onlyB.length} ·{" "}
        {t("os dois", "both")}: {cmp.both.length}
      </p>
    </section>
  );
}
