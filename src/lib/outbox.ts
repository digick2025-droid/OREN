/**
 * Boîte d'envoi hors-ligne : les documents créés sans réseau.
 *
 * Un document généré hors connexion n'a pas encore de numéro (il est attribué
 * par la base, dans `create_document`) : on garde sa charge utile sur
 * l'appareil, et `syncOutbox` la rejoue dès que le réseau revient.
 *
 * localStorage plutôt qu'IndexedDB : quelques kilo-octets de texte par
 * document, lecture synchrone (affichage immédiat dans les listes), et le
 * même stockage que les brouillons du formulaire.
 *
 * Chaque entrée porte l'entreprise qui l'a créée : un autre compte connecté
 * sur le même appareil ne la voit pas et ne l'envoie pas. La déconnexion vide
 * la boîte (`clearOfflineData`), après confirmation si elle n'est pas vide.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateDocumentPayload, DocumentRow } from "@/types/database";

export const OUTBOX_KEY = "oren_outbox_v1";

/** Demande de synchronisation immédiate (bouton « Réessayer », retour réseau). */
export const OUTBOX_SYNC_EVENT = "oren-outbox-sync";
const OUTBOX_CHANGE_EVENT = "oren-outbox-change";

export interface OutboxEntry {
  localId: string;
  companyId: string;
  /** Saisie du document sur l'appareil (ISO). */
  createdAt: string;
  payload: CreateDocumentPayload;
  /** Client saisi hors-ligne : créé dans la base juste avant le document. */
  newClient?: { name: string; phone: string | null };
  /** Total calculé à la saisie : affichage et dédoublonnage. */
  total: number;
  attempts: number;
  /** Première tentative d'envoi : borne la recherche d'un doublon. */
  firstAttemptAt?: string;
  /** Refus de la base (quota, droits…) : l'entrée n'est plus rejouée seule. */
  error?: string;
}

const EMPTY: OutboxEntry[] = [];
let cachedRaw: string | null = null;
let cachedList: OutboxEntry[] = EMPTY;

/** Lecture mémoïsée : même tableau tant que le stockage n'a pas changé. */
export function readOutbox(): OutboxEntry[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(OUTBOX_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cachedList = Array.isArray(parsed) ? (parsed as OutboxEntry[]) : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function writeOutbox(entries: OutboxEntry[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(OUTBOX_KEY);
    else localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } finally {
    window.dispatchEvent(new Event(OUTBOX_CHANGE_EVENT));
  }
}

export function outboxFor(companyId: string): OutboxEntry[] {
  return readOutbox().filter((e) => e.companyId === companyId);
}

export function subscribeOutbox(callback: () => void): () => void {
  // `storage` : un autre onglet a envoyé ou ajouté un document.
  const onStorage = (e: StorageEvent) => {
    if (e.key === OUTBOX_KEY || e.key === null) callback();
  };
  window.addEventListener(OUTBOX_CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(OUTBOX_CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

function newLocalId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Range un document dans la boîte d'envoi. Lève si le stockage est plein ou
 * indisponible : l'appelant doit alors garder le formulaire tel quel, sans
 * quoi la saisie serait perdue.
 */
export function enqueueDocument(input: {
  companyId: string;
  payload: CreateDocumentPayload;
  newClient?: { name: string; phone: string | null };
  total: number;
}): OutboxEntry {
  const entry: OutboxEntry = {
    localId: newLocalId(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...input,
  };
  const next = [...readOutbox(), entry];
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(OUTBOX_CHANGE_EVENT));
  return entry;
}

function updateEntry(localId: string, patch: Partial<OutboxEntry>): void {
  writeOutbox(
    readOutbox().map((e) => (e.localId === localId ? { ...e, ...patch } : e)),
  );
}

export function removeOutboxEntry(localId: string): void {
  writeOutbox(readOutbox().filter((e) => e.localId !== localId));
}

/** « Réessayer » : l'erreur est oubliée et la synchronisation relancée. */
export function retryOutboxEntry(localId: string): void {
  updateEntry(localId, { error: undefined });
  requestOutboxSync();
}

export function clearOutbox(): void {
  try {
    localStorage.removeItem(OUTBOX_KEY);
  } catch {
    // stockage indisponible : rien à purger
  }
}

export function requestOutboxSync(): void {
  window.dispatchEvent(new Event(OUTBOX_SYNC_EVENT));
}

/**
 * Échec de transport (pas de réseau, coupure, délai dépassé), par opposition
 * à un refus de la base. supabase-js ne lève pas : il renvoie le message de
 * l'erreur `fetch` (« TypeError: Failed to fetch » sous Chrome, « Load
 * failed » sous Safari, « NetworkError… » sous Firefox).
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet|timed? ?out|aborted/i.test(
    message,
  );
}

export interface SyncResult {
  synced: DocumentRow[];
  failed: OutboxEntry[];
}

let running: Promise<SyncResult> | null = null;

/**
 * Envoie les documents en attente de l'entreprise, dans l'ordre de saisie.
 * S'arrête à la première coupure réseau (les suivantes échoueraient aussi) ;
 * un refus de la base marque l'entrée et passe à la suivante.
 *
 * Un seul envoi à la fois : dans l'onglet (promesse partagée) et entre
 * onglets (Web Locks, quand le navigateur les connaît).
 */
export function syncOutbox(
  supabase: SupabaseClient,
  companyId: string,
): Promise<SyncResult> {
  if (running) return running;
  const job = () => runSync(supabase, companyId);
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  const started = locks
    ? (async (): Promise<SyncResult> => await locks.request("oren-outbox", job))()
    : job();
  const current = started.finally(() => {
    running = null;
  });
  running = current;
  return current;
}

async function runSync(
  supabase: SupabaseClient,
  companyId: string,
): Promise<SyncResult> {
  const result: SyncResult = { synced: [], failed: [] };

  for (const queued of outboxFor(companyId)) {
    if (queued.error) continue;
    if (navigator.onLine === false) break;
    // Relue à chaque tour : un autre onglet a pu l'envoyer entre-temps.
    const entry = readOutbox().find((e) => e.localId === queued.localId);
    if (!entry || entry.error) continue;

    // Une tentative précédente a pu aboutir côté base sans que la réponse
    // nous parvienne (coupure au mauvais moment) : on cherche le document
    // avant de le recréer, sinon il apparaîtrait en double.
    if (entry.attempts > 0 && entry.firstAttemptAt) {
      const since = new Date(Date.parse(entry.firstAttemptAt) - 60_000).toISOString();
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("company_id", companyId)
        .eq("type", entry.payload.type)
        .eq("title", entry.payload.title)
        .eq("total", entry.total)
        .gte("created_at", since)
        .is("deleted_at", null)
        .limit(1);
      if (error) {
        if (isNetworkError(error)) break;
      } else if (data && data.length > 0) {
        removeOutboxEntry(entry.localId);
        result.synced.push(data[0] as DocumentRow);
        continue;
      }
    }

    updateEntry(entry.localId, {
      attempts: entry.attempts + 1,
      firstAttemptAt: entry.firstAttemptAt ?? new Date().toISOString(),
    });

    let payload = entry.payload;
    if (entry.newClient && !payload.client_id) {
      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          company_id: companyId,
          name: entry.newClient.name,
          phone: entry.newClient.phone,
        })
        .select()
        .single();
      if (error && isNetworkError(error)) break;
      if (client) {
        payload = { ...payload, client_id: (client as { id: string }).id };
        // Mémorisé tout de suite : un nouvel essai ne recrée pas le client.
        updateEntry(entry.localId, { payload, newClient: undefined });
      }
      // Client refusé (droits, doublon…) : le document part quand même, avec
      // le nom et le téléphone recopiés dans `client_name` / `client_phone`.
    }

    const { data, error } = await supabase.rpc("create_document", {
      p_company_id: companyId,
      p_payload: payload,
    });
    if (error) {
      if (isNetworkError(error)) break;
      updateEntry(entry.localId, { error: error.message.slice(0, 120) });
      result.failed.push({ ...entry, error: error.message });
      continue;
    }
    removeOutboxEntry(entry.localId);
    result.synced.push(data as DocumentRow);
  }

  return result;
}
