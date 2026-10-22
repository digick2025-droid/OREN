"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileText,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { markDocumentShared } from "@/components/install-prompt";
import { PushInvite } from "@/components/push-invite";
import { ScreenHeader } from "@/components/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCompany } from "@/features/company/company-context";
import { useI18n } from "@/features/i18n/language-context";
import { FREE_LAUNCH } from "@/lib/billing";
import { computeCategoryTotals } from "@/lib/calculations";
import { DOCUMENT_STATUSES, STATUS_SOLID, STATUS_VARIANT } from "@/lib/constants";
import { track } from "@/lib/analytics";
import { formatAmount, formatDate } from "@/lib/format";
import { statusLabel, typeLabel } from "@/lib/i18n/labels";
import { noterProposition, peutProposer } from "@/lib/push-invite";
import { cn } from "@/lib/utils";
import {
  isQuotaError,
  useConvertToInvoice,
  useDeleteDocument,
  useDocument,
  useUpdateDocumentStatus,
} from "@/hooks/use-documents";
import { useReferralInfo } from "@/hooks/use-referral";
import { usePlanFeature, useUsage } from "@/hooks/use-usage";
import { buildReferralLink } from "@/lib/referral";
import {
  downloadPdf as downloadPdfFile,
  previewDocument,
  renderDocumentHtml,
  sharePdf,
  toPdfCompany,
  toPdfData,
} from "@/services/pdf";
import { buildDocumentMessage, buildDocumentShareLink } from "@/services/whatsapp";

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const justCreated = useSearchParams().get("created") === "1";
  const company = useCompany();
  const { t, lang } = useI18n();
  const { data, isLoading } = useDocument(id);
  const updateStatus = useUpdateDocumentStatus();
  const convertToInvoice = useConvertToInvoice();
  const deleteDocument = useDeleteDocument();
  // Branding Startup : la fonctionnalité « logo » débloque le PDF personnalisé
  const { enabled: premiumBranding } = usePlanFeature("logo");
  const { data: usage } = useUsage();
  // Lien de parrainage dans la mention « Créé avec OREN » des PDF gratuits :
  // un client de l'artisan qui s'inscrit par là le fait récompenser. Sans
  // code (chargement, migration absente), simple lien d'inscription.
  const { data: referral } = useReferralInfo();
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [invitePush, setInvitePush] = useState(false);

  if (isLoading || !data) {
    return (
      <div>
        <ScreenHeader title={t.docs_title} backHref="/documents" />
      </div>
    );
  }

  const { document: doc, items } = data;
  const isConvertible = doc.type === "devis" || doc.type === "proforma";
  const remaining = Math.max(doc.total - doc.advance_amount, 0);
  const categoryTotals = computeCategoryTotals(items);
  const hasCategorySplit =
    categoryTotals.main_oeuvre > 0 || categoryTotals.transport > 0;

  const buildDocHtml = () =>
    renderDocumentHtml(
      toPdfData(doc, items),
      toPdfCompany(company, {
        premiumBranding,
        signupUrl: referral?.code
          ? buildReferralLink(window.location.origin, referral.code)
          : `${window.location.origin}/inscription`,
      }),
      lang,
    );

  const openPdf = () => {
    if (!previewDocument(buildDocHtml())) {
      toast.error(t.pdf_popup);
    }
  };

  // Nom de fichier lisible, ex. « Devis DEV-2025-0001 ».
  const docName = () => `${typeLabel(t, doc.type)} ${doc.number}`;

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadPdfFile(buildDocHtml(), docName());
    } catch {
      toast.error(t.pdf_error);
    } finally {
      setDownloading(false);
    }
  };

  const shareWhatsApp = async () => {
    setSharing(true);
    try {
      const text = buildDocumentMessage(doc, company.name, lang);
      const result = await sharePdf({ html: buildDocHtml(), name: docName(), text });
      if (result === "error") {
        toast.error(t.pdf_error);
        return;
      }
      if (result === "unsupported") {
        // Appareil sans partage de fichier (desktop) : lien wa.me texte court.
        window.open(buildDocumentShareLink(doc, company.name, lang), "_blank");
      }
      markDocumentShared();
      track("document_shared", {
        type: doc.type,
        channel: result === "unsupported" ? "link" : "file",
        first_share: doc.status === "brouillon",
        since_created_ms: Math.max(0, Date.now() - Date.parse(doc.created_at)),
      });
      if (doc.status === "brouillon") {
        updateStatus.mutate({ id: doc.id, status: "envoye" });

        // Le document vient de partir : c'est le seul moment où la relance
        // s'explique d'elle-même. Proposée à l'ouverture de l'application, la
        // permission se fait refuser d'un réflexe — et un refus est définitif.
        if (await peutProposer()) {
          noterProposition();
          setInvitePush(true);
        }
      }
    } finally {
      setSharing(false);
    }
  };

  const convert = () => {
    convertToInvoice.mutate(doc.id, {
      onSuccess: (invoice) => {
        toast.success(`${t.toast_facture_created} · ${invoice.number}`);
        router.push(`/documents/${invoice.id}`);
      },
      onError: (error) => {
        if (isQuotaError(error)) {
          toast.error(
            usage?.quota_lifetime ? t.toast_limit_lifetime : t.toast_limit,
          );
          router.push(FREE_LAUNCH ? "/offres" : "/paiement/document");
          return;
        }
        toast.error(t.toast_convert_error);
      },
    });
  };

  const remove = () => {
    if (!window.confirm(t.doc_delete_confirm)) return;
    deleteDocument.mutate(doc.id, {
      onSuccess: () => {
        toast.success(t.toast_deleted);
        router.push("/documents");
      },
      onError: () => toast.error(t.toast_delete_error),
    });
  };

  return (
    <div>
      <ScreenHeader title={doc.number} backHref="/documents" />

      <div className="space-y-5 px-4 pb-10 pt-5">
        {justCreated && doc.status === "brouillon" && (
          <div className="rounded-xl bg-success/10 px-4 py-3">
            <div className="flex items-center gap-2 text-[15px] font-extrabold text-navy">
              <CheckCircle2 size={18} className="text-success" />
              {t.created_title}
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {t.created_sub}
            </p>
          </div>
        )}

        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[12px] font-semibold text-muted-foreground/70">
                {typeLabel(t, doc.type)} · {formatDate(doc.created_at)}
              </div>
              <div className="mt-0.5 text-[17px] font-extrabold text-navy">
                {doc.title || doc.client_name || t.untitled}
              </div>
              <div className="text-[13px] text-muted-foreground">
                {doc.client_name || "—"}
                {doc.client_phone ? ` · ${doc.client_phone}` : ""}
              </div>
            </div>
            <div className="text-right text-[17px] font-extrabold text-navy">
              {formatAmount(doc.total)}
            </div>
          </div>
        </Card>

        <section>
          <div className="mb-2 text-[13px] font-semibold text-muted-foreground">
            {t.doc_status}
          </div>
          <div className="flex flex-wrap gap-2">
            {DOCUMENT_STATUSES.map((status) => {
              const active = doc.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateStatus.mutate({ id: doc.id, status })}
                >
                  <Badge
                    variant={STATUS_VARIANT[status]}
                    className={cn("px-3 py-1.5 text-[12px]", active && STATUS_SOLID[status])}
                  >
                    {statusLabel(t, status)}
                  </Badge>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 text-[13px] font-semibold text-muted-foreground">
            {t.doc_items}
          </div>
          <Card className="divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="text-[14px] font-semibold text-navy">
                    {item.name}
                  </div>
                  <div className="text-[12px] text-muted-foreground/70">
                    {item.quantity} {item.unit} ×{" "}
                    {formatAmount(item.unit_price)}
                  </div>
                </div>
                <div className="text-[14px] font-bold text-navy">
                  {formatAmount(item.line_total)}
                </div>
              </div>
            ))}
            <div className="space-y-1 px-4 py-3">
              {hasCategorySplit && (
                <>
                  <div className="flex justify-between text-[13px] text-muted-foreground">
                    <span>{t.cat_article_total}</span>
                    <span>{formatAmount(categoryTotals.article)}</span>
                  </div>
                  {categoryTotals.main_oeuvre > 0 && (
                    <div className="flex justify-between text-[13px] text-muted-foreground">
                      <span>{t.cat_main_oeuvre_total}</span>
                      <span>{formatAmount(categoryTotals.main_oeuvre)}</span>
                    </div>
                  )}
                  {categoryTotals.transport > 0 && (
                    <div className="flex justify-between text-[13px] text-muted-foreground">
                      <span>{t.cat_transport_total}</span>
                      <span>{formatAmount(categoryTotals.transport)}</span>
                    </div>
                  )}
                  <div className="border-t border-dashed border-muted" />
                </>
              )}
              <div className="flex justify-between text-[13px] text-muted-foreground">
                <span>{t.subtotal}</span>
                <span>{formatAmount(doc.subtotal)}</span>
              </div>
              {doc.discount > 0 && (
                <div className="flex justify-between text-[13px] text-muted-foreground">
                  <span>{t.discount}</span>
                  <span>− {formatAmount(doc.discount)}</span>
                </div>
              )}
              {doc.vat_enabled && doc.vat_rate > 0 && (
                <div className="flex justify-between text-[13px] text-muted-foreground">
                  <span>TVA {doc.vat_rate}%</span>
                  <span>{formatAmount(doc.vat_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-[15px] font-extrabold text-navy">
                <span>{t.total}</span>
                <span>{formatAmount(doc.total)}</span>
              </div>
              {doc.advance_amount > 0 && (
                <>
                  <div className="flex justify-between text-[13px] text-muted-foreground">
                    <span>{t.advance_paid}</span>
                    <span>− {formatAmount(doc.advance_amount)}</span>
                  </div>
                  <div className="flex justify-between text-[14px] font-bold text-coral">
                    <span>{t.remaining_to_pay}</span>
                    <span>{formatAmount(remaining)}</span>
                  </div>
                </>
              )}
            </div>
          </Card>
        </section>

        {(doc.note || doc.conditions) && (
          <Card className="space-y-2 p-4 text-[13px] text-muted-foreground">
            {doc.conditions && (
              <div>
                <span className="font-bold text-navy">
                  {t.doc_conditions} :{" "}
                </span>
                {doc.conditions}
              </div>
            )}
            {doc.note && (
              <div>
                <span className="font-bold text-navy">{t.doc_note} : </span>
                {doc.note}
              </div>
            )}
          </Card>
        )}

        {/* La promesse produit, c'est l'envoi WhatsApp : il passe en premier.
            Le reste (aperçu, PDF, modifications) vient ensuite, la
            suppression tout en bas, derrière une confirmation. */}
        <section className="space-y-3">
          <Button
            variant="whatsapp"
            size="lg"
            className="w-full"
            onClick={() => void shareWhatsApp()}
            disabled={sharing}
          >
            <Send size={18} /> {sharing ? t.pdf_generating : t.wa_send}
          </Button>
          {/* Un PDF sans numéro de contact fait amateur : on le signale au
              moment où le document part, avec un accès direct au profil. */}
          {justCreated && !company.phone && (
            <Link
              href="/entreprise"
              className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-[12.5px] font-semibold text-muted-foreground hover:border-navy hover:text-navy"
            >
              {t.created_nudge}
              <ChevronRight size={16} className="shrink-0" />
            </Link>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={openPdf}>
              <Eye size={17} /> {t.doc_preview}
            </Button>
            <Button
              variant="outline"
              onClick={() => void downloadPdf()}
              disabled={downloading}
            >
              <Download size={17} />{" "}
              {downloading ? t.pdf_generating : t.doc_download_short}
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/documents/${doc.id}/modifier`)}
          >
            <Pencil size={17} /> {t.edit_document}
          </Button>
          {isConvertible && (
            <Button
              variant="outline"
              className="w-full"
              onClick={convert}
              disabled={convertToInvoice.isPending}
            >
              <FileText size={17} /> {t.doc_convert}
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/nouveau?type=${doc.type}&from=${doc.id}`)}
          >
            <Copy size={17} /> {t.doc_duplicate}
          </Button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 py-2 text-[13px] font-semibold text-danger disabled:opacity-50"
            onClick={remove}
            disabled={deleteDocument.isPending}
          >
            <Trash2 size={15} /> {t.doc_delete}
          </button>
        </section>
      </div>

      <PushInvite open={invitePush} onClose={() => setInvitePush(false)} />
    </div>
  );
}
