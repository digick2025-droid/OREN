"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAmount } from "@/lib/format";
import { isValidPhone } from "@/lib/phone";
import type { PaymentMethod } from "@/types/database";
import { cn } from "@/lib/utils";

const METHODS: Array<{
  key: PaymentMethod;
  label: string;
  available: boolean;
}> = [
  { key: "orange_money", label: "Orange Money", available: true },
  { key: "mtn_momo", label: "MTN MoMo", available: true },
  { key: "card", label: "Carte bancaire", available: false },
];

export interface PaymentFormProps {
  amount: number;
  buttonLabel?: string;
  onPay: (input: {
    method: PaymentMethod;
    phone: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onSuccess: () => void;
}

export function PaymentForm({
  amount,
  buttonLabel,
  onPay,
  onSuccess,
}: PaymentFormProps) {
  const [method, setMethod] = useState<PaymentMethod>("orange_money");
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);

  const pay = async () => {
    if (method !== "card" && !isValidPhone(phone)) {
      toast.error("Entrez un numéro Mobile Money valide");
      return;
    }
    setProcessing(true);
    const result = await onPay({ method, phone });
    setProcessing(false);
    if (!result.ok) {
      toast.error("Le paiement a échoué. Réessayez.");
      return;
    }
    onSuccess();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 text-center">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[#8A93A6]">
          Montant à payer
        </div>
        <div className="mt-1 text-[26px] font-extrabold text-navy">
          {formatAmount(amount)}
        </div>
      </Card>

      <div>
        <Label>Opérateur Mobile Money</Label>
        <div className="space-y-2">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              disabled={!m.available}
              onClick={() => setMethod(m.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border-[1.5px] px-4 py-3.5 text-[14px] font-semibold transition-colors",
                method === m.key
                  ? "border-navy bg-navy text-white"
                  : "border-[#E2E5EC] bg-white text-[#5A6377]",
                !m.available && "opacity-50",
              )}
            >
              {m.key === "card" ? (
                <CreditCard size={18} />
              ) : (
                <Smartphone size={18} />
              )}
              {m.label}
              {!m.available && (
                <span className="ml-auto rounded-full bg-[#FFF7E8] px-2 py-0.5 text-[10.5px] font-bold text-warning">
                  Bientôt
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {method !== "card" && (
        <div>
          <Label htmlFor="pay-phone">Numéro Mobile Money</Label>
          <Input
            id="pay-phone"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="6 90 00 00 00"
          />
        </div>
      )}

      {processing ? (
        <Card className="flex items-center gap-3 p-4">
          <Loader2 size={19} className="animate-spin text-navy" />
          <div>
            <div className="text-[14px] font-bold text-navy">
              Validez le paiement sur votre téléphone…
            </div>
            <div className="text-[12px] text-[#8A93A6]">
              Traitement en cours…
            </div>
          </div>
        </Card>
      ) : (
        <Button
          variant="accent"
          size="lg"
          className="w-full"
          onClick={() => void pay()}
        >
          {buttonLabel ?? "Payer"}
        </Button>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-[#8A93A6]">
        <ShieldCheck size={13} />
        Paiement sécurisé via CamerPay · résiliable à tout moment
      </p>
    </div>
  );
}
