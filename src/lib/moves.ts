/** "thunder-shock" -> "Thunder Shock". Sem request nenhum. */
export function prettyMoveName(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
