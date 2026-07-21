"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PromoCodeForm } from "@/features/admin/promo-code-form";
import { useAdminPromoCode } from "@/hooks/use-admin-promo-codes";

export default function EditPromoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: promo, isLoading } = useAdminPromoCode(id);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/admin/promos"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} /> Codes promo
        </Link>
        <h1 className="mt-2 text-xl font-bold text-navy">
          {promo ? promo.code : "Code promo"}
        </h1>
      </div>

      {isLoading || !promo ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <PromoCodeForm promo={promo} />
      )}
    </div>
  );
}
