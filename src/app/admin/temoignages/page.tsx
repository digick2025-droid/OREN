"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useAdminTestimonials } from "@/hooks/use-admin-testimonials";

export default function AdminTestimonialsPage() {
  const { data: testimonials, isLoading } = useAdminTestimonials();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Témoignages</h1>
          <p className="text-[13.5px] text-muted-foreground">
            {testimonials?.length ?? 0} témoignage
            {(testimonials?.length ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/temoignages/nouveau">
            <Plus size={17} /> Nouveau
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Métier</TableHead>
              <TableHead>Citation</TableHead>
              <TableHead>Ordre</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(testimonials ?? []).length === 0 ? (
              <TableEmpty colSpan={5}>
                Aucun témoignage pour l&rsquo;instant.
              </TableEmpty>
            ) : (
              (testimonials ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link
                      href={`/admin/temoignages/${t.id}`}
                      className="font-semibold text-navy hover:underline"
                    >
                      {t.author_name}
                    </Link>
                  </TableCell>
                  <TableCell>{t.author_role ?? "—"}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground">
                    {t.quote}
                  </TableCell>
                  <TableCell>{t.display_order}</TableCell>
                  <TableCell>
                    {t.is_active ? (
                      <Badge variant="success">Visible</Badge>
                    ) : (
                      <Badge variant="neutral">Masqué</Badge>
                    )}
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
