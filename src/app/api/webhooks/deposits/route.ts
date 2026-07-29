/**
 * Callback « dépôts » de K-PAY (`payment.completed` / `.failed` / `.cancelled`).
 *
 * Le tableau de bord K-PAY impose ses propres chemins de rappel — ils ne sont
 * pas saisissables librement — et c'est celui-ci qu'il appelle pour les
 * paiements entrants. On expose donc le handler à l'URL qu'il attend plutôt
 * que de laisser chaque notification tomber sur un 404.
 *
 * L'implémentation vit dans `/api/payments/webhook/kpay` : c'est le chemin
 * canonique, cohérent avec le webhook CamerPay voisin. Ici, aucune logique —
 * un seul endroit à lire, un seul à corriger.
 */
export { POST } from "@/app/api/payments/webhook/kpay/route";
