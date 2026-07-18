"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Minus, Plus, Save, Search, Trash2, UserPlus, X } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/features/company/company-context";
import { useI18n } from "@/features/i18n/language-context";
import { computeTotals, parseQuantity, remainingToPay } from "@/lib/calculations";
import { formatAmount } from "@/lib/format";
import { useCatalog } from "@/hooks/use-catalog";
import { useClients, useSaveClient } from "@/hooks/use-clients";
import {
  isQuotaError,
  useCreateDocument,
  useUpdateDocument,
} from "@/hooks/use-documents";
import { usePlanFeature } from "@/hooks/use-usage";
import type {
  DocumentItem,
  DocumentRow,
  DocumentType,
} from "@/types/database";
import { cn } from "@/lib/utils";

interface DraftLine {
  uid: number;
  name: string;
  unit: string;
  qty: string;
  unit_price: number;
}

interface SavedDraft {
  clientId: string | null;
  lines: DraftLine[];
  discount: string;
  advance: string;
  title: string;
  note: string;
  conditions: string;
}

let uidCounter = 1;

function draftKey(type: DocumentType): string {
  return `digick_draft_${type}`;
}

export function DocumentBuilder({
  type: createType,
  document: editDoc,
  items: editItems,
}: {
  type?: DocumentType;
  document?: DocumentRow;
  items?: DocumentItem[];
}) {
  const router = useRouter();
  const company = useCompany();
  const { t } = useI18n();
  const { data: clients } = useClients();
  const { data: catalog } = useCatalog();
  const saveClient = useSaveClient();
  const createDocument = useCreateDocument();
  const updateDocument = useUpdateDocument();
  const catalogAccess = usePlanFeature("catalog");

  const isEdit = Boolean(editDoc);
  const type: DocumentType = editDoc?.type ?? createType ?? "devis";
  const isInvoice = type === "facture";

  const [clientId, setClientId] = useState<string | null>(
    editDoc?.client_id ?? null,
  );
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    (editItems ?? []).map((item) => ({
      uid: uidCounter++,
      name: item.name,
      unit: item.unit,
      qty: String(item.quantity),
      unit_price: item.unit_price,
    })),
  );
  const [discount, setDiscount] = useState(
    editDoc && editDoc.discount > 0 ? String(editDoc.discount) : "",
  );
  const [advance, setAdvance] = useState(
    editDoc && editDoc.advance_amount > 0 ? String(editDoc.advance_amount) : "",
  );
  const [title, setTitle] = useState(editDoc?.title ?? "");
  const [note, setNote] = useState(editDoc?.note ?? "");
  const [conditions, setConditions] = useState(editDoc?.conditions ?? "");
  const [draftRestored, setDraftRestored] = useState(false);
  const restoredRef = useRef(false);

  // ---- Autosave local (création uniquement) : reprise + hors-ligne ----
  useEffect(() => {
    if (isEdit || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(draftKey(type));
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedDraft;
      if (saved.lines?.length || saved.title) {
        setClientId(saved.clientId ?? null);
        setLines(
          (saved.lines ?? []).map((l) => ({ ...l, uid: uidCounter++ })),
        );
        setDiscount(saved.discount ?? "");
        setAdvance(saved.advance ?? "");
        setTitle(saved.title ?? "");
        setNote(saved.note ?? "");
        setConditions(saved.conditions ?? "");
        setDraftRestored(true);
      }
    } catch {
      // brouillon illisible : on ignore
    }
  }, [isEdit, type]);

  useEffect(() => {
    if (isEdit) return;
    const payload: SavedDraft = {
      clientId,
      lines,
      discount,
      advance,
      title,
      note,
      conditions,
    };
    const empty = lines.length === 0 && !title && !note && !conditions;
    try {
      if (empty) localStorage.removeItem(draftKey(type));
      else localStorage.setItem(draftKey(type), JSON.stringify(payload));
    } catch {
      // quota storage plein : sans gravité
    }
  }, [isEdit, type, clientId, lines, discount, advance, title, note, conditions]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey(type));
    } catch {
      // ignore
    }
  };

  const totals = useMemo(
    () =>
      computeTotals(
        lines.map((l) => ({
          quantity: parseQuantity(l.qty),
          unit_price: l.unit_price,
        })),
        {
          discount: parseInt(discount, 10) || 0,
          vatEnabled: company.vat_enabled,
          vatRate: company.vat_rate,
        },
      ),
    [lines, discount, company.vat_enabled, company.vat_rate],
  );

  const advanceValue = parseInt(advance, 10) || 0;
  const remaining = remainingToPay(totals.total, advanceValue);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return (catalog ?? [])
      .filter((item) => item.name.toLowerCase().includes(q))
      .slice(0, 5);
  }, [catalog, search]);

  const favorites = useMemo(
    () => (catalog ?? []).filter((item) => item.is_favorite).slice(0, 4),
    [catalog],
  );

  const addLine = (line: Omit<DraftLine, "uid">) => {
    setLines((prev) => [...prev, { ...line, uid: uidCounter++ }]);
    setSearch("");
  };

  const updateLine = (uid: number, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l)),
    );
  };

  const stepQty = (uid: number, delta: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.uid !== uid) return l;
        const next = Math.max(parseQuantity(l.qty) + delta, 0);
        // garde une écriture propre : entier sans décimale, sinon 1 décimale
        const str = Number.isInteger(next) ? String(next) : next.toFixed(1);
        return { ...l, qty: str };
      }),
    );
  };

  const removeLine = (uid: number) => {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  };

  const addInlineClient = () => {
    if (!newClientName.trim()) {
      toast.error(t.toast_need_name);
      return;
    }
    saveClient.mutate(
      {
        values: {
          name: newClientName.trim(),
          phone: newClientPhone.trim() || null,
        },
      },
      {
        onSuccess: (client) => {
          setClientId(client.id);
          setShowNewClient(false);
          setNewClientName("");
          setNewClientPhone("");
          toast.success(t.toast_client_saved);
        },
        onError: () => toast.error(t.toast_save_error),
      },
    );
  };

  const buildItems = () =>
    lines.map((line) => ({
      name: line.name || "—",
      unit: line.unit,
      quantity: parseQuantity(line.qty),
      unit_price: line.unit_price,
    }));

  const createdToast = () =>
    type === "facture"
      ? t.toast_facture_created
      : type === "proforma"
        ? t.toast_proforma_created
        : t.toast_devis_created;

  const submit = (asDraft: boolean) => {
    if (lines.length === 0) {
      toast.error(t.toast_need_items);
      return;
    }
    const base = {
      client_id: clientId,
      title: title.trim(),
      note: note.trim(),
      conditions: conditions.trim(),
      discount: parseInt(discount, 10) || 0,
      advance_amount: isInvoice ? advanceValue : 0,
      items: buildItems(),
    };

    if (isEdit && editDoc) {
      updateDocument.mutate(
        { id: editDoc.id, payload: base },
        {
          onSuccess: (doc) => {
            toast.success(t.toast_updated);
            router.push(`/documents/${doc.id}`);
          },
          onError: () => toast.error(t.toast_create_error),
        },
      );
      return;
    }

    createDocument.mutate(
      { type, status: "brouillon", ...base },
      {
        onSuccess: (doc) => {
          clearDraft();
          toast.success(asDraft ? t.toast_draft_saved : createdToast());
          router.push(`/documents/${doc.id}`);
        },
        onError: (error) => {
          if (isQuotaError(error)) {
            toast.error(t.toast_limit);
            router.push("/offres");
            return;
          }
          toast.error(t.toast_create_error);
        },
      },
    );
  };

  const pending = createDocument.isPending || updateDocument.isPending;

  const headerTitle = isEdit
    ? t.edit_document
    : type === "facture"
      ? t.new_invoice
      : type === "proforma"
        ? t.new_proforma
        : t.new_quote;

  const primaryLabel = isEdit
    ? t.save
    : type === "facture"
      ? t.q_generate_f
      : type === "proforma"
        ? t.q_generate_p
        : t.q_generate;

  const emptyItemsLabel =
    type === "facture"
      ? t.q_no_items_facture
      : type === "proforma"
        ? t.q_no_items_proforma
        : t.q_no_items_devis;

  return (
    <div>
      <ScreenHeader
        title={headerTitle}
        backHref={isEdit && editDoc ? `/documents/${editDoc.id}` : "/accueil"}
      />

      <div className="space-y-6 px-4 pb-10 pt-5">
        {draftRestored && (
          <div className="rounded-xl bg-warning-surface px-3 py-2 text-[12.5px] font-semibold text-warning-foreground">
            {t.draft_restored}
          </div>
        )}

        {/* ----- Client ----- */}
        <section>
          <div className="flex items-center justify-between">
            <Label className="mb-0">{t.q_client_label}</Label>
            <button
              type="button"
              onClick={() => setShowNewClient((v) => !v)}
              className="flex items-center gap-1 text-[13px] font-semibold text-coral"
            >
              {showNewClient ? <X size={14} /> : <UserPlus size={14} />}
              {showNewClient ? t.cancel : t.q_newclient}
            </button>
          </div>

          {showNewClient ? (
            <Card className="mt-2 space-y-3 p-4">
              <Input
                placeholder={t.f_name}
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
              <Input
                placeholder={t.f_phone}
                inputMode="tel"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                onClick={addInlineClient}
                disabled={saveClient.isPending}
              >
                {t.q_use_client}
              </Button>
            </Card>
          ) : (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {(clients ?? []).map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() =>
                    setClientId((current) =>
                      current === client.id ? null : client.id,
                    )
                  }
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-semibold transition-colors",
                    clientId === client.id
                      ? "border-navy bg-navy text-white"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {clientId === client.id && <Check size={13} />}
                  {client.name}
                </button>
              ))}
              {(clients ?? []).length === 0 && (
                <p className="text-[13px] text-muted-foreground/70">{t.q_no_clients}</p>
              )}
            </div>
          )}
        </section>

        {/* ----- Articles ----- */}
        <section>
          <Label>{t.q_items_label}</Label>
          {catalogAccess.enabled && (
            <div className="relative">
              <Search
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/70"
              />
              <Input
                className="pl-11"
                placeholder={t.q_search_ph}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}

          {catalogAccess.enabled && searchResults.length > 0 && (
            <Card className="mt-2 divide-y divide-border overflow-hidden">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface"
                  onClick={() =>
                    addLine({
                      name: item.name,
                      unit: item.unit,
                      qty: "1",
                      unit_price: item.unit_price,
                    })
                  }
                >
                  <span className="text-[14px] font-semibold text-navy">
                    {item.name}
                  </span>
                  <span className="text-[13px] text-muted-foreground">
                    {formatAmount(item.unit_price)} / {item.unit}
                  </span>
                </button>
              ))}
            </Card>
          )}

          {catalogAccess.enabled &&
            search.trim() === "" &&
            favorites.length > 0 &&
            lines.length === 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {favorites.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      addLine({
                        name: item.name,
                        unit: item.unit,
                        qty: "1",
                        unit_price: item.unit_price,
                      })
                    }
                    className="shrink-0 rounded-full border-[1.5px] border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-muted-foreground"
                  >
                    + {item.name}
                  </button>
                ))}
              </div>
            )}

          <div className="mt-3 space-y-3">
            {lines.length === 0 ? (
              <Card className="p-5 text-center text-[13.5px] text-muted-foreground/70">
                {emptyItemsLabel}
              </Card>
            ) : (
              lines.map((line) => (
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
                    <button
                      type="button"
                      aria-label={t.delete}
                      onClick={() => removeLine(line.uid)}
                      className="mt-1 shrink-0 text-muted-foreground/70 hover:text-danger"
                    >
                      <Trash2 size={17} />
                    </button>
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
                      <span className="ml-1 text-[12px] text-muted-foreground/70">
                        {line.unit}
                      </span>
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
                      <span className="text-[12px] text-muted-foreground/70">FCFA</span>
                    </div>
                  </div>
                  <div className="mt-1.5 text-right text-[12px] text-muted-foreground/70">
                    {formatAmount(
                      Math.round(parseQuantity(line.qty) * line.unit_price),
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              addLine({ name: "", unit: "unité", qty: "1", unit_price: 0 })
            }
            className="mt-3 w-full rounded-xl border-[1.5px] border-dashed border-border py-3 text-[13.5px] font-semibold text-muted-foreground hover:border-navy"
          >
            + {t.q_freeline}
          </button>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground/70">{t.q_qty_hint}</p>
        </section>

        {/* ----- Détails ----- */}
        <section className="space-y-4">
          <div>
            <Label htmlFor="doc-title">{t.q_title}</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.q_title_ph}
            />
          </div>
          <div>
            <Label htmlFor="doc-discount">{t.q_discount}</Label>
            <Input
              id="doc-discount"
              inputMode="numeric"
              value={discount}
              onChange={(e) =>
                setDiscount(e.target.value.replace(/[^\d]/g, ""))
              }
              placeholder="0"
            />
          </div>
          {isInvoice && (
            <div>
              <Label htmlFor="doc-advance">{t.q_advance}</Label>
              <Input
                id="doc-advance"
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
            <Label htmlFor="doc-note">{t.q_note}</Label>
            <Textarea
              id="doc-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.q_note_ph}
            />
          </div>
          <div>
            <Label htmlFor="doc-conditions">{t.q_conditions}</Label>
            <Textarea
              id="doc-conditions"
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
        </section>

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
          {totals.vatRate > 0 && (
            <>
              <div className="flex justify-between text-[13.5px] text-muted-foreground">
                <span>{t.amount_ht}</span>
                <span>{formatAmount(totals.net)}</span>
              </div>
              <div className="flex justify-between text-[13.5px] text-muted-foreground">
                <span>TVA {totals.vatRate}%</span>
                <span>{formatAmount(totals.vatAmount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-muted pt-2 text-[16px] font-extrabold text-navy">
            <span>{totals.vatRate > 0 ? t.total_ttc : t.total_final}</span>
            <span>{formatAmount(totals.total)}</span>
          </div>
          {isInvoice && advanceValue > 0 && (
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
          onClick={() => submit(false)}
          disabled={pending}
        >
          {pending ? t.generating : primaryLabel}
        </Button>

        {!isEdit && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => submit(true)}
            disabled={pending}
          >
            <Save size={16} /> {t.save_draft}
          </Button>
        )}
      </div>
    </div>
  );
}
