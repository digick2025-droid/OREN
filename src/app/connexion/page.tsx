"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/features/i18n/language-context";
import { mapAuthError } from "@/lib/auth/errors";
import { isValidEmail } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

export default function ConnexionPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth") {
      toast.error(t.auth_error_generic);
    }
    if (params.get("reset") === "ok") {
      toast.success(t.auth_reset_ok);
    }
  }, [t]);

  const signIn = async () => {
    if (!isValidEmail(email)) {
      toast.error(t.auth_error_invalid_email);
      return;
    }
    if (!password) {
      toast.error(t.auth_error_credentials);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      toast.error(mapAuthError(error.message, t));
      return;
    }

    toast.success(t.auth_login_ok);
    router.push("/accueil");
    router.refresh();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 pt-6">
      <Link
        href="/"
        className="-ml-1 w-fit rounded-xl p-1.5 text-navy hover:bg-muted"
        aria-label="Retour"
      >
        <ArrowLeft size={22} />
      </Link>

      <div className="mt-8">
        <h1 className="text-[26px] font-extrabold text-navy">{t.login_title}</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">{t.login_sub}</p>

        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="email">{t.login_email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="vous@entreprise.cm"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void signIn()}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t.login_password}</Label>
              <Link
                href="/mot-de-passe-oublie"
                className="text-[12px] font-semibold text-muted-foreground underline"
              >
                {t.login_forgot}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void signIn()}
            />
          </div>
        </div>

        <Button
          className="mt-6 w-full"
          onClick={() => void signIn()}
          disabled={loading}
        >
          {loading ? t.login_signing_in : t.login_btn}
        </Button>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          {t.login_no_account}{" "}
          <Link href="/inscription" className="font-bold text-navy underline">
            {t.login_signup_link}
          </Link>
        </p>
      </div>
    </div>
  );
}
