"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
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
import { useAdminPaymentIntents } from "@/hooks/use-admin-payment-intents";
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

const PURPOSE_LABEL: Record<string, string> = {
  subscription: "Abonnement",
  express_document: "Express",
};

export default function AdminPaiementsPage() {
  const { data: intents, isLoading } = useAdminPaymentIntents();
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
        !(i.company_name ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      const createdTime = new Date(i.created_at).getTime();
      if (fromTime !== null && createdTime < fromTime) return false;
      if (toTime !== null && createdTime >= toTime) return false;
      return true;
    });
  }, [intents, search, statusFilter, from, to]);

  const exportCsv = () => {
    downloadCsv("paiements.csv", [
      ["date", "reference", "entreprise", "objet", "montant", "reduction", "methode", "statut"],
      ...filtered.map((i) => [
        i.created_at.slice(0, 19),
        i.reference,
        i.company_name ?? "",
        PURPOSE_LABEL[i.purpose] ?? i.purpose,
        String(i.amount),
        String(i.discount_fcfa),
        i.method,
        STATUS_LABEL[i.status] ?? i.status,
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par référence ou entreprise…"
            className="pl-10"
          />
        </div>
        <div className="sm:w-44">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
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
                    {i.reference}
                  </TableCell>
                  <TableCell>{i.company_name ?? "—"}</TableCell>
                  <TableCell>{PURPOSE_LABEL[i.purpose] ?? i.purpose}</TableCell>
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
