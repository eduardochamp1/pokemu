import { useState } from "react";
import { updatePersonalAdventure, usePersonalAdventure } from "../lib/personalAdventures";
import { useT } from "../i18n/lang";

export default function SlotName({ rom, slot }: { rom: string; slot: number }) {
  const entry = usePersonalAdventure(rom);
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState(false);
  const current = entry.slotNames[slot - 1] ?? "";
  if (!editing) return <button className="slot-name" onClick={() => { setName(current); setEditing(true); }} aria-label={t(`Nome do ponto ${slot}`, `Restore point ${slot} name`)}>{current || t("Dar um nome…", "Name this point…")}</button>;
  return <form className="slot-name-form" onSubmit={event => {
    event.preventDefault();
    try {
      const names = Array.from({ length: 6 }, (_, index) => entry.slotNames[index] ?? "");
      names[slot - 1] = name.trim();
      updatePersonalAdventure(rom, { slotNames: names }); setEditing(false); setError(false);
    } catch { setError(true); }
  }}><input aria-label={t(`Nome do ponto ${slot}`, `Restore point ${slot} name`)} value={name} maxLength={80} onChange={event => setName(event.target.value)} autoFocus /><button>{t("Guardar", "Save")}</button><button type="button" onClick={() => setEditing(false)}>{t("Cancelar", "Cancel")}</button>{error && <span role="alert">{t("Não foi possível guardar o nome.", "Could not save the name.")}</span>}</form>;
}
