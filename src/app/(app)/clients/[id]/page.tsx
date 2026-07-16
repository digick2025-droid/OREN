"use client";

import { use } from "react";
import { ClientForm } from "@/features/clients/client-form";
import { useClients } from "@/hooks/use-clients";

export default function ModifierClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: clients, isLoading } = useClients();
  if (isLoading) return null;
  const client = (clients ?? []).find((c) => c.id === id) ?? null;
  return <ClientForm client={client} />;
}
