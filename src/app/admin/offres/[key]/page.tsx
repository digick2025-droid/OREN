"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanForm } from "@/features/admin/plan-form";
import { useAdminPlans } from "@/hooks/use-admin-plans";

export default function AdminOffreDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = use(params);
  const { data: plans, isLoading } = useAdminPlans();
  const plan = plans?.find((p) => p.key === key);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/admin/offres"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} /> Offres
        </Link>
        <h1 className="mt-2 text-xl font-bold text-navy">
          {plan ? plan.name : "Offre"}
        </h1>
      </div>

      {isLoading || !plan ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <PlanForm plan={plan} />
      )}
    </div>
  );
}
