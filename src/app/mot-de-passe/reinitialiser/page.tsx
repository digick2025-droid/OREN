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
import {
  isStrongPassword,
  passwordsMatch,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

export default function ReinitialiserMotDePassePage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Sans session de récupération, `updateUser` échouerait après coup avec une
  // erreur opaque : on vérifie avant d'afficher le formulaire.
  const [session, setSession] = useState<"checking" | "valid" | "missing">(
    "checking",
  );

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session ? "valid" : "missing");
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePassword = async () => {
    if (!isStrongPassword(password)) {
      toast.error(t.auth_error_weak_password);
      return;
    }
    if (!passwordsMatch(password, confirmPassword)) {
      toast.error(t.signup_password_mismatch);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(mapAuthError(error, t));
      return;
    }

    toast.success(t.auth_reset_ok);
    router.push("/connexion?reset=ok");
    router.refresh();
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
          {t.auth_new_password_title}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">
          {session === "missing" ? t.auth_error_no_session : t.auth_new_password_sub}
        </p>

        {session === "missing" && (
          <Button asChild className="mt-8 w-full">
            <Link href="/mot-de-passe-oublie">{t.auth_request_new_link}</Link>
          </Button>
        )}

        {session === "valid" && (
          <>
        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="password">{t.auth_new_password}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="mt-1.5 text-[12px] text-muted-foreground/70">
              {t.signup_password_hint}
            </p>
          </div>
          <div>
            <Label htmlFor="confirmPassword">{t.signup_confirm_password}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onKeyDown={(event) =>
                event.key === "Enter" && void updatePassword()
              }
            />
          </div>
        </div>

        <Button
          className="mt-6 w-full"
          onClick={() => void updatePassword()}
          disabled={loading}
        >
          {loading ? t.saving : t.auth_new_password_btn}
        </Button>
          </>
        )}
      </div>
    </div>
  );
}
