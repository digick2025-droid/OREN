/**
 * Trace serveur d'une initiation de paiement refusée.
 *
 * Partagée par tous les fournisseurs : un refus doit se lire de la même façon
 * quelle que soit la passerelle en service, sans quoi chaque bascule de
 * `PAYMENT_PROVIDER` rouvre la même enquête.
 *
 * Ne journalise JAMAIS la charge utile ni les en-têtes : ils portent les clés
 * d'API et le numéro du payeur. Seulement de quoi relier la ligne de log à
 * l'intention et savoir quoi corriger.
 *
 * Ce log est un confort (rétention Vercel : 1 h en plan Hobby) ; la trace qui
 * survit, elle, est `payment_intents.failure_reason`.
 */
export function logInitiationRefusal(
  provider: string,
  reference: string,
  origin: string,
  detail?: string,
): void {
  console.error(
    `[${provider}] initiation refusée (${origin}) pour ${reference}${
      detail ? ` — ${detail}` : ""
    }`,
  );
}
