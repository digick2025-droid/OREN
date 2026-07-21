"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/features/i18n/language-context";
import { mapAuthError } from "@/lib/auth/errors";
import { isValidEmail } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

export default function MotDePasseOubliePage() {
  const supabase = createClient();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const sendReset = async () => {
    if (!isValidEmail(email)) {
      toast.error(t.auth_error_invalid_email);
      return;
    }

    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/mot-de-passe/reinitialiser`;
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo },
    );
    setLoading(false);

    if (error) {
      toast.error(mapAuthError(error.message, t));
      return;
    }

    setSent(true);
    toast.success(t.auth_reset_sent);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 pt-6">
      <Link
        href="/connexion"
        className="-ml-1 w-fit rounded-xl p-1.5 text-navy hover:bg-muted"
        aria-label="Retour"
      >
        <ArrowLeft size={22} />
      </Link>

      <div className="mt-8">
        <h1 className="text-[26px] font-extrabold text-navy">
          {t.auth_reset_title}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {sent ? t.auth_reset_sent_sub : t.auth_reset_sub}
        </p>

        {!sent && (
          <>
            <div className="mt-8">
              <Label htmlFor="email">{t.login_email}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="vous@entreprise.cm"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void sendReset()}
              />
            </div>

            <Button
              className="mt-6 w-full"
              onClick={() => void sendReset()}
              disabled={loading}
            >
              {loading ? t.auth_reset_sending : t.auth_reset_btn}
            </Button>
          </>
        )}

        {sent && (
          <Button asChild className="mt-8 w-full">
            <Link href="/connexion">{t.login_btn}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
