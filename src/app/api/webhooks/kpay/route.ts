/**
 * Callback générique de K-PAY : utilisé en repli quand aucune URL spécifique
 * n'est définie pour le type d'événement concerné.
 *
 * Il peut donc recevoir les mêmes événements de paiement que
 * `/api/webhooks/deposits`. Le traiter avec le même handler est sans risque :
 * le règlement est idempotent, un événement reçu deux fois ne règle qu'une
 * fois. Voir `/api/payments/webhook/kpay` pour l'implémentation.
 */
export { POST } from "@/app/api/payments/webhook/kpay/route";
