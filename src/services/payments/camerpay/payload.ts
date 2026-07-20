/**
 * Lecture défensive des charges utiles CamerPay (réponses d'initiation ET
 * corps de webhook). Le contrat exact n'étant pas figé, on tolère plusieurs
 * noms de champs et une éventuelle imbrication sous `data`.
 *
 * Dès que la doc réelle est connue, ces helpers peuvent disparaître au profit
 * d'un parsing strict — c'est le seul endroit à toucher.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Récupère la 1ʳᵉ chaîne non vide trouvée parmi des clés (au niveau racine
 *  ou sous `data`), de façon tolérante au format de réponse. */
export function pickString(
  value: unknown,
  keys: string[],
): string | undefined {
  const sources: Record<string, unknown>[] = [];
  if (isRecord(value)) {
    sources.push(value);
    if (isRecord(value.data)) sources.push(value.data);
  }
  for (const source of sources) {
    for (const key of keys) {
      const found = source[key];
      if (typeof found === "string" && found.length > 0) return found;
      if (typeof found === "number") return String(found);
    }
  }
  return undefined;
}

/**
 * Normalise un statut fournisseur vers notre `PaymentStatus`.
 *
 * Prudence volontaire : tout ce qui n'est pas un succès ou un échec
 * **explicite** reste `pending`. Un statut inconnu ne doit jamais faire
 * basculer une intention — mieux vaut un paiement en attente qu'une offre
 * accordée à tort.
 */
export function normalizeStatus(
  raw: string | undefined,
): "pending" | "succeeded" | "failed" {
  const status = raw?.toLowerCase().trim();
  if (!status) return "pending";
  if (
    status === "success" ||
    status === "successful" ||
    status === "succeeded" ||
    status === "completed" ||
    status === "confirmed" ||
    status === "paid"
  ) {
    return "succeeded";
  }
  if (
    status === "failed" ||
    status === "failure" ||
    status === "declined" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "expired" ||
    status === "rejected"
  ) {
    return "failed";
  }
  return "pending";
}
