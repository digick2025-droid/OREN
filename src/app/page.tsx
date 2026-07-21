import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/accueil");

  const cookieStore = await cookies();
  const t = getDict(parseLang(cookieStore.get(LANG_COOKIE)?.value));

  const steps = [
    { title: t.land_s1, description: t.land_s1d },
    { title: t.land_s2, description: t.land_s2d },
    { title: t.land_s3, description: t.land_s3d },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-brand-navy px-6 pb-10 pt-10 text-white">
      <div className="flex items-center justify-between">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-coral/15 px-3 py-1.5 text-[12px] font-bold text-coral">
          <Zap size={13} /> {t.land_badge}
        </span>
        <LanguageToggle dark />
      </div>

      <h1 className="mt-5 text-[30px] font-extrabold leading-tight">
        {t.land_headline}
        <span className="text-coral">.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/70">
        {t.land_sub}
      </p>

      <Button asChild variant="accent" size="lg" className="mt-7">
        <Link href="/express">{t.land_cta}</Link>
      </Button>

      <div className="mt-12">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-white/50">
          {t.land_how}
        </h2>
        <div className="mt-4 space-y-4">
          {steps.map((step, index) => (
            <div key={step.title} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[15px] font-extrabold">
                {index + 1}
              </div>
              <div>
                <div className="text-[15px] font-bold">{step.title}</div>
                <div className="text-[13px] text-white/60">
                  {step.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-12">
        <Button
          asChild
          variant="outline"
          className="w-full border-white/20 bg-transparent text-white hover:bg-white/10"
        >
          <Link href="/offres">{t.land_pro}</Link>
        </Button>
        <p className="text-center text-[13px] text-white/60">
          {t.land_have}{" "}
          <Link href="/connexion" className="font-bold text-white underline">
            {t.land_login}
          </Link>
          {" · "}
          <Link href="/inscription" className="font-bold text-white underline">
            {t.land_signup}
          </Link>
        </p>
      </div>
    </div>
  );
}
