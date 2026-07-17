"use client";

import { use } from "react";
import { ScreenHeader } from "@/components/screen-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { DocumentBuilder } from "@/features/documents/document-builder";
import { useI18n } from "@/features/i18n/language-context";
import { useDocument } from "@/hooks/use-documents";

export default function ModifierDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const { data, isLoading } = useDocument(id);

  if (isLoading || !data) {
    return (
      <div>
        <ScreenHeader title={t.edit_document} backHref={`/documents/${id}`} />
        <div className="px-4 pt-5">
          <ListSkeleton count={4} />
        </div>
      </div>
    );
  }

  return <DocumentBuilder document={data.document} items={data.items} />;
}
