"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInviteMember } from "@/hooks/use-team";
import { INVITABLE_ROLES, ROLE_HINTS, ROLE_LABELS } from "@/lib/roles";
import { toInternationalPhone } from "@/services/whatsapp";
import { cn } from "@/lib/utils";
import type { InvitationRole } from "@/types/database";

export default function InviterPage() {
  const router = useRouter();
  const invite = useInviteMember();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<InvitationRole>("commercial");

  const submit = () => {
    const normalized = toInternationalPhone(phone);
    if (normalized.length < 8) {
      toast.error("Numéro de téléphone invalide");
      return;
    }
    invite.mutate(
      { phone: normalized, role, name: name.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Invitation envoyée");
          router.push("/equipe");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div>
      <ScreenHeader title="Inviter un membre" backHref="/equipe" />
      <div className="space-y-5 px-4 pt-5">
        <div>
          <Label htmlFor="invite-name">Nom</Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Jean Kouassi"
          />
        </div>

        <div>
          <Label htmlFor="invite-phone">Téléphone</Label>
          <Input
            id="invite-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="6 90 00 00 00"
          />
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {"La personne rejoindra l'équipe après s'être connectée avec ce numéro."}
          </p>
        </div>

        <div>
          <Label>Rôle</Label>
          <div className="space-y-2">
            {INVITABLE_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={cn(
                  "flex w-full flex-col items-start rounded-[14px] border-[1.5px] px-4 py-3 text-left transition-colors",
                  role === r
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card",
                )}
              >
                <span className="text-[14px] font-bold text-navy">
                  {ROLE_LABELS[r]}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {ROLE_HINTS[r]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Button
          className="w-full"
          onClick={submit}
          disabled={invite.isPending}
        >
          {invite.isPending ? "Envoi…" : "Envoyer l'invitation"}
        </Button>
      </div>
    </div>
  );
}
