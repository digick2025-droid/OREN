"use client";

import { useSyncExternalStore } from "react";
import type { CompanyRole } from "@/types/database";

/**
 * Prévisualisation de rôle (outil admin uniquement) : permet à l'admin de
 * simuler l'INTERFACE vue par chaque rôle (ce qui est affiché/masqué). Ça ne
 * touche PAS les données (les requêtes gardent les droits réels de l'admin) —
 * le vrai cloisonnement RLS ne se teste qu'avec un compte du rôle visé.
 *
 * Store en mémoire (réinitialisé au rechargement), volontairement non persisté
 * pour rester un simple outil de démo et éviter toute fuite en prod.
 */
let override: CompanyRole | null = null;
const listeners = new Set<() => void>();

export function setRolePreview(role: CompanyRole | null): void {
  override = role;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Rôle simulé courant (null = rôle réel). */
export function useRolePreview(): CompanyRole | null {
  return useSyncExternalStore(
    subscribe,
    () => override,
    () => null,
  );
}
