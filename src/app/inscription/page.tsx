"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/features/i18n/language-context";
import { mapAuthError } from "@/lib/auth/errors";
import {
  isStrongPassword,
  isValidEmail,
  passwordsMatch,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "confirm";

export default function InscriptionPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("form");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const signUp = async () => {
    if (!companyName.trim()) {
      toast.error(t.toast_need_company);
      return;
    }
    if (!fullName.trim()) {
      toast.error(t.signup_need_name);
      return;
    }
    if (!isValidEmail(email)) {
      toast.error(t.auth_error_invalid_email);
      return;
    }
    if (!isStrongPassword(password)) {
      toast.error(t.auth_error_weak_password);
      return;
    }
    if (!passwordsMatch(password, confirmPassword)) {
      toast.error(t.signup_password_mismatch);
      return;
    }

    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/accueil`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          company_name: companyName.trim(),
        },
        emailRedirectTo: redirectTo,
      },
    });
    setLoading(false);

    if (error) {
      toast.error(mapAuthError(error.message, t));
      return;
    }

    if (!data.user) {
      toast.error(t.auth_error_generic);
      return;
    }

    if (data.session) {
      const { error: companyError } = await supabase.from("companies").insert({
        name: companyName.trim(),
        owner_name: fullName.trim(),
        owner_id: data.user.id,
        email: email.trim().toLowerCase(),
      });

      if (companyError) {
        toast.error(t.toast_save_error);
        return;
      }

      toast.success(t.signup_ok);
      router.push("/accueil");
      router.refresh();
      return;
    }

    setStep("confirm");
  };

  if (step === "confirm") {
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
            {t.signup_confirm_title}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            {t.signup_confirm_sub}{" "}
            <span className="font-semibold text-navy">{email}</span>
          </p>
          <Button asChild className="mt-8 w-full">
            <Link href="/connexion">{t.login_btn}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-card px-6 pt-6 pb-8">
      <Link
        href="/connexion"
        className="-ml-1 w-fit rounded-xl p-1.5 text-navy hover:bg-muted"
        aria-label="Retour"
      >
        <ArrowLeft size={22} />
      </Link>

      <div className="mt-8">
        <h1 className="text-[26px] font-extrabold text-navy">
          {t.signup_title}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">{t.signup_sub}</p>

        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="company">{t.f_company}</Label>
            <Input
              id="company"
              autoComplete="organization"
              placeholder="Ets Kamga & Fils"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="fullName">{t.signup_full_name}</Label>
            <Input
              id="fullName"
              autoComplete="name"
              placeholder="Paul Kamga"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">{t.login_email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="vous@entreprise.cm"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">{t.login_password}</Label>
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
              onKeyDown={(event) => event.key === "Enter" && void signUp()}
            />
          </div>
        </div>

        <Button
          className="mt-6 w-full"
          onClick={() => void signUp()}
          disabled={loading}
        >
          {loading ? t.signup_creating : t.signup_btn}
        </Button>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          {t.signup_have_account}{" "}
          <Link href="/connexion" className="font-bold text-navy underline">
            {t.land_login}
          </Link>
        </p>
      </div>
    </div>
  );
}
