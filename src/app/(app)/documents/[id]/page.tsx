"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Eye, FileText, Send, Trash2 } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DOCUMENT_STATUSES,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/constants";
import { formatAmount, formatDate } from "@/lib/format";
import { useCompany } from "@/features/company/company-context";
import {
  isQuotaError,
  useConvertToInvoice,
  useDeleteDocument,
  useDocument,
  useUpdateDocumentStatus,
} from "@/hooks/use-documents";
import {
  printDocument,
  renderDocumentHtml,
  toPdfCompany,
  toPdfData,
} from "@/services/pdf";
import { buildDocumentShareLink } from "@/services/whatsapp";

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const company = useCompany();
  const { data, isLoading } = useDocument(id);
  const updateStatus = useUpdateDocumentStatus();
  const convertToInvoice = useConvertToInvoice();
  const deleteDocument = useDeleteDocument();

  if (isLoading || !data) {
    return (
      <div>
        <ScreenHeader title="Document" backHref="/documents" />
      </div>
    );
  }

  const { document: doc, items } = data;
  const isQuote = doc.type === "devis";

  const openPdf = () => {
    const html = renderDocumentHtml(toPdfData(doc, items), toPdfCompany(company));
    if (!printDocument(html)) {
      toast.error("Autorisez les fenêtres pop-up pour télécharger");
    }
  };

  const shareWhatsApp = () => {
    window.open(buildDocumentShareLink(doc, company.name), "_blank");
    if (doc.status === "brouillon") {
      updateStatus.mutate({ id: doc.id, status: "envoye" });
    }
  };

  const convert = () => {
    convertToInvoice.mutate(doc.id, {
      onSuccess: (invoice) => {
        toast.success(`Facture créée · ${invoice.number}`);
        router.push(`/documents/${invoice.id}`);
      },
      onError: (error) => {
        if (isQuotaError(error)) {
          toast.error("Limite mensuelle atteinte");
          router.push("/offres");
          return;
        }
        toast.error("Conversion impossible");
      },
    });
  };

  const remove = () => {
    deleteDocument.mutate(doc.id, {
      onSuccess: () => {
        toast.success("Supprimé");
        router.push("/documents");
      },
      onError: () => toast.error("Suppression impossible"),
    });
  };

  return (
    <div>
      <ScreenHeader title={doc.number} backHref="/documents" />

      <div className="space-y-5 px-4 pb-10 pt-5">
        <Card className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[12px] font-semibold text-[#8A93A6]">
                {isQuote ? "Devis" : "Facture"} ·{" "}
                {formatDate(doc.created_at)}
              </div>
              <div className="mt-0.5 text-[17px] font-extrabold text-navy">
                {doc.title || doc.client_name || "Sans titre"}
              </div>
              <div className="text-[13px] text-[#5A6377]">
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
          <div className="mb-2 text-[13px] font-semibold text-[#5A6377]">
            Statut
          </div>
          <div className="flex flex-wrap gap-2">
            {DOCUMENT_STATUSES.map((status) => {
              const style = STATUS_STYLES[status];
              const active = doc.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    updateStatus.mutate({ id: doc.id, status })
                  }
                >
                  <Badge
                    bg={active ? style.color : style.bg}
                    color={active ? "#fff" : style.color}
                    className="px-3 py-1.5 text-[12px]"
                  >
                    {STATUS_LABELS[status]}
                  </Badge>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 text-[13px] font-semibold text-[#5A6377]">
            Éléments
          </div>
          <Card className="divide-y divide-[#F0F1F5]">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <div className="text-[14px] font-semibold text-navy">
                    {item.name}
                  </div>
                  <div className="text-[12px] text-[#8A93A6]">
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
              <div className="flex justify-between text-[13px] text-[#5A6377]">
                <span>Sous-total</span>
                <span>{formatAmount(doc.subtotal)}</span>
              </div>
              {doc.discount > 0 && (
                <div className="flex justify-between text-[13px] text-[#5A6377]">
                  <span>Remise</span>
                  <span>− {formatAmount(doc.discount)}</span>
                </div>
              )}
              {doc.vat_enabled && doc.vat_rate > 0 && (
                <div className="flex justify-between text-[13px] text-[#5A6377]">
                  <span>TVA {doc.vat_rate}%</span>
                  <span>{formatAmount(doc.vat_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-[15px] font-extrabold text-navy">
                <span>Total</span>
                <span>{formatAmount(doc.total)}</span>
              </div>
            </div>
          </Card>
        </section>

        {(doc.note || doc.conditions) && (
          <Card className="space-y-2 p-4 text-[13px] text-[#5A6377]">
            {doc.conditions && (
              <div>
                <span className="font-bold text-navy">Conditions : </span>
                {doc.conditions}
              </div>
            )}
            {doc.note && (
              <div>
                <span className="font-bold text-navy">Note : </span>
                {doc.note}
              </div>
            )}
          </Card>
        )}

        <section className="space-y-3">
          <Button className="w-full" onClick={openPdf}>
            <Eye size={17} /> Aperçu PDF
          </Button>
          <Button variant="whatsapp" className="w-full" onClick={shareWhatsApp}>
            <Send size={17} /> Envoyer sur WhatsApp
          </Button>
          {isQuote && (
            <Button
              variant="outline"
              className="w-full"
              onClick={convert}
              disabled={convertToInvoice.isPending}
            >
              <FileText size={17} /> Convertir en facture
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/nouveau?type=${doc.type}`)}
          >
            <Copy size={17} /> Dupliquer
          </Button>
          <Button
            variant="destructive"
            className="w-full"
            onClick={remove}
            disabled={deleteDocument.isPending}
          >
            <Trash2 size={17} /> Supprimer le document
          </Button>
        </section>
      </div>
    </div>
  );
}
