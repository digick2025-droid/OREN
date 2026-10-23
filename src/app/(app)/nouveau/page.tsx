"use client";

import { use } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DocumentBuilder } from "@/features/documents/document-builder";
import { useI18n } from "@/features/i18n/language-context";
import { useDocument } from "@/hooks/use-documents";
import { usePlanFeature } from "@/hooks/use-usage";
import type { DocumentType } from "@/types/database";

function parseType(value: string | undefined): DocumentType {
  if (value === "facture") return "facture";
  if (value === "proforma") return "proforma";
  return "devis";
}

export default function NouveauDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string }>;
}) {
  const { type, from } = use(searchParams);
  const { t } = useI18n();
  const docType = parseType(type);
  const proformaAccess = usePlanFeature("proforma");

  // La proforma est réservée à l'offre Pro
  if (docType === "proforma" && !proformaAccess.loading && !proformaAccess.enabled) {
    return (
      <div>
        <ScreenHeader title={t.new_proforma} backHref="/accueil" />
        <div className="px-4 pt-8">
          <Card className="p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-navy">
              <Lock size={22} />
            </div>
            <h2 className="mt-4 text-[17px] font-extrabold text-navy">
              {t.proforma_locked}
            </h2>
            <Button asChild variant="accent" className="mt-5 w-full">
              <Link href="/offres">{t.catalog_upgrade}</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (from) return <DuplicateBuilder type={docType} sourceId={from} />;
  return <DocumentBuilder type={docType} />;
}

/**
 * « Dupliquer » : la création part d'une copie du document source (client,
 * lignes, options). Un nouveau numéro est attribué à la génération.
 */
function DuplicateBuilder({
  type,
  sourceId,
}: {
  type: DocumentType;
  sourceId: string;
}) {
  const { t } = useI18n();
  const { data, isError } = useDocument(sourceId);

  // Source introuvable (supprimée, lien abîmé) : un devis vierge plutôt
  // qu'un écran bloqué.
  if (isError) return <DocumentBuilder type={type} />;
  if (!data) return <ScreenHeader title={t.doc_duplicate} backHref="/documents" />;
  return <DocumentBuilder type={type} source={data} />;
}
