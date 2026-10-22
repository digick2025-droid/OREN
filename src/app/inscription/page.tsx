"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useI18n } from "@/features/i18n/language-context";
import { mapAuthError } from "@/lib/auth/errors";
import { isStrongPassword, isValidEmail } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/client";

type Step = "form" | "confirm";
type Field = "company" | "email" | "password";

/** Le premier écran après l'inscription : la promesse, pas un tableau de bord. */
const FIRST_DOCUMENT_PATH = "/nouveau?type=devis";

export default function InscriptionPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("form");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [loading, setLoading] = useState(false);

  // Trois champs seulement : le nom du gérant, le téléphone ou le logo se
  // complètent plus tard dans Réglages. Les erreurs s'affichent sous le champ
  // concerné, toutes en même temps, plutôt qu'en toasts successifs.
  const validate = (): boolean => {
    const next: Partial<Record<Field, string>> = {};
    if (!companyName.trim()) next.company = t.toast_need_company;
    if (!isValidEmail(email)) next.email = t.auth_error_invalid_email;
    if (!isStrongPassword(password)) next.password = t.auth_error_weak_password;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const clearError = (field: Field) =>
    setErrors((current) => ({ ...current, [field]: undefined }));

  const signUp = async () => {
    if (!validate()) return;

    setLoading(true);
    // La validation d'email est désactivée côté projet Supabase
    // (« Confirm email » = OFF) : signUp renvoie directement une session et
    // l'inscription se termine ici. `emailRedirectTo` et l'écran "confirm"
    // plus bas ne servent que de filet si la confirmation était réactivée.
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(FIRST_DOCUMENT_PATH)}`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          company_name: companyName.trim(),
        },
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setLoading(false);
      toast.error(mapAuthError(error, t));
      return;
    }

    if (!data.user) {
      setLoading(false);
      toast.error(t.auth_error_generic);
      return;
    }

    // Anti-énumération Supabase : un email déjà inscrit ne renvoie pas
    // d'erreur, mais un utilisateur fictif sans identité (identities: []).
    // Sans ce contrôle, chaque nouvelle tentative resignait un email de
    // confirmation et finissait par épuiser le quota d'envoi.
    if (data.user.identities && data.user.identities.length === 0) {
      setLoading(false);
      setErrors({ email: t.auth_error_email_taken });
      return;
    }

    if (data.session) {
      const { error: companyError } = await supabase.from("companies").insert({
        name: companyName.trim(),
        owner_id: data.user.id,
        email: email.trim().toLowerCase(),
      });

      if (companyError) {
        // Le compte existe déjà : rester ici condamnerait l'utilisateur à un
        // « email déjà utilisé » au prochain essai. /bienvenue reprend la
        // création de l'entreprise (AutoOnboard + formulaire prérempli).
        console.error("[inscription] company insert failed:", companyError);
        router.push("/bienvenue");
        router.refresh();
        return;
      }

      toast.success(t.signup_ok);
      router.push(FIRST_DOCUMENT_PATH);
      router.refresh();
      return;
    }

    setLoading(false);
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
        href="/"
        className="-ml-1 w-fit rounded-xl p-1.5 text-navy hover:bg-muted"
        aria-label="Retour"
      >
        <ArrowLeft size={22} />
      </Link>

      <form
        className="mt-8"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void signUp();
        }}
      >
        <h1 className="text-[26px] font-extrabold text-navy">
          {t.signup_title}
        </h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">{t.signup_sub}</p>

        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="company">{t.signup_company}</Label>
            <Input
              id="company"
              autoComplete="organization"
              placeholder="Ets Kamga & Fils"
              value={companyName}
              aria-invalid={Boolean(errors.company)}
              aria-describedby={errors.company ? "company-error" : undefined}
              onChange={(event) => {
                setCompanyName(event.target.value);
                clearError("company");
              }}
            />
            <FieldError id="company-error" message={errors.company} />
          </div>
          <div>
            <Label htmlFor="email">{t.login_email}</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="vous@entreprise.cm"
              value={email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError("email");
              }}
            />
            <FieldError id="email-error" message={errors.email} />
          </div>
          <div>
            <Label htmlFor="password">{t.login_password}</Label>
            <PasswordInput
              id="password"
              showLabel={t.auth_show_password}
              hideLabel={t.auth_hide_password}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              aria-invalid={Boolean(errors.password)}
              aria-describedby="password-hint"
              onChange={(event) => {
                setPassword(event.target.value);
                clearError("password");
              }}
            />
            {errors.password ? (
              <FieldError id="password-hint" message={errors.password} />
            ) : (
              <p
                id="password-hint"
                className="mt-1.5 text-[12px] text-muted-foreground/70"
              >
                {t.signup_password_hint}
              </p>
            )}
          </div>
        </div>

        <Button type="submit" className="mt-6 w-full" disabled={loading}>
          {loading ? t.signup_creating : t.signup_btn}
        </Button>
        <p className="mt-3 text-center text-[12.5px] text-muted-foreground/80">
          {t.signup_next_hint}
        </p>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          {t.signup_have_account}{" "}
          <Link href="/connexion" className="font-bold text-navy underline">
            {t.land_login}
          </Link>
        </p>
      </form>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[12.5px] font-semibold text-danger">
      {message}
    </p>
  );
}
