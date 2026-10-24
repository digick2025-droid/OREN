"use client";

import { Eye } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { ENTERPRISE_PREVIEW } from "@/lib/billing";
import { setRolePreview, useRolePreview } from "@/features/company/role-preview";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

/**
 * Barre de prévisualisation de rôle — visible uniquement pour l'admin (ou en
 * ENTERPRISE_PREVIEW). Simule l'INTERFACE d'un rôle ; ne change pas les données.
 */
export function RolePreviewBar() {
  const isAdmin = useIsAdmin();
  const preview = useRolePreview();

  if (!isAdmin && !ENTERPRISE_PREVIEW) return null;

  return (
    <div className="mx-4 mt-3 rounded-[14px] border border-dashed border-warning/50 bg-warning/5 px-3 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-warning">
        <Eye size={13} /> Prévisualiser l&apos;interface en tant que
        <span className="font-normal text-muted-foreground">
          (démo — ne filtre pas les données)
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setRolePreview(null)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
            preview === null
              ? "bg-navy text-white"
              : "bg-card text-navy ring-1 ring-border",
          )}
        >
          Réel (admin)
        </button>
        {ASSIGNABLE_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRolePreview(r)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
              preview === r
                ? "bg-navy text-white"
                : "bg-card text-navy ring-1 ring-border",
            )}
          >
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
    </div>
  );
}
