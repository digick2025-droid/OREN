"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Plus, Search, Star } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/features/i18n/language-context";
import { formatAmount } from "@/lib/format";
import { itemTypeLabel } from "@/lib/i18n/labels";
import { useCatalog } from "@/hooks/use-catalog";
import { usePlanFeature } from "@/hooks/use-usage";

export default function CataloguePage() {
  const { t } = useI18n();
  const catalogAccess = usePlanFeature("catalog");
  const { data: items, isLoading } = useCatalog();
  const [query, setQuery] = useState("");

  const filtered = (items ?? []).filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase()),
  );

  if (!catalogAccess.loading && !catalogAccess.enabled) {
    return (
      <div>
        <ScreenHeader title={t.catalog_title} />
        <div className="px-4 pt-8">
          <Card className="p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF0F4] text-navy">
              <Lock size={22} />
            </div>
            <h2 className="mt-4 text-[17px] font-extrabold text-navy">
              {t.catalog_locked_title}
            </h2>
            <p className="mt-2 text-[13.5px] text-[#5A6377]">
              {t.catalog_locked_sub}
            </p>
            <Button asChild variant="accent" className="mt-5 w-full">
              <Link href="/offres">{t.catalog_upgrade}</Link>
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader
        title={t.catalog_title}
        action={
          <Button asChild size="sm" variant="accent">
            <Link href="/catalogue/nouveau">
              <Plus size={15} /> {t.new_short}
            </Link>
          </Button>
        }
      />
      <div className="px-4 pt-4">
        <div className="relative">
          <Search
            size={17}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A6ADBD]"
          />
          <Input
            className="pl-11"
            placeholder={t.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <ListSkeleton />
          ) : filtered.length === 0 ? (
            <Card className="p-6 text-center text-[14px] text-[#8A93A6]">
              {t.catalog_empty}
            </Card>
          ) : (
            filtered.map((item) => (
              <Link
                key={item.id}
                href={`/catalogue/${item.id}`}
                className="flex items-center gap-3 rounded-2xl border border-[#E9EBF0] bg-white p-4 transition-colors hover:border-[#C3C9D5]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {item.is_favorite && (
                      <Star size={13} className="fill-warning text-warning" />
                    )}
                    <span className="truncate text-[15px] font-bold text-navy">
                      {item.name}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-[#5A6377]">
                    {formatAmount(item.unit_price)} / {item.unit}
                  </div>
                </div>
                <Badge
                  bg={item.type === "produit" ? "#E8EFFD" : "#E4F5EE"}
                  color={item.type === "produit" ? "#2E6BE6" : "#1E9E6A"}
                >
                  {itemTypeLabel(t, item.type)}
                </Badge>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
