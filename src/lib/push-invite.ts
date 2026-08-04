/**
 * Relances push — décide s'il faut *proposer* d'activer les rappels.
 *
 * Séparé de `push.ts` : ici on ne demande aucune permission au navigateur, on
 * décide seulement si l'on a le droit d'afficher une carte dans l'application.
 * C'est toute la différence entre une question qu'on peut reposer et une
 * permission qu'on ne peut griller qu'une fois — un refus au niveau du
 * navigateur est définitif, l'application n'a aucun moyen d'y revenir.
 *
 * La mémoire est locale à l'appareil, comme l'abonnement lui-même : le même
 * compte sur un second téléphone doit pouvoir se voir proposer les rappels.
 */

import { lirePushStatus } from "./push";

const CLE = "oren_push_invite";

/** Au-delà, on considère que le silence est une réponse. */
export const MAX_PROPOSITIONS = 2;
/** Délai entre deux propositions : assez long pour ne pas être du harcèlement. */
export const DELAI_JOURS = 7;

interface Memoire {
  /** Nombre de propositions déjà affichées sur cet appareil. */
  n: number;
  /** Horodatage de la dernière, en millisecondes. */
  dernier: number;
}

function lire(): Memoire {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return { n: 0, dernier: 0 };
    const m = JSON.parse(brut) as Partial<Memoire>;
    return { n: Number(m.n) || 0, dernier: Number(m.dernier) || 0 };
  } catch {
    // Navigation privée ou stockage corrompu : on repart de zéro. Le plafond
    // MAX_PROPOSITIONS sera réévalué à la prochaine ouverture, sans dégât.
    return { n: 0, dernier: 0 };
  }
}

/**
 * Vrai s'il est légitime d'afficher la carte maintenant.
 *
 * On ne propose qu'à un appareil capable de recevoir et pas encore abonné :
 * `lirePushStatus()` écarte déjà les navigateurs sans push, les iPhone dont la
 * PWA n'est pas installée, les permissions refusées, et les appareils déjà
 * actifs — à qui reproposer serait absurde.
 */
export async function peutProposer(): Promise<boolean> {
  if ((await lirePushStatus()) !== "inactif") return false;

  const { n, dernier } = lire();
  if (n >= MAX_PROPOSITIONS) return false;
  return Date.now() - dernier >= DELAI_JOURS * 24 * 3600 * 1000;
}

/**
 * Enregistre qu'une proposition vient d'être affichée. Appelé à l'affichage et
 * non à la réponse : une carte ignorée est une réponse, elle doit compter.
 */
export function noterProposition(): void {
  const { n } = lire();
  try {
    localStorage.setItem(
      CLE,
      JSON.stringify({ n: n + 1, dernier: Date.now() } satisfies Memoire),
    );
  } catch {
    // Sans stockage, la carte pourra réapparaître : préférable à ne jamais
    // proposer, et le plafond du navigateur reste, lui, infranchissable.
  }
}
