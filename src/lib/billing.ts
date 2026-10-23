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
export const FREE_LAUNCH: boolean = false;

/**
 * Paiement manuel — le client envoie lui-même l'argent au numéro marchand
 * (Orange Money / MTN MoMo) puis saisit la référence reçue par SMS.
 *
 * Ce qui est payé est débloqué immédiatement ; l'admin contrôle ensuite la
 * référence dans /admin/paiements et annule une fausse déclaration
 * (migration 0039). Prend le pas sur PAYMENT_PROVIDER tant qu'aucune
 * passerelle n'encaisse de façon fiable.
 *
 * Constante de code, comme FREE_LAUNCH, pour la même raison : l'état du
 * paiement part avec le commit qui l'a décidé.
 */
export const MANUAL_PAYMENT: boolean = true;

/**
 * OREN ENTREPRISE — interrupteur de preview du module FSM (en construction).
 *
 * Quand `true`, l'espace « Équipe » (et plus tard interventions/planning) est
 * visible même sans la feature `members` en base — pour développer et tester
 * avant d'ouvrir l'offre. Comme `FREE_LAUNCH`, c'est une constante de code
 * (jamais une env Vercel) : l'état part avec le commit, sans désync silencieuse.
 *
 * Laissé à `false` : tant que l'offre `entreprise` n'est pas active, le module
 * reste invisible en production (gaté par `usePlanFeature("members")`).
 *
 * Annoté `boolean` (pas le littéral `false`) pour que TypeScript continue de
 * vérifier les branches « preview actif ».
 */
export const ENTERPRISE_PREVIEW: boolean = false;
