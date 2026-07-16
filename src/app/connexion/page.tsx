"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { isValidPhone, normalizePhoneE164 } from "@/lib/phone";

type Step = "phone" | "otp";

export default function ConnexionPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    if (!isValidPhone(phone)) {
      toast.error("Entrez un numéro valide");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizePhoneE164(phone),
    });
    setLoading(false);
    if (error) {
      toast.error("Impossible d'envoyer le code. Réessayez.");
      return;
    }
    toast.success("Code envoyé par SMS");
    setStep("otp");
  };

  const verifyCode = async () => {
    if (code.length < 4) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizePhoneE164(phone),
      token: code,
      type: "sms",
    });
    setLoading(false);
    if (error) {
      toast.error("Code incorrect, réessayez.");
      return;
    }
    toast.success("Connexion réussie");
    router.push("/accueil");
    router.refresh();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white px-6 pt-6">
      <Link
        href={step === "phone" ? "/" : "#"}
        onClick={(event) => {
          if (step === "otp") {
            event.preventDefault();
            setStep("phone");
            setCode("");
          }
        }}
        className="-ml-1 w-fit rounded-xl p-1.5 text-navy hover:bg-[#EEF0F4]"
        aria-label="Retour"
      >
        <ArrowLeft size={22} />
      </Link>

      {step === "phone" ? (
        <div className="mt-8">
          <h1 className="text-[26px] font-extrabold text-navy">Bienvenue</h1>
          <p className="mt-1.5 text-[14px] text-[#5A6377]">
            Entrez votre numéro pour commencer
          </p>

          <div className="mt-8">
            <Label htmlFor="phone">Numéro de téléphone</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder="6 90 00 00 00"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void sendCode()}
            />
            <p className="mt-2 text-[12px] text-[#8A93A6]">
              Vous recevrez un code de vérification par SMS / WhatsApp.
            </p>
          </div>

          <Button
            className="mt-6 w-full"
            onClick={() => void sendCode()}
            disabled={loading}
          >
            {loading ? "Envoi…" : "Recevoir le code"}
          </Button>
        </div>
      ) : (
        <div className="mt-8">
          <h1 className="text-[26px] font-extrabold text-navy">Vérification</h1>
          <p className="mt-1.5 text-[14px] text-[#5A6377]">
            Entrez le code envoyé au{" "}
            <span className="font-semibold text-navy">
              {normalizePhoneE164(phone)}
            </span>
          </p>

          <div className="mt-8">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              maxLength={6}
              className="text-center text-[22px] font-bold tracking-[0.4em]"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/[^\d]/g, ""))
              }
              onKeyDown={(event) => event.key === "Enter" && void verifyCode()}
            />
          </div>

          <Button
            className="mt-6 w-full"
            onClick={() => void verifyCode()}
            disabled={loading || code.length < 4}
          >
            {loading ? "Vérification…" : "Vérifier"}
          </Button>

          <button
            type="button"
            onClick={() => void sendCode()}
            className="mt-4 w-full text-center text-[13px] font-semibold text-[#5A6377] underline"
          >
            Renvoyer le code
          </button>
        </div>
      )}
    </div>
  );
}
