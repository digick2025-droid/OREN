import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/accueil");

  const steps = [
    {
      icon: FileText,
      title: "Ajoutez vos articles",
      description: "Client, prestations et quantités.",
    },
    {
      icon: Zap,
      title: "Aperçu professionnel",
      description: "Un PDF propre, à votre nom.",
    },
    {
      icon: Send,
      title: "Payez 500 F & envoyez",
      description: "Téléchargez et partagez sur WhatsApp.",
    },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-navy px-6 pb-10 pt-16 text-white">
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-coral/15 px-3 py-1.5 text-[12px] font-bold text-coral">
        <Zap size={13} /> DIGICK Express
      </span>

      <h1 className="mt-5 text-[30px] font-extrabold leading-tight">
        Créez un devis professionnel en moins de 2 minutes
        <span className="text-coral">.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/70">
        Envoyez-le à votre client sur WhatsApp. Sans compte · sans abonnement ·
        500 FCFA par devis.
      </p>

      <Button asChild variant="accent" size="lg" className="mt-7">
        <Link href="/express">Créer mon devis</Link>
      </Button>

      <div className="mt-12">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-white/50">
          Comment ça marche
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
        <Button asChild variant="outline" className="w-full border-white/20 bg-transparent text-white hover:bg-white/10">
          <Link href="/offres">Découvrir DIGICK Pro</Link>
        </Button>
        <p className="text-center text-[13px] text-white/60">
          J&apos;ai déjà un compte{" "}
          <Link href="/connexion" className="font-bold text-white underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
