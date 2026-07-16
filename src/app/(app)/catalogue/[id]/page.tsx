"use client";

import { use } from "react";
import { CatalogItemForm } from "@/features/catalog/catalog-item-form";
import { useCatalog } from "@/hooks/use-catalog";

export default function ModifierArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: items, isLoading } = useCatalog();
  if (isLoading) return null;
  const item = (items ?? []).find((i) => i.id === id) ?? null;
  return <CatalogItemForm item={item} />;
}
