"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import { useClaimInvitations, useMyInvitations } from "@/hooks/use-team";
import { ROLE_LABELS } from "@/lib/roles";

export default function InvitationsPage() {
  const router = useRouter();
  const { data: invitations, isLoading } = useMyInvitations();
  const claim = useClaimInvitations();

  const accept = () => {
    claim.mutate(undefined, {
      onSuccess: (count) => {
        toast.success(
          count > 1 ? `${count} entreprises rejointes` : "Entreprise rejointe",
        );
        router.replace("/accueil");
        router.refresh();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 bg-surface px-5 py-10">
      <div className="flex justify-center">
        <Logo />
      </div>

      {isLoading ? (
        <p className="text-center text-[14px] text-muted-foreground">
          Chargement…
        </p>
      ) : (invitations ?? []).length === 0 ? (
        <div className="space-y-4 text-center">
          <p className="text-[15px] text-muted-foreground">
            Aucune invitation en attente.
          </p>
          <Button className="w-full" onClick={() => router.replace("/bienvenue")}>
            Créer mon entreprise
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-1 text-center">
            <h1 className="text-[20px] font-extrabold text-navy">
              Vous êtes invité
            </h1>
            <p className="text-[13.5px] text-muted-foreground">
              Rejoignez votre équipe sur OREN.
            </p>
          </div>

          <div className="space-y-2">
            {(invitations ?? []).map((inv) => (
              <Card key={inv.id} className="px-4 py-4">
                <div className="text-[15px] font-bold text-navy">
                  {inv.company_name}
                </div>
                <div className="text-[12.5px] text-muted-foreground">
                  en tant que {ROLE_LABELS[inv.role]}
                </div>
              </Card>
            ))}
          </div>

          <Button
            className="w-full"
            onClick={accept}
            disabled={claim.isPending}
          >
            {claim.isPending ? "…" : "Rejoindre"}
          </Button>
        </div>
      )}
    </div>
  );
}
