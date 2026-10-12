import type { LegacyMon, LegacySave } from "../emulator/saveParse/legacy";
import { useT } from "../i18n/lang";
import PokemonMini from "./PokemonMini";
import "../styles/legacy.css";

function Member({ mon, generation }: { mon: LegacyMon; generation: 1 | 2 }) {
  const t = useT();
  return <li className="legacy-member">
    <PokemonMini id={mon.national} label={mon.nickname || `#${mon.national}`} sub={mon.egg ? t("Ovo", "Egg") : mon.level === null ? `#${mon.national}` : `${t("Nível", "Level")} ${mon.level}${mon.shiny ? " ✨" : ""}`} />
    <details>
      <summary>{t("Dados do save", "Save details")}</summary>
      {mon.stats && <p>HP {mon.stats.hp}/{mon.stats.maxHp} · ATK {mon.stats.atk} · DEF {mon.stats.def} · SPE {mon.stats.spe} · {generation === 1 ? `SPC ${mon.stats.special}` : `SPA ${mon.stats.spa} · SPD ${mon.stats.spd}`}</p>}
      <p>DVs: HP {mon.dvs.hp} · ATK {mon.dvs.atk} · DEF {mon.dvs.def} · SPE {mon.dvs.spe} · SPC {mon.dvs.special}</p>
      <p>{t("Experiência de status", "Stat experience")}: HP {mon.statExperience.hp} · ATK {mon.statExperience.atk} · DEF {mon.statExperience.def} · SPE {mon.statExperience.spe} · SPC {mon.statExperience.special}</p>
      <p>EXP {mon.experience.toLocaleString()} · OT {mon.originalTrainer} · ID {mon.trainerId}</p>
      {mon.friendship !== null && <p>{t("Amizade", "Friendship")}: {mon.friendship} · {t("Item (código Gen 2)", "Item (Gen 2 code)")}: {mon.heldItem || "—"}</p>}
      <p>{t("Golpes (número / PP)", "Moves (number / PP)")}: {mon.moves.map(m => `#${m.id} / ${m.pp} PP (${m.ppUps} PP Up)`).join(" · ") || "—"}</p>
    </details>
  </li>;
}
export default function LegacySavePanel({ save, showBoxes = false }: { save: LegacySave; showBoxes?: boolean }) {
  const t = useT();
  const trainer = save.trainer;
  return <section className="play-panel legacy-save">
    <h2>{save.playerName} · {save.game.charAt(0).toUpperCase() + save.game.slice(1)} · Gen {save.generation}</h2>
    <p>ID {trainer.trainerId} · {trainer.playTime.hours}h {trainer.playTime.minutes}m · ₽{trainer.money.toLocaleString()} · {t("Pokédex", "Pokédex")} {save.pokedex.owned.length}/{save.generation === 1 ? 151 : 251}</p>
    <p>{t("Insígnias", "Badges")}: {trainer.badges.filter(Boolean).length}/{trainer.badges.length}
      {save.generation === 2 && ` · Johto ${trainer.badges.slice(0, 8).filter(Boolean).length}/8 · Kanto ${trainer.badges.slice(8).filter(Boolean).length}/8`}</p>
    {save.source === "backup" && <p role="status">{t("O bloco principal está inválido. Estes dados foram recuperados da cópia de segurança do cartucho.", "The primary block is invalid. These data were recovered from the cartridge backup.")}</p>}
    <h3>{t("Seu time", "Your team")}</h3>
    {save.party.length ? <ul className="legacy-party">{save.party.map(mon => <Member key={mon.slot} mon={mon} generation={save.generation} />)}</ul> : <p>{t("Ainda não há Pokémon no time.", "No Pokémon in the party yet.")}</p>}
    <p className="play-panel-hint">{t("DVs vão de 0 a 15; experiência de status vai de 0 a 65.535. Estes jogos não têm naturezas nem habilidades.", "DVs range from 0 to 15; stat experience ranges from 0 to 65,535. These games have no natures or abilities.")}</p>
    {showBoxes && <details><summary>{t("PC — caixas do save", "PC — save boxes")}</summary>
      {save.boxes.boxes.map((box, i) => <details key={i}><summary>{box.name}{i === save.boxes.current ? ` · ${t("atual", "current")}` : ""} · {box.pokemon?.length ?? "?"}</summary>
        {box.pokemon === null ? <p>{t("Não foi possível validar esta caixa.", "This box could not be validated.")}</p> : box.pokemon.length ? <ul className="legacy-party">{box.pokemon.map(mon => <Member key={mon.slot} mon={mon} generation={save.generation} />)}</ul> : <p>{t("Vazia", "Empty")}</p>}
      </details>)}
    </details>}
  </section>;
}
