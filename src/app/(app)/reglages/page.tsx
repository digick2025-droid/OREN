"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, CreditCard, LogOut } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/features/company/company-context";
import { useUsage } from "@/hooks/use-usage";

export default function ReglagesPage() {
  const router = useRouter();
  const company = useCompany();
  const { data: usage } = useUsage();
  const supabase = createClient();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div>
      <ScreenHeader title="Réglages" />
      <div className="space-y-4 px-4 pt-4">
        <Card>
          <Link
            href="/entreprise"
            className="flex items-center gap-3 px-4 py-4"
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[15px] font-extrabold text-white"
              style={{ backgroundColor: company.color }}
            >
              {company.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-navy">
                {company.name}
              </div>
              <div className="flex items-center gap-1 text-[12.5px] text-[#5A6377]">
                <Building2 size={12} /> Profil entreprise
              </div>
            </div>
            <ChevronRight size={18} className="text-[#A6ADBD]" />
          </Link>
        </Card>

        <Card>
          <Link
            href="/abonnement"
            className="flex items-center gap-3 px-4 py-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF0F4] text-navy">
              <CreditCard size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold text-navy">Abonnement</div>
              <div className="text-[12.5px] text-[#5A6377]">
                {usage ? usage.plan_name : "…"}
              </div>
            </div>
            <ChevronRight size={18} className="text-[#A6ADBD]" />
          </Link>
        </Card>

        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#E9EBF0] bg-white px-4 py-4 text-[14px] font-semibold text-danger"
        >
          <LogOut size={17} /> Se déconnecter
        </button>

        <p className="pt-2 text-center text-[11.5px] text-[#A6ADBD]">
          DIGICK Devis · MVP 1.0
        </p>
      </div>
    </div>
  );
}
