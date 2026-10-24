"use client";

import Link from "next/link";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCurrentRole } from "@/features/company/company-context";
import {
  usePendingInvitations,
  useRemoveMember,
  useSetMemberRole,
  useTeamMembers,
} from "@/hooks/use-team";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/roles";
import { toInternationalPhone } from "@/services/whatsapp";
import type { CompanyRole } from "@/types/database";

export default function EquipePage() {
  const role = useCurrentRole();
  const canManage = role === "gerant";
  const { data: members, isLoading } = useTeamMembers();
  const { data: invitations } = usePendingInvitations();
  const setRole = useSetMemberRole();
  const removeMember = useRemoveMember();

  const changeRole = (userId: string, nextRole: CompanyRole) => {
    setRole.mutate(
      { userId, role: nextRole },
      {
        onSuccess: () => toast.success("Rôle mis à jour"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const remove = (userId: string, name: string) => {
    if (!confirm(`Retirer ${name} de l'équipe ?`)) return;
    removeMember.mutate(userId, {
      onSuccess: () => toast.success("Membre retiré"),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div>
      <ScreenHeader
        title="Équipe"
        backHref="/reglages"
        action={
          canManage ? (
            <Link
              href="/equipe/inviter"
              aria-label="Inviter"
              className="rounded-xl p-1.5 text-navy hover:bg-muted"
            >
              <UserPlus size={21} />
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-5 px-4 pt-4">
        <section className="space-y-2">
          <h2 className="px-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Membres
          </h2>
          {isLoading ? (
            <p className="px-1 text-[13px] text-muted-foreground">Chargement…</p>
          ) : (
            (members ?? []).map((m) => {
              const name = m.full_name || m.phone || "Sans nom";
              return (
                <Card key={m.user_id} className="space-y-3 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-[15px] font-extrabold text-navy">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-bold text-navy">
                        {name}
                      </div>
                      <div className="text-[12.5px] text-muted-foreground">
                        {m.is_owner ? "Propriétaire · " : ""}
                        {ROLE_LABELS[m.role]}
                        {m.status === "suspended" ? " · suspendu" : ""}
                      </div>
                    </div>
                  </div>

                  {canManage && !m.is_owner ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        onChange={(e) =>
                          changeRole(m.user_id, e.target.value as CompanyRole)
                        }
                        disabled={setRole.isPending}
                        className="h-11 flex-1 rounded-[14px] border-[1.5px] border-border bg-card px-3 text-[14px] text-navy focus-visible:border-navy focus-visible:outline-none"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="destructive"
                        onClick={() => remove(m.user_id, name)}
                        disabled={removeMember.isPending}
                      >
                        Retirer
                      </Button>
                    </div>
                  ) : null}
                </Card>
              );
            })
          )}
        </section>

        {(invitations ?? []).length > 0 ? (
          <section className="space-y-2">
            <h2 className="px-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Invitations en attente
            </h2>
            {(invitations ?? []).map((inv) => (
              <Card
                key={inv.id}
                className="flex items-center gap-3 px-4 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-navy">
                    +{toInternationalPhone(inv.phone)}
                  </div>
                  <div className="text-[12.5px] text-muted-foreground">
                    {ROLE_LABELS[inv.role]} · en attente
                  </div>
                </div>
              </Card>
            ))}
          </section>
        ) : null}

        {!canManage ? (
          <p className="px-1 text-[12.5px] text-muted-foreground">
            Seul le gérant peut inviter ou modifier des membres.
          </p>
        ) : null}
      </div>
    </div>
  );
}
