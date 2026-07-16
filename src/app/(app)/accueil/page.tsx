"use client";

import Link from "next/link";
import { FileText, Plus, UserPlus } from "lucide-react";
import { DocumentCard } from "@/components/document-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCompany } from "@/features/company/company-context";
import { useDocuments } from "@/hooks/use-documents";
import { useUsage } from "@/hooks/use-usage";

export default function AccueilPage() {
  const company = useCompany();
  const { data: documents } = useDocuments();
  const { data: usage } = useUsage();

  const recent = (documents ?? []).slice(0, 3);

  return (
    <div className="px-4 pt-6">
      <p className="text-[14px] text-[#5A6377]">Bonjour</p>
      <h1 className="text-[24px] font-extrabold text-navy">
        {company.owner_name || company.name}
      </h1>

      {usage ? (
        <Card className="mt-5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-semibold text-[#8A93A6]">
                Documents ce mois
              </div>
              <div className="text-[22px] font-extrabold text-navy">
                {usage.used}
                {usage.quota !== null && usage.quota > 0 && (
                  <span className="text-[14px] font-semibold text-[#8A93A6]">
                    {" "}
                    / {usage.quota}
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/abonnement"
              className="rounded-full bg-[#EEF0F4] px-3.5 py-1.5 text-[12px] font-bold text-navy"
            >
              {usage.plan_name}
            </Link>
          </div>
          {usage.quota !== null &&
            usage.quota > 0 &&
            usage.used >= usage.quota && (
              <p className="mt-2 text-[12.5px] font-semibold text-coral">
                Limite atteinte — passez à une offre supérieure.
              </p>
            )}
        </Card>
      ) : null}

      <Button asChild variant="accent" size="lg" className="mt-5 w-full">
        <Link href="/nouveau?type=devis">
          <Plus size={19} /> Créer un devis
        </Link>
      </Button>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button asChild variant="outline">
          <Link href="/nouveau?type=facture">
            <FileText size={17} /> Nouvelle facture
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/clients/nouveau">
            <UserPlus size={17} /> Ajouter un client
          </Link>
        </Button>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-navy">Derniers documents</h2>
        <Link
          href="/documents"
          className="text-[13px] font-semibold text-[#5A6377]"
        >
          Tout voir
        </Link>
      </div>

      <div className="mt-3 space-y-3">
        {recent.length === 0 ? (
          <Card className="p-6 text-center text-[14px] text-[#8A93A6]">
            Aucun document pour le moment.
            <br />
            Créez votre premier devis !
          </Card>
        ) : (
          recent.map((doc) => <DocumentCard key={doc.id} document={doc} />)
        )}
      </div>
    </div>
  );
}
