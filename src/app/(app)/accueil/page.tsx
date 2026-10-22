"use client";

import Link from "next/link";
import { FileSignature, FileText, Plus, UserPlus } from "lucide-react";
import { DocumentCard } from "@/components/document-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCompany } from "@/features/company/company-context";
import { useI18n } from "@/features/i18n/language-context";
import { FREE_LAUNCH } from "@/lib/billing";
import { useDocuments } from "@/hooks/use-documents";
import { usePlanFeature, useUsage } from "@/hooks/use-usage";

export default function AccueilPage() {
  const company = useCompany();
  const { t } = useI18n();
  const { data: documents } = useDocuments();
  const { data: usage } = useUsage();
  const proformaAccess = usePlanFeature("proforma");

  const recent = (documents ?? []).slice(0, 3);
  // Compte sans aucun document : un seul chemin, le premier devis. Les
  // raccourcis facture / proforma / client viendront quand ils auront un sens.
  const firstRun = documents !== undefined && documents.length === 0;

  if (firstRun) {
    const steps = [t.first_step1, t.first_step2, t.first_step3];
    return (
      <div className="px-4 pt-6">
        <p className="text-[14px] text-muted-foreground">{t.home_hello}</p>
        <h1 className="text-[24px] font-extrabold text-navy">
          {company.owner_name || company.name}
        </h1>

        <Card className="mt-5 p-5">
          <h2 className="text-[18px] font-extrabold text-navy">
            {t.first_title}
          </h2>
          <ol className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-[14px]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-extrabold text-primary-foreground">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <Button asChild variant="accent" size="lg" className="mt-5 w-full">
            <Link href="/nouveau?type=devis">
              <Plus size={19} /> {t.first_cta}
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <p className="text-[14px] text-muted-foreground">{t.home_hello}</p>
      <h1 className="text-[24px] font-extrabold text-navy">
        {company.owner_name || company.name}
      </h1>

      {usage ? (
        <Card className="mt-5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-semibold text-muted-foreground/70">
                {usage.quota_lifetime ? t.counter_total : t.counter_month}
              </div>
              <div className="text-[22px] font-extrabold text-navy">
                {usage.used}
                {usage.quota !== null && usage.quota > 0 && (
                  <span className="text-[14px] font-semibold text-muted-foreground/70">
                    {" "}
                    / {usage.quota}
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/abonnement"
              className="rounded-full bg-muted px-3.5 py-1.5 text-[12px] font-bold text-navy"
            >
              {usage.plan_name}
            </Link>
          </div>
          {usage.quota !== null &&
            usage.quota > 0 &&
            usage.used >= usage.quota && (
              <p className="mt-2 text-[12.5px] font-semibold text-coral">
                {usage.credits > 0
                  ? t.counter_credits.replace("{n}", String(usage.credits))
                  : t.counter_limit}
              </p>
            )}
          {!FREE_LAUNCH &&
            usage.quota !== null &&
            usage.quota > 0 &&
            usage.used >= usage.quota &&
            usage.credits === 0 && (
              <Link
                href="/paiement/document"
                className="mt-2 inline-block text-[12.5px] font-bold text-navy underline"
              >
                {t.buy_doc_cta}
              </Link>
            )}
        </Card>
      ) : null}

      <Button asChild variant="accent" size="lg" className="mt-5 w-full">
        <Link href="/nouveau?type=devis">
          <Plus size={19} /> {t.home_cta}
        </Link>
      </Button>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button asChild variant="outline">
          <Link href="/nouveau?type=facture">
            <FileText size={17} /> {t.home_invoice}
          </Link>
        </Button>
        {proformaAccess.enabled ? (
          <Button asChild variant="outline">
            <Link href="/nouveau?type=proforma">
              <FileSignature size={17} /> {t.home_proforma}
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href="/clients/nouveau">
              <UserPlus size={17} /> {t.home_addclient}
            </Link>
          </Button>
        )}
      </div>
      {proformaAccess.enabled && (
        <Button asChild variant="outline" className="mt-3 w-full">
          <Link href="/clients/nouveau">
            <UserPlus size={17} /> {t.home_addclient}
          </Link>
        </Button>
      )}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-navy">{t.home_recent}</h2>
        <Link
          href="/documents"
          className="text-[13px] font-semibold text-muted-foreground"
        >
          {t.see_all}
        </Link>
      </div>

      <div className="mt-3 space-y-3">
        {recent.length === 0 ? (
          <Card className="whitespace-pre-line p-6 text-center text-[14px] text-muted-foreground/70">
            {t.home_empty}
          </Card>
        ) : (
          recent.map((doc) => <DocumentCard key={doc.id} document={doc} />)
        )}
      </div>
    </div>
  );
}
