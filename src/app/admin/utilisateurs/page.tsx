"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Ban, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
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
  useAdminSetUserBanned,
  useAdminUsers,
  type AdminUserListItem,
} from "@/hooks/use-admin-users";
import { formatDate } from "@/lib/format";

type StatusFilter = "all" | "never_connected" | "no_company" | "banned";

function isBanned(bannedUntil: string | null): boolean {
  return bannedUntil !== null && new Date(bannedUntil).getTime() > Date.now();
}

function connectionLabel(u: AdminUserListItem): string {
  if (u.last_sign_in_at) return `Connecté le ${formatDate(u.last_sign_in_at)}`;
  if (u.email && !u.email_confirmed_at) return "Email non confirmé";
  return "Jamais connecté";
}

export default function AdminUtilisateursPage() {
  const { data: users, isLoading, error } = useAdminUsers();
  const setBanned = useAdminSetUserBanned();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (
        q &&
        !(u.email ?? "").toLowerCase().includes(q) &&
        !(u.phone ?? "").toLowerCase().includes(q) &&
        !(u.full_name ?? "").toLowerCase().includes(q) &&
        !(u.company_name ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      if (statusFilter === "never_connected" && u.last_sign_in_at) return false;
      if (statusFilter === "no_company" && u.company_id) return false;
      if (statusFilter === "banned" && !isBanned(u.banned_until)) return false;
      return true;
    });
  }, [users, search, statusFilter]);

  const handleBan = (u: AdminUserListItem) => {
    const label = u.email ?? u.phone ?? "ce compte";
    const reason = window.prompt(`Motif du bannissement de ${label} (optionnel) :`);
    if (reason === null) return;
    if (
      !window.confirm(
        `${label} ne pourra plus du tout se connecter. Confirmer le bannissement ?`,
      )
    ) {
      return;
    }
    setBanned.mutate({ userId: u.user_id, banned: true, reason: reason.trim() || null });
  };

  const handleUnban = (u: AdminUserListItem) => {
    const label = u.email ?? u.phone ?? "ce compte";
    if (!window.confirm(`Débannir ${label} ?`)) return;
    setBanned.mutate({ userId: u.user_id, banned: false, reason: null });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy">Utilisateurs</h1>
        <p className="text-[13.5px] text-muted-foreground">
          {users?.length ?? 0} compte{(users?.length ?? 0) > 1 ? "s" : ""} créé
          {(users?.length ?? 0) > 1 ? "s" : ""} — y compris les inscriptions
          sans entreprise.
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
            placeholder="Rechercher par email, téléphone, nom…"
            className="pl-10"
          />
        </div>
        <div className="sm:w-56">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">Tous les comptes</option>
            <option value="never_connected">Jamais connecté</option>
            <option value="no_company">Sans entreprise</option>
            <option value="banned">Bannis</option>
          </Select>
        </div>
      </div>

      {error ? (
        <Alert variant="error" title="Impossible de charger les comptes">
          {error.message}
        </Alert>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compte</TableHead>
              <TableHead>Connexion</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableEmpty colSpan={5}>
                Aucun compte ne correspond aux filtres.
              </TableEmpty>
            ) : (
              filtered.map((u) => {
                const banned = isBanned(u.banned_until);
                return (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="font-semibold text-navy">
                        {u.email ?? u.phone ?? "—"}
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {u.full_name ?? "—"} · Inscrit le {formatDate(u.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>{connectionLabel(u)}</TableCell>
                    <TableCell>
                      {u.company_id ? (
                        <Link
                          href={`/admin/abonnements/${u.company_id}`}
                          className="font-medium text-navy hover:underline"
                        >
                          {u.company_name}
                        </Link>
                      ) : (
                        <Badge variant="warning">Inscription incomplète</Badge>
                      )}
                      {u.plan_name ? (
                        <div className="text-[12px] text-muted-foreground">
                          {u.plan_name}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {banned ? <Badge variant="error">Banni</Badge> : null}
                        {u.company_suspended_at ? (
                          <Badge variant="error">Entreprise suspendue</Badge>
                        ) : null}
                        {!banned && !u.company_suspended_at ? (
                          <Badge variant="success">Actif</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {banned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={setBanned.isPending}
                            onClick={() => handleUnban(u)}
                          >
                            <ShieldCheck size={15} /> Débannir
                          </Button>
                        ) : (
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={setBanned.isPending}
                            onClick={() => handleBan(u)}
                          >
                            <Ban size={15} /> Bannir
                          </Button>
                        )}
                        {u.company_id ? (
                          <Link
                            href={`/admin/abonnements/${u.company_id}`}
                            className="rounded-field p-2 text-muted-foreground hover:bg-muted"
                            aria-label="Voir l'entreprise"
                          >
                            <ChevronRight size={17} />
                          </Link>
                        ) : null}
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
