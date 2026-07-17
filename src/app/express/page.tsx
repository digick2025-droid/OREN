"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Lock, Minus, Plus, Send, Trash2 } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaymentForm } from "@/features/payments/payment-form";
import { useI18n } from "@/features/i18n/language-context";
import { computeTotals, parseQuantity } from "@/lib/calculations";
import { DEFAULT_COMPANY_COLOR } from "@/lib/constants";
import { formatAmount } from "@/lib/format";
import { printDocument, renderDocumentHtml } from "@/services/pdf";
import { buildWhatsAppLink } from "@/services/whatsapp";

interface ExpressLine {
  uid: number;
  name: string;
  qty: string;
  unit_price: number;
}

type Step = "form" | "preview" | "pay" | "done";

const EXPRESS_PRICE = 500;

let uidCounter = 1;

export default function ExpressPage() {
  const { t, lang } = useI18n();
  const [step, setStep] = useState<Step>("form");
  const [businessName, setBusinessName] = useState("");
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [lines, setLines] = useState<ExpressLine[]>([
    { uid: uidCounter++, name: "", qty: "1", unit_price: 0 },
  ]);

  const totals = useMemo(
    () =>
      computeTotals(
        lines.map((l) => ({
          quantity: parseQuantity(l.qty),
          unit_price: l.unit_price,
        })),
      ),
    [lines],
  );

  const updateLine = (uid: number, patch: Partial<ExpressLine>) =>
    setLines((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)),
    );

  const stepQty = (uid: number, delta: number) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.uid !== uid) return l;
        const next = Math.max(parseQuantity(l.qty) + delta, 0);
        const str = Number.isInteger(next) ? String(next) : next.toFixed(1);
        return { ...l, qty: str };
      }),
    );

  const buildHtml = () =>
    renderDocumentHtml(
      {
        type: "devis",
        number: "DEV-EXP",
        title: title.trim(),
        issueDate: new Date().toISOString(),
        clientName,
        clientPhone,
        lines: lines
          .filter((l) => l.name.trim())
          .map((l) => {
            const quantity = parseQuantity(l.qty);
            return {
              name: l.name,
              unit: "unité",
              quantity,
              unitPrice: l.unit_price,
              lineTotal: Math.round(quantity * l.unit_price),
            };
          }),
        subtotal: totals.subtotal,
        discount: 0,
        vatRate: 0,
        vatAmount: 0,
        total: totals.total,
        advanceAmount: 0,
        note: "",
        conditions: "",
      },
      {
        name: businessName || "Mon entreprise",
        ownerName: "",
        slogan: "",
        phone: "",
        whatsapp: "",
        address: "",
        email: "",
        logoUrl: "",
        color: DEFAULT_COMPANY_COLOR,
        rccm: "",
        nif: "",
        taxRegime: "",
      },
      lang,
    );

  const goPreview = () => {
    if (!businessName.trim()) {
      toast.error(t.x_need_company);
      return;
    }
    if (!lines.some((l) => l.name.trim() && l.unit_price > 0)) {
      toast.error(t.x_need_items);
      return;
    }
    setStep("preview");
  };

  const download = () => {
    if (!printDocument(buildHtml())) {
      toast.error(t.pdf_popup);
    }
  };

  const shareWhatsApp = () => {
    const message = [
      `${t.wa_hello} ${clientName}`.trim() + ",",
      "",
      `${t.wa_here_is} ${t.wa_your_quote}${title.trim() ? ` — ${title.trim()}` : ""}. ${t.wa_amount} : ${formatAmount(totals.total)}.`,
      "",
      businessName,
    ].join("\n");
    window.open(buildWhatsAppLink(clientPhone, message), "_blank");
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-[#F4F5F7] pb-10">
      {step === "form" && (
        <>
          <ScreenHeader title={t.x_title} backHref="/" />
          <div className="space-y-5 px-4 pt-5">
            <div>
              <Label htmlFor="x-business">{t.x_business_label}</Label>
              <Input
                id="x-business"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t.x_company_ph}
              />
            </div>
            <div>
              <Label htmlFor="x-title">{t.x_doc_title}</Label>
              <Input
                id="x-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.q_title_ph}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="x-client">{t.x_client_label}</Label>
                <Input
                  id="x-client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder={t.x_client_ph}
                />
              </div>
              <div>
                <Label htmlFor="x-phone">{t.x_client_phone}</Label>
                <Input
                  id="x-phone"
                  inputMode="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="6 90 00 00 00"
                />
              </div>
            </div>

            <div>
              <Label>{t.q_items_label}</Label>
              <div className="space-y-3">
                {lines.map((line) => (
                  <Card key={line.uid} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <Input
                        className="h-9 rounded-lg border-transparent px-1 text-[14px] font-semibold focus-visible:border-[#E2E5EC]"
                        value={line.name}
                        placeholder={t.q_free_ph}
                        onChange={(e) =>
                          updateLine(line.uid, { name: e.target.value })
                        }
                      />
                      {lines.length > 1 && (
                        <button
                          type="button"
                          aria-label={t.delete}
                          onClick={() =>
                            setLines((prev) =>
                              prev.filter((l) => l.uid !== line.uid),
                            )
                          }
                          className="mt-1 shrink-0 text-[#A6ADBD] hover:text-danger"
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="−"
                          onClick={() => stepQty(line.uid, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF0F4] text-navy"
                        >
                          <Minus size={14} />
                        </button>
                        <Input
                          className="h-8 w-16 rounded-lg px-1 text-center text-[14px] font-bold"
                          inputMode="decimal"
                          value={line.qty}
                          onChange={(e) =>
                            updateLine(line.uid, {
                              qty: e.target.value.replace(/[^\d.,/]/g, ""),
                            })
                          }
                        />
                        <button
                          type="button"
                          aria-label="+"
                          onClick={() => stepQty(line.uid, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF0F4] text-navy"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          className="h-9 w-24 rounded-lg px-2 text-right text-[14px] font-semibold"
                          inputMode="numeric"
                          value={String(line.unit_price)}
                          onChange={(e) =>
                            updateLine(line.uid, {
                              unit_price:
                                parseInt(
                                  e.target.value.replace(/[^\d]/g, ""),
                                  10,
                                ) || 0,
                            })
                          }
                        />
                        <span className="text-[12px] text-[#8A93A6]">
                          FCFA
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { uid: uidCounter++, name: "", qty: "1", unit_price: 0 },
                  ])
                }
                className="mt-3 w-full rounded-xl border-[1.5px] border-dashed border-[#C3C9D5] py-3 text-[13.5px] font-semibold text-[#5A6377] hover:border-navy"
              >
                + {t.q_add_line}
              </button>
              <p className="mt-1.5 text-[11.5px] text-[#A6ADBD]">
                {t.q_qty_hint}
              </p>
            </div>

            <Card className="flex items-center justify-between p-4">
              <span className="text-[14px] font-semibold text-[#5A6377]">
                {t.total}
              </span>
              <span className="text-[18px] font-extrabold text-navy">
                {formatAmount(totals.total)}
              </span>
            </Card>

            <Button
              variant="accent"
              size="lg"
              className="w-full"
              onClick={goPreview}
            >
              {t.x_preview_cta}
            </Button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <ScreenHeader title={t.x_preview} onBack={() => setStep("form")} />
          <div className="space-y-4 px-4 pt-5">
            <div className="relative overflow-hidden rounded-2xl border border-[#E9EBF0] bg-white">
              <iframe
                title={t.x_preview}
                srcDoc={buildHtml()}
                className="pointer-events-none h-[420px] w-full origin-top"
              />
              <div className="absolute inset-x-0 bottom-0 flex h-28 items-end justify-center bg-gradient-to-t from-white to-transparent pb-4">
                <span className="flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-[12.5px] font-bold text-white">
                  <Lock size={13} /> {t.xpdf_lock}{" "}
                  {formatAmount(EXPRESS_PRICE)}
                </span>
              </div>
            </div>

            <Button
              variant="accent"
              size="lg"
              className="w-full"
              onClick={() => setStep("pay")}
            >
              {t.xpdf_pay} {formatAmount(EXPRESS_PRICE)}
            </Button>

            <p className="text-center text-[12.5px] text-[#8A93A6]">
              {t.xpdf_or}{" "}
              <Link href="/connexion" className="font-bold text-navy underline">
                {t.xpdf_create}
              </Link>{" "}
              {t.xpdf_gift}
            </p>
          </div>
        </>
      )}

      {step === "pay" && (
        <>
          <ScreenHeader title={t.pay_title} onBack={() => setStep("preview")} />
          <div className="px-4 pt-4">
            <PaymentForm
              amount={EXPRESS_PRICE}
              buttonLabel={`${t.pay_confirm} ${formatAmount(EXPRESS_PRICE)}`}
              onPay={async ({ method, phone }) => {
                const response = await fetch("/api/payments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    purpose: "express_document",
                    method,
                    phone,
                  }),
                });
                return { ok: response.ok };
              }}
              onSuccess={() => setStep("done")}
            />
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <ScreenHeader title={t.xdl_title} />
          <div className="space-y-4 px-4 pt-5">
            <p className="text-[14px] text-[#5A6377]">{t.xdl_sub}</p>
            <Button size="lg" className="w-full" onClick={download}>
              <Download size={18} /> {t.xdl_download}
            </Button>
            <Button
              variant="whatsapp"
              size="lg"
              className="w-full"
              onClick={shareWhatsApp}
            >
              <Send size={18} /> {t.xdl_wa}
            </Button>

            <Card className="p-5 text-center">
              <div className="text-[15px] font-extrabold text-navy">
                {t.xdl_acc_title}
              </div>
              <p className="mt-1.5 text-[13px] text-[#5A6377]">
                {t.xdl_acc_sub}
              </p>
              <Button asChild variant="accent" className="mt-4 w-full">
                <Link href="/connexion">{t.xdl_create}</Link>
              </Button>
            </Card>

            <button
              type="button"
              onClick={() => {
                setLines([
                  { uid: uidCounter++, name: "", qty: "1", unit_price: 0 },
                ]);
                setTitle("");
                setClientName("");
                setClientPhone("");
                setStep("form");
              }}
              className="w-full text-center text-[13px] font-semibold text-[#5A6377] underline"
            >
              {t.xdl_another}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
