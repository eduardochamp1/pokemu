import { useState } from "react";
import {
  RULES,
  areaUsed,
  endChallenge,
  levelCapFor,
  overCap,
  startChallenge,
  updateChallenge,
  useChallenge,
  type Challenge,
  type Encounter,
} from "../lib/challenge";
import { useTrainerEntries } from "../lib/trainerLog";
import { localeOf, tr, useLang } from "../i18n/lang";
import { StaleWriteError } from "../lib/recordStore";
import "../styles/journal.css";

const novoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Modo desafio de uma aventura: regras, limite de nível, encontros por área
 * e perdas.
 *
 * O site só confere sozinho o limite de nível, que é o que o save mostra. O
 * resto é registro de quem joga — e a tela diz isso, para ninguém achar que
 * um encontro esquecido foi "validado".
 */
export default function ChallengePanel({ rom }: { rom: string }) {
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const challenge = useChallenge(rom);
  const entry = useTrainerEntries().find((e) => e.rom === rom);
  const [erro, setErro] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [especie, setEspecie] = useState("");
  const [resultado, setResultado] = useState<Encounter["outcome"]>("caught");
  const [perda, setPerda] = useState("");
  const [causa, setCausa] = useState("");
  const [regra, setRegra] = useState("");
  const [encerrando, setEncerrando] = useState(false);

  const salvar = (acao: () => void) => {
    try {
      acao();
      setErro(null);
    } catch (error) {
      setErro(
        error instanceof StaleWriteError
          ? t("Este desafio mudou em outra aba. Ele foi atualizado aqui; confira e tente de novo.", "This challenge changed in another tab. It was refreshed here; check it and try again.")
          : t("Não foi possível guardar. Verifique o espaço do navegador.", "Couldn't save. Check browser storage.")
      );
    }
  };
  const mudar = (patch: Parameters<typeof updateChallenge>[1]) => salvar(() => updateChallenge(rom, patch));

  if (!challenge) {
    return (
      <section className="adventure-journal">
        <h2>{t("Modo desafio", "Challenge mode")}</h2>
        <p className="page-scope">
          {t(
            "Regras suas para esta aventura: primeiro encontro por área, perdas, limite de nível. O registro é manual; o site confere o nível do time.",
            "Your own rules for this adventure: first encounter per area, losses, level cap. Logging is manual; the site checks team levels."
          )}
        </p>
        <button type="button" onClick={() => salvar(() => startChallenge(rom))}>
          {t("Começar um desafio neste jogo", "Start a challenge in this game")}
        </button>
        {erro && <p role="alert">{erro}</p>}
      </section>
    );
  }

  const cap = levelCapFor(challenge.levelCap, entry?.game ?? (entry ? "emerald" : undefined), entry?.trainer.badges ?? undefined);
  const acima = overCap(entry?.team ?? [], cap);
  const repetida = area.trim() !== "" && areaUsed(challenge.encounters, area);
  const data = (at: number) => new Date(at).toLocaleDateString(localeOf(lang), { day: "2-digit", month: "2-digit" });
  const rotuloResultado = (o: Encounter["outcome"]) =>
    o === "caught" ? t("capturado", "caught") : o === "failed" ? t("escapou ou desmaiou", "fled or fainted") : t("pulado", "skipped");

  const capValor: string = challenge.levelCap === undefined ? "" : String(challenge.levelCap);
  const definirCap = (v: string): Challenge["levelCap"] => (v === "" ? undefined : v === "gym" ? "gym" : Number(v));

  return (
    <section className="adventure-journal" aria-label={t("Modo desafio", "Challenge mode")}>
      <h2>{t("Modo desafio", "Challenge mode")}</h2>

      <h3>{t("Regras", "Rules")}</h3>
      <ul className="journal-goals">
        {RULES.map((r) => (
          <li key={r.id}>
            <label>
              <input
                type="checkbox"
                checked={challenge.rules.includes(r.id)}
                onChange={(e) =>
                  mudar({ rules: e.target.checked ? [...challenge.rules, r.id] : challenge.rules.filter((x) => x !== r.id) })
                }
              />
              {lang === "en" ? r.en : r.pt}
            </label>
          </li>
        ))}
        {challenge.custom.map((c, i) => (
          <li key={`${c}:${i}`}>
            <label>
              <input type="checkbox" checked onChange={() => mudar({ custom: challenge.custom.filter((_, j) => j !== i) })} />
              {c}
            </label>
          </li>
        ))}
      </ul>
      <form
        className="ui-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!regra.trim()) return;
          mudar({ custom: [...challenge.custom, regra.trim().slice(0, 200)] });
          setRegra("");
        }}
      >
        <label>
          {t("Regra sua", "Your own rule")}
          <input value={regra} onChange={(e) => setRegra(e.target.value)} maxLength={200} />
        </label>
        <button type="submit">{t("Adicionar", "Add")}</button>
      </form>

      <h3>{t("Limite de nível", "Level cap")}</h3>
      <label className="page-selector">
        {t("Limite", "Cap")}
        <select value={capValor === "gym" || capValor === "" ? capValor : "fixo"} onChange={(e) => mudar({ levelCap: e.target.value === "fixo" ? 20 : definirCap(e.target.value) })}>
          <option value="">{t("Sem limite", "No cap")}</option>
          <option value="gym">{t("Pokémon mais forte do próximo líder", "Next leader's strongest pokémon")}</option>
          <option value="fixo">{t("Nível fixo", "Fixed level")}</option>
        </select>
      </label>
      {typeof challenge.levelCap === "number" && (
        <label className="page-selector">
          {t("Nível", "Level")}
          <input
            type="number"
            min={1}
            max={100}
            value={challenge.levelCap}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 100) mudar({ levelCap: n });
            }}
          />
        </label>
      )}
      {challenge.levelCap !== undefined && (
        <p role="status" className={acima.length ? "challenge-alert" : "trainer-sub"}>
          {cap === null
            ? t(
                "Este limite precisa de um save lido de Emerald ou FireRed/LeafGreen; para os outros jogos, use um nível fixo.",
                "This cap needs a read save from Emerald or FireRed/LeafGreen; for other games, use a fixed level."
              )
            : acima.length
              ? t(
                  `Limite ${cap}. Acima dele no último save: ${acima.map((m) => `${m.nickname} (${m.level})`).join(", ")}.`,
                  `Cap ${cap}. Above it in the last save: ${acima.map((m) => `${m.nickname} (${m.level})`).join(", ")}.`
                )
              : entry?.team?.length
                ? t(`Limite ${cap}. No último save lido, todo o time está dentro dele.`, `Cap ${cap}. In the last save read, the whole team is within it.`)
                : t(`Limite ${cap}. Sem time lido do save para conferir.`, `Cap ${cap}. No team read from the save to check.`)}
        </p>
      )}

      <h3>
        {t("Encontros por área", "Encounters by area")} · {challenge.encounters.length}
      </h3>
      <form
        className="ui-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!area.trim() || repetida) return;
          mudar({
            encounters: [
              ...challenge.encounters,
              { id: novoId(), area: area.trim().slice(0, 80), outcome: resultado, species: especie.trim().slice(0, 40) || undefined, at: Date.now() },
            ],
          });
          setArea("");
          setEspecie("");
        }}
      >
        <label>
          {t("Área", "Area")}
          <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} placeholder={t("Rota 101", "Route 101")} />
        </label>
        <label>
          {t("Pokémon", "Pokémon")}
          <input value={especie} onChange={(e) => setEspecie(e.target.value)} maxLength={40} />
        </label>
        <label>
          {t("Resultado", "Outcome")}
          <select value={resultado} onChange={(e) => setResultado(e.target.value as Encounter["outcome"])}>
            <option value="caught">{rotuloResultado("caught")}</option>
            <option value="failed">{rotuloResultado("failed")}</option>
            <option value="skipped">{rotuloResultado("skipped")}</option>
          </select>
        </label>
        <button type="submit" disabled={!area.trim() || repetida}>{t("Registrar", "Log")}</button>
      </form>
      {repetida && <p role="status" className="challenge-alert">{t("Esta área já tem um encontro registrado.", "This area already has a logged encounter.")}</p>}
      {challenge.encounters.length > 0 && (
        <ul className="ui-list">
          {[...challenge.encounters].reverse().map((e) => (
            <li key={e.id}>
              <span>
                <strong>{e.area}</strong> · {e.species ? `${e.species} · ` : ""}
                {rotuloResultado(e.outcome)} · {data(e.at)}
              </span>
              <button type="button" aria-label={t(`Remover o encontro de ${e.area}`, `Remove the ${e.area} encounter`)} onClick={() => mudar({ encounters: challenge.encounters.filter((x) => x.id !== e.id) })}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3>
        {t("Perdas", "Losses")} · {challenge.losses.length}
      </h3>
      <form
        className="ui-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!perda.trim()) return;
          mudar({ losses: [...challenge.losses, { id: novoId(), name: perda.trim().slice(0, 40), cause: causa.trim().slice(0, 200), at: Date.now() }] });
          setPerda("");
          setCausa("");
        }}
      >
        <label>
          {t("Quem", "Who")}
          <input value={perda} onChange={(e) => setPerda(e.target.value)} maxLength={40} />
        </label>
        <label>
          {t("Como foi", "What happened")}
          <input value={causa} onChange={(e) => setCausa(e.target.value)} maxLength={200} />
        </label>
        <button type="submit" disabled={!perda.trim()}>{t("Registrar", "Log")}</button>
      </form>
      {challenge.losses.length > 0 && (
        <ul className="ui-list">
          {[...challenge.losses].reverse().map((l) => (
            <li key={l.id}>
              <span>
                <strong>{l.name}</strong>
                {l.cause ? ` · ${l.cause}` : ""} · {data(l.at)}
              </span>
              <button type="button" aria-label={t(`Remover a perda de ${l.name}`, `Remove ${l.name}'s loss`)} onClick={() => mudar({ losses: challenge.losses.filter((x) => x.id !== l.id) })}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="trainer-sub">
        {t(
          "Encontros e perdas são o que você registra: o save não mostra qual foi o primeiro encontro de uma área nem quem desmaiou. O site só confere o nível do time.",
          "Encounters and losses are what you log: the save doesn't show which encounter came first in an area or who fainted. The site only checks team levels."
        )}
      </p>
      {encerrando ? (
        <p>
          {t("Apagar as regras, os encontros e as perdas deste desafio?", "Delete this challenge's rules, encounters and losses?")}{" "}
          <button type="button" onClick={() => salvar(() => endChallenge(rom))}>{t("Apagar", "Delete")}</button>{" "}
          <button type="button" className="journal-help" onClick={() => setEncerrando(false)}>{t("Manter", "Keep")}</button>
        </p>
      ) : (
        <button type="button" className="journal-help" onClick={() => setEncerrando(true)}>
          {t("Encerrar o desafio…", "End the challenge…")}
        </button>
      )}
      {erro && <p role="alert">{erro}</p>}
    </section>
  );
}
