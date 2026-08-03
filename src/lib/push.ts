/**
 * Relances push — côté navigateur : permission, abonnement, désabonnement.
 *
 * Rien ici ne s'exécute tout seul. La permission n'est demandée qu'après un
 * geste explicite dans les Réglages : un navigateur qui voit une demande de
 * notification au chargement la refuse définitivement pour tout le domaine,
 * et cette décision est irréversible côté application.
 */

import type { Lang } from "@/lib/i18n/config";

export type PushStatus =
  /** Navigateur sans push, ou iPhone dont la PWA n'est pas installée. */
  | "indisponible"
  /** Permission refusée : seul l'utilisateur peut revenir en arrière. */
  | "refuse"
  | "actif"
  | "inactif";

/**
 * La clé publique VAPID doit voyager en octets, pas en base64url. On rend
 * l'ArrayBuffer lui-même : `PushManager.subscribe` attend un BufferSource, et
 * un `Uint8Array` générique ne satisfait pas ce type.
 */
function decodeVapidKey(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalise = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalise);
  const buffer = new ArrayBuffer(raw.length);
  const octets = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) octets[i] = raw.charCodeAt(i);
  return buffer;
}

export function pushDisponible(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

export async function lirePushStatus(): Promise<PushStatus> {
  if (!pushDisponible()) return "indisponible";
  if (Notification.permission === "denied") return "refuse";

  const registration = await navigator.serviceWorker.getRegistration();
  const abonnement = await registration?.pushManager.getSubscription();
  return abonnement ? "actif" : "inactif";
}

/**
 * Demande la permission puis enregistre l'appareil. Retourne le statut atteint
 * — jamais d'exception pour un refus : c'est un choix, pas une panne.
 */
export async function activerPush(lang: Lang): Promise<PushStatus> {
  if (!pushDisponible()) return "indisponible";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "refuse";

  // `ready` plutôt que `getRegistration` : ici on sait qu'un worker est en
  // cours d'installation (l'application vient de le déclarer), et il faut
  // qu'il soit actif pour s'abonner.
  const registration = await navigator.serviceWorker.ready;
  const abonnement =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Sans cette option, Chrome refuse l'abonnement : il exige la promesse
      // qu'une notification visible suivra chaque push reçu.
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
      ),
    }));

  const reponse = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: abonnement.toJSON(), lang }),
  });

  if (!reponse.ok) {
    // L'abonnement navigateur existerait sans ligne en base : il ne recevrait
    // jamais rien, et l'interface afficherait « actif » à tort.
    await abonnement.unsubscribe().catch(() => undefined);
    return "inactif";
  }

  return "actif";
}

/**
 * Désabonne l'appareil et oublie sa ligne en base. Appelé depuis les Réglages,
 * et à chaque déconnexion : sans cela, les relances d'un compte continueraient
 * d'arriver sur un appareil passé à quelqu'un d'autre.
 */
export async function desactiverPush(): Promise<void> {
  if (!pushDisponible()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const abonnement = await registration?.pushManager.getSubscription();
    if (!abonnement) return;

    // On prévient le serveur AVANT de désabonner : une fois `unsubscribe()`
    // passé, l'endpoint n'est plus lisible et la ligne resterait orpheline.
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: abonnement.endpoint }),
      keepalive: true,
    }).catch(() => undefined);

    await abonnement.unsubscribe();
  } catch {
    // Pas de worker, pas d'abonnement : rien à défaire.
  }
}
