"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PromoCodeForm } from "@/features/admin/promo-code-form";
import {
  useBulkCreatePromoCodes,
  type PromoCode,
  type PromoDiscountType,
} from "@/hooks/use-admin-promo-codes";
import { usePlans } from "@/hooks/use-usage";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

function BulkPromoForm() {
  const { data: plans } = usePlans();
  const bulkCreate = useBulkCreatePromoCodes();
  const [prefix, setPrefix] = useState("");
  const [count, setCount] = useState("10");
  const [discountType, setDiscountType] = useState<PromoDiscountType>("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [applicablePlans, setApplicablePlans] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [created, setCreated] = useState<PromoCode[] | null>(null);

  const payingPlans = (plans ?? []).filter((p) => p.price_fcfa > 0);

  const togglePlan = (key: string) => {
    setApplicablePlans((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const generate = () => {
    const n = parseInt(count, 10);
    const value = Number(discountValue);
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      toast.error("Indiquez un nombre de codes entre 1 et 500.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Entrez une réduction valide.");
      return;
    }
    bulkCreate.mutate(
      {
        prefix,
        count: n,
        discount_type: discountType,
        discount_value: value,
        applicable_plans: applicablePlans.length > 0 ? applicablePlans : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      },
      {
        onSuccess: (codes) => {
          setCreated(codes);
          toast.success(`${codes.length} codes générés.`);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="bulk-prefix">Préfixe</Label>
            <Input
              id="bulk-prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="PROMO"
            />
          </div>
          <div>
            <Label htmlFor="bulk-count">Nombre de codes</Label>
            <Input
              id="bulk-count"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
        </div>

        <div>
          <Label>Réduction</Label>
          <div className="flex gap-2">
            {(["percent", "fixed"] as PromoDiscountType[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setDiscountType(v)}
                className={cn(
                  "flex-1 rounded-field border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  discountType === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {v === "percent" ? "Pourcentage" : "Montant fixe (FCFA)"}
              </button>
            ))}
          </div>
          <Input
            className="mt-2"
            inputMode="numeric"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={discountType === "percent" ? "10" : "1000"}
          />
        </div>

        <div>
          <Label>Offres concernées</Label>
          <div className="flex flex-wrap gap-3">
            {payingPlans.map((p) => (
              <Checkbox
                key={p.key}
                checked={applicablePlans.includes(p.key)}
                onChange={() => togglePlan(p.key)}
                label={p.name}
              />
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="bulk-expires">Expiration (optionnel)</Label>
          <Input
            id="bulk-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>

        <Button
          className="w-full"
          onClick={generate}
          disabled={bulkCreate.isPending}
        >
          {bulkCreate.isPending ? "Génération…" : "Générer les codes"}
        </Button>

        {created ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13.5px] font-semibold text-navy">
                {created.length} codes générés
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv("codes-promo.csv", [
                    ["code", "reduction", "expire_le"],
                    ...created.map((c) => [
                      c.code,
                      c.discount_type === "percent"
                        ? `${c.discount_value}%`
                        : `${c.discount_value} FCFA`,
                      c.expires_at ?? "",
                    ]),
                  ])
                }
              >
                <Download size={15} /> Exporter en CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Réduction</TableHead>
                  <TableHead>Expire le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {created.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold text-navy">
                      {c.code}
                    </TableCell>
                    <TableCell>
                      {c.discount_type === "percent"
                        ? `${c.discount_value}%`
                        : `${c.discount_value} FCFA`}
                    </TableCell>
                    <TableCell>
                      {c.expires_at ? c.expires_at.slice(0, 10) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function NouveauPromoPage() {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/admin/promos"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} /> Codes promo
        </Link>
        <h1 className="mt-2 text-xl font-bold text-navy">Nouveau code promo</h1>
      </div>

      <div className="flex gap-2">
        {(["single", "bulk"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 rounded-field border-[1.5px] px-3 py-2.5 text-[13px] font-semibold transition-colors",
              mode === m
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {m === "single" ? "Un seul code" : "Génération en masse"}
          </button>
        ))}
      </div>

      {mode === "single" ? <PromoCodeForm /> : <BulkPromoForm />}
    </div>
  );
}
