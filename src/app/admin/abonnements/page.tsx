"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, MessageCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useAdminCompanies } from "@/hooks/use-admin-companies";
import { usePlans } from "@/hooks/use-usage";
import { formatDate } from "@/lib/format";
import { buildWhatsAppLink } from "@/services/whatsapp";

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  past_due: "Impayé",
  canceled: "Résilié",
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function AdminAbonnementsPage() {
  const { data: companies, isLoading } = useAdminCompanies();
  const { data: plans } = usePlans();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    if (!companies) return [];
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !(c.owner_phone ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      if (planFilter !== "all" && c.plan_key !== planFilter) return false;
      if (statusFilter === "suspended" && !c.suspended_at) return false;
      if (statusFilter === "active" && c.subscription_status !== "active") return false;
      if (statusFilter === "expiring") {
        const d = daysUntil(c.current_period_end);
        if (!(c.subscription_status === "active" && d !== null && d <= 7)) return false;
      }
      return true;
    });
  }, [companies, search, planFilter, statusFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy">Abonnements</h1>
        <p className="text-[13.5px] text-muted-foreground">
          {companies?.length ?? 0} entreprise{(companies?.length ?? 0) > 1 ? "s" : ""}
        </p>
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
            placeholder="Rechercher par nom ou téléphone…"
            className="pl-10"
          />
        </div>
        <div className="sm:w-48">
          <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="all">Toutes les offres</option>
            {(plans ?? []).map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:w-52">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="active">Abonnement actif</option>
            <option value="expiring">Expire sous 7 jours</option>
            <option value="suspended">Suspendues</option>
          </Select>
        </div>
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
              <TableHead>Entreprise</TableHead>
              <TableHead>Offre</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Dernière activité</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableEmpty colSpan={6}>
                Aucune entreprise ne correspond aux filtres.
              </TableEmpty>
            ) : (
              filtered.map((c) => {
                const expiresInDays = daysUntil(c.current_period_end);
                const expiringSoon =
                  c.subscription_status === "active" &&
                  expiresInDays !== null &&
                  expiresInDays <= 7;
                return (
                  <TableRow key={c.company_id}>
                    <TableCell>
                      <Link
                        href={`/admin/abonnements/${c.company_id}`}
                        className="font-semibold text-navy hover:underline"
                      >
                        {c.name}
                      </Link>
                      <div className="text-[12px] text-muted-foreground">
                        {c.owner_phone ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>{c.plan_name ?? "Gratuit"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {c.suspended_at ? (
                          <Badge variant="error">Suspendu</Badge>
                        ) : c.subscription_status ? (
                          <Badge
                            variant={
                              c.subscription_status === "active"
                                ? "success"
                                : c.subscription_status === "past_due"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {STATUS_LABEL[c.subscription_status] ?? c.subscription_status}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Gratuit</Badge>
                        )}
                        {expiringSoon ? (
                          <Badge variant="warning">Expire bientôt</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.usage_used}
                      {c.usage_quota !== null ? ` / ${c.usage_quota}` : ""}
                    </TableCell>
                    <TableCell>
                      {c.last_sign_in_at ? formatDate(c.last_sign_in_at) : "Jamais"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {c.owner_phone ? (
                          <a
                            href={buildWhatsAppLink(
                              c.owner_phone,
                              `Bonjour ${c.name}, votre abonnement OREN ${
                                expiringSoon
                                  ? "expire bientôt"
                                  : "nécessite votre attention"
                              }. Contactez-nous si besoin.`,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-field p-2 text-whatsapp hover:bg-muted"
                            aria-label="Relancer par WhatsApp"
                          >
                            <MessageCircle size={17} />
                          </a>
                        ) : null}
                        <Link
                          href={`/admin/abonnements/${c.company_id}`}
                          className="rounded-field p-2 text-muted-foreground hover:bg-muted"
                          aria-label="Voir le détail"
                        >
                          <ChevronRight size={17} />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
