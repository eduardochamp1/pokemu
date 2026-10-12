import { useT } from "../i18n/lang";

/** Placeholder enquanto o chunk de uma rota lazy chega. */
export const RouteFallback = () => {
  const t = useT();
  return (
  <div className="route-fallback" role="status" aria-live="polite">
    <span className="route-fallback-ball" aria-hidden="true" />
    <span className="route-fallback-text">{t("Carregando…", "Loading…")}</span>
  </div>
  );
};
