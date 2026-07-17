"use client";

import Link from "next/link";
import { Phone, Plus } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/features/i18n/language-context";
import { useClients } from "@/hooks/use-clients";

export default function ClientsPage() {
  const { t } = useI18n();
  const { data: clients, isLoading } = useClients();

  return (
    <div>
      <ScreenHeader
        title={t.clients_title}
        action={
          <Button asChild size="sm" variant="accent">
            <Link href="/clients/nouveau">
              <Plus size={15} /> {t.new_short}
            </Link>
          </Button>
        }
      />
      <div className="space-y-3 px-4 pt-4">
        {isLoading ? (
          <ListSkeleton />
        ) : (clients ?? []).length === 0 ? (
          <Card className="p-6 text-center text-[14px] text-[#8A93A6]">
            {t.clients_empty}
          </Card>
        ) : (
          (clients ?? []).map((client) => (
            <Link
              key={client.id}
              href={`/clients/${client.id}`}
              className="flex items-center gap-3 rounded-2xl border border-[#E9EBF0] bg-white p-4 transition-colors hover:border-[#C3C9D5]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF0F4] text-[15px] font-extrabold text-navy">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-navy">
                  {client.name}
                </div>
                {client.phone && (
                  <div className="flex items-center gap-1 text-[12.5px] text-[#5A6377]">
                    <Phone size={11} /> {client.phone}
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
