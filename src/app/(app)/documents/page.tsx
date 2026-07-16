"use client";

import { useState } from "react";
import { DocumentCard } from "@/components/document-card";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/ui/card";
import { useDocuments } from "@/hooks/use-documents";
import { cn } from "@/lib/utils";

type Filter = "tous" | "devis" | "facture";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "tous", label: "Tous" },
  { key: "devis", label: "Devis" },
  { key: "facture", label: "Factures" },
];

export default function DocumentsPage() {
  const { data: documents, isLoading } = useDocuments();
  const [filter, setFilter] = useState<Filter>("tous");

  const filtered = (documents ?? []).filter(
    (doc) => filter === "tous" || doc.type === filter,
  );

  return (
    <div>
      <ScreenHeader title="Documents" />
      <div className="px-4 pt-4">
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
                filter === f.key
                  ? "bg-navy text-white"
                  : "bg-white text-[#5A6377] border-[1.5px] border-[#E2E5EC]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {isLoading ? null : filtered.length === 0 ? (
            <Card className="p-6 text-center text-[14px] text-[#8A93A6]">
              Aucun document
            </Card>
          ) : (
            filtered.map((doc) => <DocumentCard key={doc.id} document={doc} />)
          )}
        </div>
      </div>
    </div>
  );
}
