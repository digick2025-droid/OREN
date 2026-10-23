"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Download, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminPaymentIntents,
  useReviewManualPayment,
} from "@/hooks/use-admin-payment-intents";
import { formatAmount, formatDate } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";

const STATUS_VARIANT: Record<string, "success" | "warning" | "error"> = {
  succeeded: "success",
  pending: "warning",
  failed: "error",
};

const STATUS_LABEL: Record<string, string> = {
  succeeded: "Réussi",
  pending: "En attente",
  failed: "Échoué",
};

const REVIEW_LABEL: Record<string, string> = {
  to_review: "À vérifier",
  confirmed: "Vérifié",
  rejected: "Annulé",
};

const PURPOSE_LABEL: Record<string, string> = {
  subscription: "Abonnement",
  express_document: "Express",
  document_credit: "Document supplémentaire",
};

export default function AdminPaiementsPage() {
  const { data: intents, isLoading } = useAdminPaymentIntents();
  const review = useReviewManualPayment();
  const toReviewCount = (intents ?? []).filter(
    (i) => i.review_status === "to_review",
  ).length;

  const decide = (reference: string, decision: "confirmed" | "rejected") => {
    // L'annulation retire l'abonnement ou les documents : jamais d'un clic.
    if (
      decision === "rejected" &&
      !window.confirm(
        "Annuler ce paiement ? L'abonnement repassera en gratuit, ou les documents achetés seront retirés.",
      )
    ) {
      return;
    }
    review.mutate(
      { reference, decision },
      {
        onSuccess: () =>
          toast.success(decision === "confirmed" ? "Paiement vérifié" : "Paiement annulé"),
        onError: () => toast.error("Action impossible. Réessayez."),
      },
    );
  };
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    if (!intents) return [];
    const q = search.trim().toLowerCase();
    const fromTime = from ? new Date(from).getTime() : null;
    const toTime = to ? new Date(to).getTime() + 86_400_000 : null;
    return intents.filter((i) => {
      if (
        q &&
        !i.reference.toLowerCase().includes(q) &&
        !(i.transaction_ref ?? "").toLowerCase().includes(q) &&
        !(i.phone ?? "").includes(q) &&
        !(i.company_name ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      if (statusFilter === "to_review") {
        if (i.review_status !== "to_review") return false;
      } else if (statusFilter !== "all" && i.status !== statusFilter) {
        return false;
      }
      const createdTime = new Date(i.created_at).getTime();
      if (fromTime !== null && createdTime < fromTime) return false;
      if (toTime !== null && createdTime >= toTime) return false;
      return true;
    });
  }, [intents, search, statusFilter, from, to]);

  const exportCsv = () => {
    downloadCsv("paiements.csv", [
      [
        "date",
        "reference",
        "entreprise",
        "objet",
        "montant",
        "reduction",
        "methode",
        "statut",
        "motif_echec",
        "reference_sms",
        "telephone",
        "verification",
      ],
      ...filtered.map((i) => [
        i.created_at.slice(0, 19),
        i.reference,
        i.company_name ?? "",
        PURPOSE_LABEL[i.purpose] ?? i.purpose,
        String(i.amount),
        String(i.discount_fcfa),
        i.method,
        STATUS_LABEL[i.status] ?? i.status,
        i.failure_reason ?? "",
        i.transaction_ref ?? "",
        i.phone ?? "",
        i.review_status ? (REVIEW_LABEL[i.review_status] ?? "") : "",
      ]),
    ]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-navy">Paiements</h1>
          <p className="text-[13.5px] text-muted-foreground">
            {filtered.length} intention{filtered.length > 1 ? "s" : ""} de paiement
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download size={16} /> Exporter en CSV
        </Button>
      </div>

      {toReviewCount > 0 && statusFilter !== "to_review" ? (
        <button
          type="button"
          onClick={() => setStatusFilter("to_review")}
          className="w-full rounded-xl border border-coral/40 bg-accent/10 px-4 py-3 text-left text-[13.5px] font-semibold text-navy"
        >
          {toReviewCount} paiement{toReviewCount > 1 ? "s" : ""} manuel
          {toReviewCount > 1 ? "s" : ""} à vérifier : comparez la référence SMS
          avec vos relevés Orange Money / MTN MoMo. Afficher →
        </button>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Référence, référence SMS, téléphone ou entreprise…"
            className="pl-10"
          />
        </div>
        <div className="sm:w-44">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="to_review">À vérifier (manuel)</option>
            <option value="pending">En attente</option>
            <option value="succeeded">Réussi</option>
            <option value="failed">Échoué</option>
          </Select>
        </div>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="sm:w-40"
          aria-label="Du"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="sm:w-40"
          aria-label="Au"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableEmpty colSpan={7}>
                Aucune intention de paiement ne correspond aux filtres.
              </TableEmpty>
            ) : (
              filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{formatDate(i.created_at)}</TableCell>
                  <TableCell className="font-mono text-[12.5px] text-muted-foreground">
                    {i.transaction_ref ? (
                      <>
                        <div className="font-semibold text-navy">
                          SMS : {i.transaction_ref}
                        </div>
                        {i.phone ? <div>{i.phone}</div> : null}
                        <div className="text-[11px]">{i.reference}</div>
                      </>
                    ) : (
                      i.reference
                    )}
                  </TableCell>
                  <TableCell>{i.company_name ?? "—"}</TableCell>
                  <TableCell>
                    {PURPOSE_LABEL[i.purpose] ?? i.purpose}
                    {i.purpose === "subscription" && i.billing_days
                      ? ` · ${i.billing_days} jours`
                      : i.purpose === "subscription" && i.billing_months === 12
                        ? " · annuel"
                        : null}
                  </TableCell>
                  <TableCell className="font-semibold text-navy">
                    {formatAmount(i.amount - i.discount_fcfa)}
                    {i.discount_fcfa > 0 ? (
                      <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                        (-{formatAmount(i.discount_fcfa)} promo)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{i.method}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[i.status] ?? "neutral"}>
                      {STATUS_LABEL[i.status] ?? i.status}
                    </Badge>
                    {/* Un échec sans motif n'apprend rien : ici, on lit
                        directement le refus de l'opérateur ou de la
                        passerelle, sans passer par les logs. */}
                    {i.failure_reason ? (
                      <div className="mt-1 max-w-[220px] text-[12px] leading-snug text-muted-foreground">
                        {i.failure_reason}
                      </div>
                    ) : null}
                    {i.review_status && i.review_status !== "to_review" ? (
                      <div className="mt-1 text-[12px] text-muted-foreground">
                        {REVIEW_LABEL[i.review_status]}
                      </div>
                    ) : null}
                    {i.review_status === "to_review" ? (
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={review.isPending}
                          onClick={() => decide(i.reference, "confirmed")}
                        >
                          <Check size={14} /> Confirmer
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={review.isPending}
                          onClick={() => decide(i.reference, "rejected")}
                        >
                          <X size={14} /> Annuler
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
