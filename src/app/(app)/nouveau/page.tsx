"use client";

import { use } from "react";
import { DocumentBuilder } from "@/features/documents/document-builder";

export default function NouveauDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = use(searchParams);
  return <DocumentBuilder type={type === "facture" ? "facture" : "devis"} />;
}
