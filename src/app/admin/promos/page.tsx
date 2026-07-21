"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminPromoCodes, useUpdatePromoCode } from "@/hooks/use-admin-promo-codes";
import { formatDate } from "@/lib/format";

export default function AdminPromosPage() {
  const { data: codes, isLoading } = useAdminPromoCodes();
  const updatePromo = useUpdatePromoCode();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Codes promo</h1>
          <p className="text-[13.5px] text-muted-foreground">
            {codes?.length ?? 0} code{(codes?.length ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/promos/nouveau">
            <Plus size={17} /> Nouveau
          </Link>
        </Button>
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
              <TableHead>Code</TableHead>
              <TableHead>Réduction</TableHead>
              <TableHead>Utilisations</TableHead>
              <TableHead>Expire le</TableHead>
              <TableHead>Actif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(codes ?? []).length === 0 ? (
              <TableEmpty colSpan={5}>
                Aucun code promo pour l&rsquo;instant.
              </TableEmpty>
            ) : (
              (codes ?? []).map((c) => {
                const expired = c.expires_at
                  ? new Date(c.expires_at) < new Date()
                  : false;
                const exhausted =
                  c.max_redemptions != null &&
                  c.redemption_count >= c.max_redemptions;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/admin/promos/${c.id}`}
                        className="font-mono font-semibold text-navy hover:underline"
                      >
                        {c.code}
                      </Link>
                      {c.batch_id ? (
                        <div className="text-[11px] text-muted-foreground">
                          Lot {c.batch_id.slice(0, 8)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {c.discount_type === "percent"
                        ? `${c.discount_value}%`
                        : `${c.discount_value} FCFA`}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {c.redemption_count}
                        {c.max_redemptions != null ? ` / ${c.max_redemptions}` : ""}
                        {exhausted ? <Badge variant="neutral">Épuisé</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {c.expires_at ? formatDate(c.expires_at) : "—"}
                        {expired ? <Badge variant="error">Expiré</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={(checked) =>
                          updatePromo.mutate({
                            id: c.id,
                            values: { is_active: checked },
                          })
                        }
                      />
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
