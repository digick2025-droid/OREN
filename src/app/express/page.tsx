"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  Download,
  Lock,
  Minus,
  Plus,
  Send,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PaymentForm } from "@/features/payments/payment-form";
import { useI18n } from "@/features/i18n/language-context";
import {
  computeTotals,
  parseQuantity,
  remainingToPay,
} from "@/lib/calculations";
import { DEFAULT_COMPANY_COLOR } from "@/lib/constants";
import { formatAmount } from "@/lib/format";
import { downloadPdf, renderDocumentHtml, sharePdf } from "@/services/pdf";
import { buildWhatsAppLink } from "@/services/whatsapp";
import { cn } from "@/lib/utils";

interface ExpressLine {
  uid: number;
  name: string;
  qty: string;
  unit_price: number;
}

type Step = "form" | "preview" | "pay" | "done";
type DocKind = "devis" | "facture";

const EXPRESS_PRICE = 500;

let uidCounter = 1;

interface ExpressDraft {
  docKind: DocKind;
  businessName: string;
  title: string;
  clientName: string;
  clientPhone: string;
  lines: ExpressLine[];
  discount: string;
  advance: string;
  conditions: string;
}

/** Clé sessionStorage du brouillon sauvegardé avant un départ vers CamerPay. */
const draftKey = (reference: string) => `oren_express_draft_${reference}`;

export default function ExpressPage() {
  return (
    <Suspense fallback={null}>
      <ExpressPageContent />
    </Suspense>
  );
}

function ExpressPageContent() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("form");
  const [docKind, setDocKind] = useState<DocKind>("devis");
  const [businessName, setBusinessName] = useState("");
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [lines, setLines] = useState<ExpressLine[]>([
    { uid: uidCounter++, name: "", qty: "1", unit_price: 0 },
  ]);
  const [showOptions, setShowOptions] = useState(false);
  const [discount, setDiscount] = useState("");
  const [advance, setAdvance] = useState("");
  const [conditions, setConditions] = useState("");
  const [busy, setBusy] = useState(false);

  // Retour de CamerPay après un paiement réussi : l'état React a été perdu
  // pendant la redirection complète, on restaure le brouillon sauvegardé
  // juste avant de partir (voir onPay du step "pay") et on saute direct à
  // "done". Sans brouillon retrouvé (stockage vidé, autre appareil…) on
  // reste sur le formulaire vide — cas limite assumé d'un parcours anonyme.
  useEffect(() => {
    const paidRef = searchParams.get("paid");
    if (!paidRef) return;
    try {
      const raw = sessionStorage.getItem(draftKey(paidRef));
      if (raw) {
        const draft = JSON.parse(raw) as ExpressDraft;
        setDocKind(draft.docKind);
        setBusinessName(draft.businessName);
        setTitle(draft.title);
        setClientName(draft.clientName);
        setClientPhone(draft.clientPhone);
        setLines(draft.lines);
        uidCounter = Math.max(uidCounter, ...draft.lines.map((l) => l.uid + 1));
        setDiscount(draft.discount);
        setAdvance(draft.advance);
        setConditions(draft.conditions);
        setStep("done");
        sessionStorage.removeItem(draftKey(paidRef));
      }
    } catch {
      // Brouillon introuvable ou corrompu : on reste sur le formulaire vide.
    }
    router.replace("/express");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFacture = docKind === "facture";

  const totals = useMemo(
    () =>
      computeTotals(
        lines.map((l) => ({
          quantity: parseQuantity(l.qty),
          unit_price: l.unit_price,
        })),
        { discount: parseInt(discount, 10) || 0 },
      ),
    [lines, discount],
  );

  const advanceValue = isFacture ? parseInt(advance, 10) || 0 : 0;
  const remaining = remainingToPay(totals.total, advanceValue);

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
        type: docKind,
        number: isFacture ? "FAC-EXP" : "DEV-EXP",
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
        discount: totals.discount,
        vatRate: 0,
        vatAmount: 0,
        total: totals.total,
        advanceAmount: advanceValue,
        note: "",
        conditions: conditions.trim(),
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
        premiumBranding: false,
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

  const docName = () =>
    `${isFacture ? t.wa_your_invoice : t.wa_your_quote} ${
      isFacture ? "FAC-EXP" : "DEV-EXP"
    }`;

  const download = async () => {
    setBusy(true);
    try {
      await downloadPdf(buildHtml(), docName());
    } catch {
      toast.error(t.pdf_error);
    } finally {
      setBusy(false);
    }
  };

  const resetForm = () => {
    setLines([{ uid: uidCounter++, name: "", qty: "1", unit_price: 0 }]);
    setTitle("");
    setClientName("");
    setClientPhone("");
    setDiscount("");
    setAdvance("");
    setConditions("");
    setShowOptions(false);
    setStep("form");
  };

  const buildShareText = () => {
    const docLabel = isFacture ? t.wa_your_invoice : t.wa_your_quote;
    const amount = isFacture && advanceValue > 0 ? remaining : totals.total;
    return [
      `${t.wa_hello} ${clientName}`.trim() + ",",
      "",
      `${t.wa_here_is} ${docLabel}${title.trim() ? ` — ${title.trim()}` : ""}. ${t.wa_amount} : ${formatAmount(amount)}.`,
      "",
      businessName,
    ].join("\n");
  };

  const shareWhatsApp = async () => {
    setBusy(true);
    try {
      const result = await sharePdf({
        html: buildHtml(),
        name: docName(),
        text: buildShareText(),
      });
      if (result === "error") {
        toast.error(t.pdf_error);
        return;
      }
      if (result === "unsupported") {
        // Pas de partage de fichier (desktop) : lien wa.me texte.
        window.open(buildWhatsAppLink(clientPhone, buildShareText()), "_blank");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-surface pb-10">
      {step === "form" && (
        <>
          <ScreenHeader
            title={isFacture ? t.x_title_f : t.x_title}
            backHref="/"
          />
          <div className="space-y-5 px-4 pt-5">
            {/* ----- Type de document ----- */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              {(["devis", "facture"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setDocKind(kind)}
                  className={cn(
                    "rounded-lg py-2.5 text-[13.5px] font-bold transition-colors",
                    docKind === kind
                      ? "bg-card text-navy shadow-sm"
                      : "text-muted-foreground",
                  )}
                >
                  {kind === "devis" ? t.x_type_devis : t.x_type_facture}
                </button>
              ))}
            </div>

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
              <Label htmlFor="x-title">
                {isFacture ? t.x_doc_title_f : t.x_doc_title}
              </Label>
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
                        className="h-9 rounded-lg border-transparent px-1 text-[14px] font-semibold focus-visible:border-border"
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
                          className="mt-1 shrink-0 text-muted-foreground/70 hover:text-danger"
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
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-navy"
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
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-navy"
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
                        <span className="text-[12px] text-muted-foreground/70">
                          FCFA
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 text-right text-[12px] text-muted-foreground/70">
                      {formatAmount(
                        Math.round(parseQuantity(line.qty) * line.unit_price),
                      )}
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
                className="mt-3 w-full rounded-xl border-[1.5px] border-dashed border-border py-3 text-[13.5px] font-semibold text-muted-foreground hover:border-navy"
              >
                + {t.q_add_line}
              </button>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground/70">
                {t.q_qty_hint}
              </p>
            </div>

            {/* ----- Options (remise, acompte, conditions) ----- */}
            <div>
              <button
                type="button"
                onClick={() => setShowOptions((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border-[1.5px] border-border bg-card px-4 py-3 text-[13.5px] font-semibold text-muted-foreground"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-muted-foreground/70" />
                  {showOptions ? t.x_more_options_hide : t.x_more_options}
                </span>
                <ChevronDown
                  size={18}
                  className={cn(
                    "text-muted-foreground/70 transition-transform",
                    showOptions && "rotate-180",
                  )}
                />
              </button>

              {showOptions && (
                <div className="mt-3 space-y-4">
                  <div>
                    <Label htmlFor="x-discount">{t.q_discount}</Label>
                    <Input
                      id="x-discount"
                      inputMode="numeric"
                      value={discount}
                      onChange={(e) =>
                        setDiscount(e.target.value.replace(/[^\d]/g, ""))
                      }
                      placeholder="0"
                    />
                  </div>

                  {isFacture && (
                    <div>
                      <Label htmlFor="x-advance">{t.q_advance}</Label>
                      <Input
                        id="x-advance"
                        inputMode="numeric"
                        value={advance}
                        onChange={(e) =>
                          setAdvance(e.target.value.replace(/[^\d]/g, ""))
                        }
                        placeholder="0"
                      />
                      <p className="mt-1 text-[11.5px] text-muted-foreground/70">
                        {t.q_advance_hint}
                      </p>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="x-conditions">{t.q_conditions}</Label>
                    <Textarea
                      id="x-conditions"
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                      placeholder={t.q_cond_ph}
                    />
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                      {t.cond_presets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setConditions((current) =>
                              current ? `${current}\n${preset}` : preset,
                            )
                          }
                          className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-[12px] font-semibold text-muted-foreground"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ----- Totaux ----- */}
            <Card className="space-y-1.5 p-4">
              <div className="flex justify-between text-[13.5px] text-muted-foreground">
                <span>{t.subtotal}</span>
                <span>{formatAmount(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-[13.5px] text-muted-foreground">
                  <span>{t.discount}</span>
                  <span>− {formatAmount(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-muted pt-2 text-[16px] font-extrabold text-navy">
                <span>{t.total_final}</span>
                <span>{formatAmount(totals.total)}</span>
              </div>
              {isFacture && advanceValue > 0 && (
                <>
                  <div className="flex justify-between pt-1 text-[13.5px] text-muted-foreground">
                    <span>{t.advance_paid}</span>
                    <span>− {formatAmount(advanceValue)}</span>
                  </div>
                  <div className="flex justify-between text-[14px] font-bold text-coral">
                    <span>{t.remaining_to_pay}</span>
                    <span>{formatAmount(remaining)}</span>
                  </div>
                </>
              )}
            </Card>

            <Button
              variant="accent"
              size="lg"
              className="w-full"
              onClick={goPreview}
            >
              {isFacture ? t.x_preview_cta_f : t.x_preview_cta}
            </Button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <ScreenHeader title={t.x_preview} onBack={() => setStep("form")} />
          <div className="space-y-4 px-4 pt-5">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
              <iframe
                title={t.x_preview}
                srcDoc={buildHtml()}
                className="pointer-events-none h-[420px] w-full origin-top"
              />
              <div className="absolute inset-x-0 bottom-0 flex h-28 items-end justify-center bg-gradient-to-t from-white to-transparent pb-4">
                <span className="flex items-center gap-1.5 rounded-full bg-brand-navy px-4 py-2 text-[12.5px] font-bold text-white">
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
              {isFacture ? t.xpdf_pay_f : t.xpdf_pay}{" "}
              {formatAmount(EXPRESS_PRICE)}
            </Button>

            <p className="text-center text-[12.5px] text-muted-foreground/70">
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
                if (!response.ok) return { ok: false };
                const data = await response.json();
                if (data.status === "pending" && data.redirectUrl) {
                  // Le client part payer sur CamerPay : l'état React ne
                  // survivra pas à la redirection complète, on sauvegarde le
                  // brouillon pour reconstruire le document à son retour.
                  try {
                    const draft: ExpressDraft = {
                      docKind,
                      businessName,
                      title,
                      clientName,
                      clientPhone,
                      lines,
                      discount,
                      advance,
                      conditions,
                    };
                    sessionStorage.setItem(
                      draftKey(data.reference),
                      JSON.stringify(draft),
                    );
                  } catch {
                    // Stockage indisponible (navigation privée…) : tant pis,
                    // le retour n'affichera qu'une confirmation générique.
                  }
                }
                return {
                  ok: true,
                  status: data.status,
                  redirectUrl: data.redirectUrl ?? null,
                };
              }}
              onSuccess={() => setStep("done")}
            />
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <ScreenHeader title={isFacture ? t.xdl_title_f : t.xdl_title} />
          <div className="space-y-4 px-4 pt-5">
            <p className="text-[14px] text-muted-foreground">{t.xdl_sub}</p>
            <Button
              size="lg"
              className="w-full"
              onClick={() => void download()}
              disabled={busy}
            >
              <Download size={18} /> {busy ? t.pdf_generating : t.xdl_download}
            </Button>
            <Button
              variant="whatsapp"
              size="lg"
              className="w-full"
              onClick={() => void shareWhatsApp()}
              disabled={busy}
            >
              <Send size={18} /> {busy ? t.pdf_generating : t.xdl_wa}
            </Button>

            <Card className="p-5 text-center">
              <div className="text-[15px] font-extrabold text-navy">
                {t.xdl_acc_title}
              </div>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {t.xdl_acc_sub}
              </p>
              <Button asChild variant="accent" className="mt-4 w-full">
                <Link href="/connexion">{t.xdl_create}</Link>
              </Button>
            </Card>

            <button
              type="button"
              onClick={resetForm}
              className="w-full text-center text-[13px] font-semibold text-muted-foreground underline"
            >
              {isFacture ? t.xdl_another_f : t.xdl_another}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
