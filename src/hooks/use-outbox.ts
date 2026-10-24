"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useCompany } from "@/features/company/company-context";
import { readOutbox, subscribeOutbox, type OutboxEntry } from "@/lib/outbox";

const EMPTY: OutboxEntry[] = [];

/** Documents de l'entreprise courante en attente d'envoi, du plus récent au plus ancien. */
export function useOutbox(): OutboxEntry[] {
  const company = useCompany();
  const all = useSyncExternalStore(subscribeOutbox, readOutbox, () => EMPTY);
  return useMemo(
    () =>
      all
        .filter((e) => e.companyId === company.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [all, company.id],
  );
}
