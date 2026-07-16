"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Minus, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { computeTotals } from "@/lib/calculations";
import { CONDITION_PRESETS } from "@/lib/constants";
import { formatAmount } from "@/lib/format";
import { useCompany } from "@/features/company/company-context";
import { useCatalog } from "@/hooks/use-catalog";
import { useClients, useSaveClient } from "@/hooks/use-clients";
import { isQuotaError, useCreateDocument } from "@/hooks/use-documents";
import type { DocumentType } from "@/types/database";
import { cn } from "@/lib/utils";

interface DraftLine {
  uid: number;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

let uidCounter = 1;

export function DocumentBuilder({ type }: { type: DocumentType }) {
  const router = useRouter();
  const company = useCompany();
  const { data: clients } = useClients();
  const { data: catalog } = useCatalog();
  const saveClient = useSaveClient();
  const createDocument = useCreateDocument();

  const [clientId, setClientId] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [discount, setDiscount] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [conditions, setConditions] = useState("");

  const isInvoice = type === "facture";
  const label = isInvoice ? "facture" : "devis";

  const totals = useMemo(
    () =>
      computeTotals(lines, {
        discount: parseInt(discount, 10) || 0,
        vatEnabled: company.vat_enabled,
        vatRate: company.vat_rate,
      }),
    [lines, discount, company.vat_enabled, company.vat_rate],
  );

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

  const removeLine = (uid: number) => {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  };

  const addInlineClient = () => {
    if (!newClientName.trim()) {
      toast.error("Entrez un nom");
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
          toast.success("Client enregistré");
        },
        onError: () => toast.error("Enregistrement impossible"),
      },
    );
  };

  const generate = () => {
    if (lines.length === 0) {
      toast.error("Ajoutez au moins un élément");
      return;
    }
    createDocument.mutate(
      {
        type,
        client_id: clientId,
        title: title.trim(),
        note: note.trim(),
        conditions: conditions.trim(),
        discount: parseInt(discount, 10) || 0,
        items: lines.map((line) => ({
          name: line.name || "—",
          unit: line.unit,
          quantity: line.quantity,
          unit_price: line.unit_price,
        })),
      },
      {
        onSuccess: (doc) => {
          toast.success(isInvoice ? "Facture créée" : "Devis créé");
          router.push(`/documents/${doc.id}`);
        },
        onError: (error) => {
          if (isQuotaError(error)) {
            toast.error("Limite mensuelle atteinte");
            router.push("/offres");
            return;
          }
          toast.error("Création impossible. Réessayez.");
        },
      },
    );
  };

  return (
    <div>
      <ScreenHeader
        title={isInvoice ? "Nouvelle facture" : "Nouveau devis"}
        backHref="/accueil"
      />

      <div className="space-y-6 px-4 pb-10 pt-5">
        {/* ----- Client ----- */}
        <section>
          <div className="flex items-center justify-between">
            <Label className="mb-0">Client</Label>
            <button
              type="button"
              onClick={() => setShowNewClient((v) => !v)}
              className="flex items-center gap-1 text-[13px] font-semibold text-coral"
            >
              {showNewClient ? <X size={14} /> : <UserPlus size={14} />}
              {showNewClient ? "Annuler" : "Nouveau client"}
            </button>
          </div>

          {showNewClient ? (
            <Card className="mt-2 space-y-3 p-4">
              <Input
                placeholder="Nom complet"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
              />
              <Input
                placeholder="Téléphone"
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
                Enregistrer et sélectionner
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
                      : "border-[#E2E5EC] bg-white text-[#5A6377]",
                  )}
                >
                  {clientId === client.id && <Check size={13} />}
                  {client.name}
                </button>
              ))}
              {(clients ?? []).length === 0 && (
                <p className="text-[13px] text-[#8A93A6]">
                  Aucun client — créez-en un.
                </p>
              )}
            </div>
          )}
        </section>

        {/* ----- Articles ----- */}
        <section>
          <Label>Éléments</Label>
          <div className="relative">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A6ADBD]"
            />
            <Input
              className="pl-11"
              placeholder="Ex : câble, main d'œuvre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {searchResults.length > 0 && (
            <Card className="mt-2 divide-y divide-[#F0F1F5] overflow-hidden">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[#F6F7F9]"
                  onClick={() =>
                    addLine({
                      name: item.name,
                      unit: item.unit,
                      quantity: 1,
                      unit_price: item.unit_price,
                    })
                  }
                >
                  <span className="text-[14px] font-semibold text-navy">
                    {item.name}
                  </span>
                  <span className="text-[13px] text-[#5A6377]">
                    {formatAmount(item.unit_price)} / {item.unit}
                  </span>
                </button>
              ))}
            </Card>
          )}

          {search.trim() === "" && favorites.length > 0 && lines.length === 0 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {favorites.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    addLine({
                      name: item.name,
                      unit: item.unit,
                      quantity: 1,
                      unit_price: item.unit_price,
                    })
                  }
                  className="shrink-0 rounded-full border-[1.5px] border-[#E2E5EC] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#5A6377]"
                >
                  + {item.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 space-y-3">
            {lines.length === 0 ? (
              <Card className="p-5 text-center text-[13.5px] text-[#8A93A6]">
                Recherchez un article pour l&apos;ajouter au {label}
              </Card>
            ) : (
              lines.map((line) => (
                <Card key={line.uid} className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      className="h-9 rounded-lg border-transparent px-1 text-[14px] font-semibold focus-visible:border-[#E2E5EC]"
                      value={line.name}
                      placeholder="Désignation"
                      onChange={(e) =>
                        updateLine(line.uid, { name: e.target.value })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Supprimer la ligne"
                      onClick={() => removeLine(line.uid)}
                      className="mt-1 shrink-0 text-[#A6ADBD] hover:text-danger"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Diminuer la quantité"
                        onClick={() =>
                          updateLine(line.uid, {
                            quantity: Math.max(1, line.quantity - 1),
                          })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF0F4] text-navy"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="min-w-10 text-center text-[14px] font-bold text-navy">
                        {line.quantity} {line.unit}
                      </span>
                      <button
                        type="button"
                        aria-label="Augmenter la quantité"
                        onClick={() =>
                          updateLine(line.uid, { quantity: line.quantity + 1 })
                        }
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
                              parseInt(e.target.value.replace(/[^\d]/g, ""), 10) ||
                              0,
                          })
                        }
                      />
                      <span className="text-[12px] text-[#8A93A6]">FCFA</span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              addLine({ name: "", unit: "unité", quantity: 1, unit_price: 0 })
            }
            className="mt-3 w-full rounded-xl border-[1.5px] border-dashed border-[#C3C9D5] py-3 text-[13.5px] font-semibold text-[#5A6377] hover:border-navy"
          >
            + Ligne libre
          </button>
        </section>

        {/* ----- Détails ----- */}
        <section className="space-y-4">
          <div>
            <Label htmlFor="doc-title">Intitulé du document</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Pose peinture chambre 4 m²"
            />
          </div>
          <div>
            <Label htmlFor="doc-discount">Remise (FCFA)</Label>
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
          <div>
            <Label htmlFor="doc-note">Note</Label>
            <Textarea
              id="doc-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : travaux prévus mardi matin…"
            />
          </div>
          <div>
            <Label htmlFor="doc-conditions">Conditions de travail</Label>
            <Textarea
              id="doc-conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="Ex : paiement 50% à la commande"
            />
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {CONDITION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setConditions((current) =>
                      current ? `${current}\n${preset}` : preset,
                    )
                  }
                  className="shrink-0 rounded-full bg-[#EEF0F4] px-3 py-1.5 text-[12px] font-semibold text-[#5A6377]"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ----- Totaux ----- */}
        <Card className="space-y-1.5 p-4">
          <div className="flex justify-between text-[13.5px] text-[#5A6377]">
            <span>Sous-total</span>
            <span>{formatAmount(totals.subtotal)}</span>
          </div>
          {totals.discount > 0 && (
            <div className="flex justify-between text-[13.5px] text-[#5A6377]">
              <span>Remise</span>
              <span>− {formatAmount(totals.discount)}</span>
            </div>
          )}
          {totals.vatRate > 0 && (
            <>
              <div className="flex justify-between text-[13.5px] text-[#5A6377]">
                <span>Montant HT</span>
                <span>{formatAmount(totals.net)}</span>
              </div>
              <div className="flex justify-between text-[13.5px] text-[#5A6377]">
                <span>TVA {totals.vatRate}%</span>
                <span>{formatAmount(totals.vatAmount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-[#F0F1F5] pt-2 text-[16px] font-extrabold text-navy">
            <span>Total {totals.vatRate > 0 ? "TTC" : "final"}</span>
            <span>{formatAmount(totals.total)}</span>
          </div>
        </Card>

        <Button
          variant="accent"
          size="lg"
          className="w-full"
          onClick={generate}
          disabled={createDocument.isPending}
        >
          {createDocument.isPending
            ? "Création…"
            : isInvoice
              ? "Générer la facture"
              : "Générer le devis"}
        </Button>
      </div>
    </div>
  );
}
