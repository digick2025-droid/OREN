/**
 * Relances push — envoi effectif à un appareil.
 *
 * Isolé de la décision (`select.ts`) et de la collecte (route cron) : c'est la
 * seule partie qui parle au réseau, et la seule qui doive savoir qu'un
 * abonnement peut être mort.
 */

import webpush, { type PushSubscription } from "web-push";
import type { RelanceDecision } from "./types";

export interface AbonnementPush {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  lang: string;
}

export type ResultatEnvoi =
  | { statut: "envoye" }
  /** L'appareil a désinstallé l'application ou révoqué la permission. */
  | { statut: "expire" }
  | { statut: "echec"; code?: number };

let configure = false;

/**
 * Les clés VAPID ne sont lues qu'au premier envoi : importer ce module dans un
 * contexte qui n'envoie rien (un test, une page) ne doit pas exiger que
 * l'environnement soit complet.
 */
function configurer(): void {
  if (configure) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID_* manquant(e)s : relances push non configurées");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configure = true;
}

export async function envoyerRelance(
  abonnement: AbonnementPush,
  relance: RelanceDecision,
): Promise<ResultatEnvoi> {
  configurer();

  const subscription: PushSubscription = {
    endpoint: abonnement.endpoint,
    keys: { p256dh: abonnement.p256dh, auth: abonnement.auth },
  };

  const payload = JSON.stringify({
    title: relance.title,
    body: relance.body,
    url: relance.url,
    lang: abonnement.lang,
  });

  try {
    await webpush.sendNotification(subscription, payload, {
      // Une relance périmée n'a plus d'intérêt : si l'appareil est éteint
      // depuis deux jours, mieux vaut ne rien recevoir qu'un rappel obsolète.
      TTL: 24 * 3600,
      urgency: "low",
    });
    return { statut: "envoye" };
  } catch (error) {
    const code = (error as { statusCode?: number })?.statusCode;
    // 404 / 410 : l'endpoint n'existe plus chez le service de push. Le
    // conserver, c'est réessayer tous les jours pour toujours.
    if (code === 404 || code === 410) return { statut: "expire" };
    return { statut: "echec", code };
  }
}
