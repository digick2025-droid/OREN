"use client";

import { useState } from "react";
import { DocumentCard } from "@/components/document-card";
import { PendingDocumentCard } from "@/components/pending-document-card";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/features/i18n/language-context";
import { useDocuments } from "@/hooks/use-documents";
import { useOutbox } from "@/hooks/use-outbox";
import { cn } from "@/lib/utils";

type Filter = "tous" | "devis" | "facture" | "proforma";

export default function DocumentsPage() {
  const { t } = useI18n();
  const { data: documents, isLoading } = useDocuments();
  const outbox = useOutbox();
  const [filter, setFilter] = useState<Filter>("tous");

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "tous", label: t.filter_all },
    { key: "devis", label: t.filter_devis },
    { key: "facture", label: t.filter_factures },
    { key: "proforma", label: t.filter_proforma },
  ];

  const filtered = (documents ?? []).filter(
    (doc) => filter === "tous" || doc.type === filter,
  );
  // Créés hors connexion, pas encore numérotés : en tête, tant qu'ils attendent.
  const pending = outbox.filter(
    (entry) => filter === "tous" || entry.payload.type === filter,
  );

  return (
    <div>
      <ScreenHeader title={t.docs_title} />
      <div className="px-4 pt-4">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border-[1.5px] border-border",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {pending.map((entry) => (
            <PendingDocumentCard key={entry.localId} entry={entry} />
          ))}
          {isLoading ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            pending.length > 0 ? null : (
            <Card className="p-6 text-center text-[14px] text-muted-foreground/70">
              {t.docs_empty}
            </Card>
            )
          ) : (
            filtered.map((doc) => <DocumentCard key={doc.id} document={doc} />)
          )}
        </div>
      </div>
    </div>
  );
}
