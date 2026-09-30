/**
 * Lancement gratuit — interrupteur unique de la facturation.
 *
 * Aucune passerelle Mobile Money n'encaisse aujourd'hui de façon fiable (les
 * initiations échouent à l'appel HTTP côté passerelle). Plutôt que d'afficher
 * des prix qu'on ne sait pas encaisser et de laisser des clients devant un
 * écran de paiement qui échoue, tout le produit est offert : aucun plafond de
 * documents, toutes les fonctions, aucun écran de paiement.
 *
 * Volontairement une constante de code et NON une variable d'environnement :
 * une env Vercel se désynchronise du déploiement et casse en silence, alors
 * qu'ici l'état de la facturation part avec le commit qui l'a décidé.
 *
 * Pour rouvrir les paiements, dans cet ordre :
 *   1. vérifier PAYMENT_PROVIDER et les secrets de la passerelle retenue ;
 *   2. restaurer prix et quotas en base — bouton « Restaurer les prix
 *      d'origine » sur /admin/offres, ou `select public.restore_plan_prices();` ;
 *   3. repasser FREE_LAUNCH à false et déployer.
 *
 * Ne PAS faire l'étape 2 sans l'étape 3 : les quotas reviendraient en base
 * pendant que l'interface promet encore la gratuité.
 */
/**
 * Annoté `boolean` et non laissé au type littéral `true` : sans cela
 * TypeScript considère toutes les branches payantes comme mortes et cesse de
 * les vérifier — elles pourriraient sans bruit jusqu'au jour où on les
 * rallume.
 */
export const FREE_LAUNCH: boolean = true;
