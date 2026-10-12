import { useState } from "react";
import { Link } from "react-router-dom";
import { usePersonalAdventure, updatePersonalAdventure } from "../lib/personalAdventures";
import { useLang, tr, localeOf } from "../i18n/lang";
import "../styles/journal.css";

export default function AdventureJournal({ rom }: { rom: string }) {
  const entry = usePersonalAdventure(rom);
  const [note, setNote] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const lang = useLang();
  const t = (pt: string, en: string) => tr(lang, pt, en);
  const add = (kind: "notes" | "goals") => {
    const text = (kind === "notes" ? note : goal).trim();
    if (!text) return;
    try {
      const items = kind === "notes" && editingNote
        ? entry.notes.map(item => item.id === editingNote ? { ...item, text } : item)
        : [...entry[kind], { id: crypto.randomUUID(), text, at: Date.now(), ...(kind === "goals" ? { done: false } : {}) }];
      updatePersonalAdventure(rom, { [kind]: items });
      if (kind === "notes") { setNote(""); setEditingNote(null); } else setGoal("");
      setError("");
    } catch { setError(t("Não foi possível guardar. Verifique o espaço disponível e os limites do diário (500 notas, 100 objetivos).", "Could not save. Check available storage and journal limits (500 notes, 100 goals).")); }
  };
  return <section className="adventure-journal">
    <h2>{t("Diário da aventura", "Adventure journal")}</h2>
    <p className="trainer-sub">{rom}</p>
    <Link className="journal-help" to={`/ajuda?rom=${encodeURIComponent(rom)}`}>{t("Ajuda para este jogo →", "Help for this game →")}</Link>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); add("goals"); }}><label>{t("Próximo objetivo", "Next goal")}<input maxLength={200} value={goal} onChange={event => setGoal(event.target.value)} placeholder={t("Ex.: encontrar a próxima insígnia", "E.g. find the next badge")} /></label><button disabled={!goal.trim() || entry.goals.length >= 100}>{t("Adicionar objetivo", "Add goal")}</button></form>
    <ul className="journal-goals">{entry.goals.map(item => <li key={item.id}><label><input type="checkbox" checked={!!item.done} onChange={() => {
      try { updatePersonalAdventure(rom, { goals: entry.goals.map(goal => goal.id === item.id ? { ...goal, done: !goal.done } : goal) }); setError(""); }
      catch { setError(t("Não foi possível atualizar o objetivo.", "Could not update the goal.")); }
    }} /><span className={item.done ? "is-done" : ""}>{item.text}</span></label></li>)}</ul>
    <form onSubmit={event => { event.preventDefault(); add("notes"); }}><label>{editingNote ? t("Editar anotação", "Edit note") : t("Nova anotação", "New note")}<textarea maxLength={4000} value={note} onChange={event => setNote(event.target.value)} placeholder={t("Onde parei? O que quero tentar depois?", "Where did I stop? What should I try next?")} /></label><button disabled={!note.trim() || (!editingNote && entry.notes.length >= 500)}>{t("Guardar anotação", "Save note")}</button>{editingNote && <button type="button" onClick={() => { setEditingNote(null); setNote(""); }}>{t("Cancelar edição", "Cancel edit")}</button>}</form>
    <ol className="journal-notes">{[...entry.notes].reverse().map(item => <li key={item.id}><time dateTime={new Date(item.at).toISOString()}>{new Date(item.at).toLocaleString(localeOf(lang))}</time><p>{item.text}</p><button onClick={() => { setEditingNote(item.id); setNote(item.text); }}>{t("Editar", "Edit")}</button></li>)}</ol>
    {!entry.notes.length && <p className="trainer-sub">{t("Suas anotações ficam ligadas a esta ROM e entram no backup de aventuras.", "Your notes belong to this ROM and are included in the adventure backup.")}</p>}
  </section>;
}
