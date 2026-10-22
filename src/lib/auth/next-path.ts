/**
 * Destination après connexion, transmise par `?next=`.
 *
 * Seuls les chemins internes sont acceptés : « //evil.com » ou
 * « /\evil.com » seraient interprétés par le navigateur comme une autre
 * origine (redirection ouverte).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
