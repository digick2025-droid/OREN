import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { SocialProof } from "@/components/landing/social-proof";
import { WhatsAppShowcase } from "@/components/landing/whatsapp-showcase";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SUPPORT_WHATSAPP } from "@/lib/constants";
import { formatAmountShort } from "@/lib/format";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/config";
import { getDict } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { buildWhatsAppLink } from "@/services/whatsapp";

/* Colonne unique, mobile d'abord — la landing garde la largeur de l'app. */
const COL = "mx-auto w-full max-w-[29rem] px-5";
const KICKER =
  "text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-coral";
const SECTION_TITLE = "mt-2.5 text-h2 font-extrabold leading-tight";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/accueil");

  const cookieStore = await cookies();
  const lang = parseLang(cookieStore.get(LANG_COOKIE)?.value);
  const t = getDict(lang);

  const supportHref = buildWhatsAppLink(SUPPORT_WHATSAPP, t.land_wa_message);

  const benefits = [
    { icon: Clock, title: t.land_ben1_title, desc: t.land_ben1_desc },
    { icon: ShieldCheck, title: t.land_ben2_title, desc: t.land_ben2_desc },
    { icon: TrendingUp, title: t.land_ben3_title, desc: t.land_ben3_desc },
  ];

  const steps = [
    { title: t.land_step1_title, desc: t.land_step1_desc },
    { title: t.land_step2_title, desc: t.land_step2_desc },
    { title: t.land_step3_title, desc: t.land_step3_desc },
  ];

  const objections = [
    { q: t.land_obj1_q, a: t.land_obj1_a },
    { q: t.land_obj2_q, a: t.land_obj2_a },
    { q: t.land_obj3_q, a: t.land_obj3_a },
    { q: t.land_obj4_q, a: t.land_obj4_a },
  ];

  // Statut réel des briques produit — ne pas « promouvoir » à la légère.
  const modules = [
    { label: t.land_plat_docs, live: true },
    { label: t.land_plat_clients, live: true },
    { label: t.land_plat_catalog, live: true },
    { label: t.land_plat_payments, live: true },
    { label: t.land_plat_reports, live: true },
    { label: t.land_plat_treasury, live: false },
    { label: t.land_plat_stock, live: false },
    { label: t.land_plat_ai, live: false },
  ];

  // Tarifs alignés sur la table `plans` (express 500/doc, pro 3 000, startup 5 000).
  const plans = [
    {
      name: t.land_price_free_name,
      price: 0,
      unit: t.land_price_currency,
      desc: t.land_price_free_desc,
      href: "/inscription",
      tag: t.land_price_tag_start,
    },
    {
      name: t.land_price_express_name,
      price: 500,
      unit: t.land_price_unit_doc,
      desc: t.land_price_express_desc,
      href: "/offres",
      tag: null,
    },
    {
      name: t.land_price_pro_name,
      price: 3000,
      unit: t.land_price_unit_month,
      desc: t.land_price_pro_desc,
      href: "/offres",
      tag: null,
    },
    {
      name: t.land_price_startup_name,
      price: 5000,
      unit: t.land_price_unit_month,
      desc: t.land_price_startup_desc,
      href: "/offres",
      tag: null,
    },
  ];

  return (
    <div className="min-h-dvh bg-background">
      {/* ---------------- Barre du haut ---------------- */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-navy/80 backdrop-blur-md">
        <div className={cn(COL, "flex h-16 items-center justify-between")}>
          <Logo tone="white" markClassName="h-7 w-7" wordClassName="text-xl" />
          <div className="flex items-center gap-3">
            <LanguageToggle dark />
            <Link
              href="/connexion"
              className="rounded-field px-1 py-1 text-sm font-semibold text-white/85 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {t.land_login}
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- Héros ---------------- */}
      <section className="relative overflow-hidden bg-brand-navy pb-9 pt-10 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-accent/20 blur-3xl"
        />
        <div className={cn(COL, "relative")}>
          <ScrollReveal>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-[12.5px] font-bold text-coral">
              <Zap className="h-[13px] w-[13px]" />
              {t.land_hero_eyebrow}
            </span>
            <h1 className="mt-4 text-h1 font-extrabold leading-[1.08] sm:text-display">
              {t.land_hero_title}
              <span className="text-coral">.</span>
            </h1>
            <p className="mt-4 max-w-[40ch] text-[16px] leading-relaxed text-white/70">
              {t.land_hero_sub}
            </p>
          </ScrollReveal>

          <ScrollReveal className="mt-6 flex flex-col gap-3">
            <Button asChild variant="accent" size="lg">
              <Link href="/inscription">{t.land_cta_primary}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/20 bg-transparent text-white hover:bg-white/10"
            >
              <Link href="/express">{t.land_cta_secondary}</Link>
            </Button>
            <p className="text-center text-[12.5px] text-white/50">
              {t.land_cta_note}
            </p>
          </ScrollReveal>

          <ScrollReveal>
            <SocialProof title={t.land_proof_title} note={t.land_proof_note} />
          </ScrollReveal>
        </div>
      </section>

      {/* ------- Signature : le devis dans WhatsApp ------- */}
      <div className="bg-brand-navy pb-14">
        <div className={COL}>
          <ScrollReveal>
            <WhatsAppShowcase t={t} lang={lang} />
            <p className="mx-auto mt-5 max-w-[34ch] text-center text-[13.5px] text-white/60">
              {t.land_demo_caption}
            </p>
          </ScrollReveal>
        </div>
      </div>

      {/* ---------------- Bénéfices ---------------- */}
      <section className="bg-background py-14">
        <div className={COL}>
          <ScrollReveal>
            <span className={KICKER}>{t.land_ben_kicker}</span>
            <h2 className={SECTION_TITLE}>{t.land_ben_title}</h2>
          </ScrollReveal>

          <div className="mt-5">
            {benefits.map(({ icon: Icon, title, desc }) => (
              <ScrollReveal
                key={title}
                className="flex gap-4 border-b border-border py-5 last:border-none"
              >
                <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-field bg-accent/10">
                  <Icon className="h-[23px] w-[23px] text-coral" />
                </span>
                <div>
                  <h3 className="text-[17px] font-bold tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-muted-foreground">
                    {desc}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Comment ça marche ---------------- */}
      <section className="bg-surface py-14">
        <div className={COL}>
          <ScrollReveal>
            <span className={KICKER}>{t.land_how_kicker}</span>
            <h2 className={SECTION_TITLE}>{t.land_how_title}</h2>
          </ScrollReveal>

          <ol className="mt-5">
            {steps.map((step, index) => (
              <li key={step.title}>
                <ScrollReveal>
                  <div className="flex items-start gap-4 py-4">
                    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-field bg-primary text-[16px] font-extrabold text-primary-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-[16px] font-bold">{step.title}</h3>
                      <p className="mt-1 text-[14px] text-muted-foreground">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="ml-[18px] block h-3.5 w-0.5 bg-border"
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Objections ---------------- */}
      <section className="bg-background py-14">
        <div className={COL}>
          <ScrollReveal>
            <span className={KICKER}>{t.land_obj_kicker}</span>
            <h2 className={SECTION_TITLE}>{t.land_obj_title}</h2>
          </ScrollReveal>

          <div className="mt-5">
            {objections.map((item) => (
              <ScrollReveal
                key={item.q}
                className="border-b border-border py-5 last:border-none"
              >
                <h3 className="flex items-center gap-2.5 text-[15.5px] font-bold">
                  <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-success/15">
                    <Check className="h-[13px] w-[13px] text-success" />
                  </span>
                  {item.q}
                </h3>
                <p className="ml-[32px] mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Plateforme ---------------- */}
      <section className="bg-brand-navy py-14 text-white">
        <div className={COL}>
          <ScrollReveal>
            <span className={KICKER}>{t.land_plat_kicker}</span>
            <h2 className={SECTION_TITLE}>{t.land_plat_title}</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed text-white/70">
              {t.land_plat_lead}
            </p>
          </ScrollReveal>

          <ScrollReveal className="mt-6 flex flex-wrap gap-2.5">
            {modules.map((mod) => (
              <span
                key={mod.label}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12.5px] font-semibold",
                  mod.live
                    ? "border-whatsapp/30 bg-whatsapp/10 text-white"
                    : "border-white/10 bg-white/5 text-white/80",
                )}
              >
                {mod.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide",
                    mod.live
                      ? "bg-whatsapp text-white"
                      : "bg-accent/15 text-coral",
                  )}
                >
                  {mod.live ? t.land_plat_live : t.land_plat_soon}
                </span>
              </span>
            ))}
          </ScrollReveal>
        </div>
      </section>

      {/* ---------------- Offres ---------------- */}
      <section className="bg-surface py-14">
        <div className={COL}>
          <ScrollReveal>
            <span className={KICKER}>{t.land_price_kicker}</span>
            <h2 className={SECTION_TITLE}>{t.land_price_title}</h2>
          </ScrollReveal>

          <div className="mt-6 space-y-3.5">
            {plans.map((plan) => (
              <ScrollReveal key={plan.name}>
                <Link href={plan.href} className="group block">
                  <Card
                    className={cn(
                      "relative p-[18px] transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring/50",
                      plan.tag && "border-2 border-coral",
                    )}
                  >
                    {plan.tag ? (
                      <span className="absolute -top-2.5 left-[18px] rounded-full bg-accent px-2.5 py-1 text-[11px] font-extrabold text-accent-foreground">
                        {plan.tag}
                      </span>
                    ) : null}
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[16.5px] font-extrabold">
                        {plan.name}
                      </span>
                      <span className="shrink-0 text-[16px] font-extrabold tabular-nums">
                        {formatAmountShort(plan.price)}{" "}
                        <small className="text-[12px] font-semibold text-muted-foreground">
                          {plan.unit}
                        </small>
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                      {plan.desc}
                    </p>
                  </Card>
                </Link>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal>
            <Link
              href="/offres"
              className="mt-5 flex items-center justify-center gap-1.5 rounded-field py-2 text-[14.5px] font-bold hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {t.land_price_compare}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ---------------- CTA final ---------------- */}
      <section className="relative overflow-hidden bg-brand-navy py-16 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-1/2 h-72 w-80 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl"
        />
        <div className={cn(COL, "relative")}>
          <ScrollReveal>
            <h2 className="text-h2 font-extrabold leading-tight">
              {t.land_final_title}
            </h2>
            <p className="mt-3 text-[15px] text-white/70">
              {t.land_final_sub}
            </p>
            <Button asChild variant="accent" size="lg" className="mt-7 w-full">
              <Link href="/inscription">{t.land_cta_primary}</Link>
            </Button>
            <p className="mt-3.5 text-[12.5px] text-white/50">
              {t.land_final_note}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-white/10 bg-brand-navy py-8 text-[13px] text-white/60">
        <div className={cn(COL, "flex flex-col gap-4")}>
          <div className="flex items-center justify-between">
            <Logo tone="white" markClassName="h-6 w-6" wordClassName="text-lg" />
            <LanguageToggle dark />
          </div>

          <a
            href={supportHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-field font-semibold text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <MessageCircle className="h-[17px] w-[17px] text-whatsapp" />
            {t.land_foot_support} {SUPPORT_WHATSAPP}
          </a>

          <nav className="flex flex-wrap gap-x-4 gap-y-2">
            {[
              { href: "/offres", label: t.off_title },
              { href: "/connexion", label: t.land_login },
              { href: "/inscription", label: t.land_signup },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-field hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-[12px] text-white/40">{t.land_foot_note}</p>
        </div>
      </footer>

      {/* ---------------- Support WhatsApp flottant ---------------- */}
      <a
        href={supportHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t.land_wa_aria}
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-whatsapp px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-whatsapp focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
      >
        <MessageCircle className="h-[22px] w-[22px]" />
        <span className="hidden min-[420px]:inline">{t.land_wa_float}</span>
      </a>
    </div>
  );
}
