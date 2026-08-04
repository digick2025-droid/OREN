import { Card } from "@/components/ui/card";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

export type LandingTestimonial = {
  author_name: string;
  author_role: string | null;
  quote: string;
};

/* =============================================================
   OREN · Témoignages clients — alimentés depuis /admin/temoignages.
   Ne s'affiche que s'il existe au moins un témoignage actif : on
   ne remplit jamais ce bloc de contenu inventé.
   ============================================================= */
export function Testimonials({
  kicker,
  title,
  testimonials,
}: {
  kicker: string;
  title: string;
  testimonials: LandingTestimonial[];
}) {
  if (testimonials.length === 0) return null;

  return (
    <section className="bg-surface py-14">
      <div className="mx-auto w-full max-w-[29rem] px-5">
        <ScrollReveal>
          <span className="text-[12.5px] font-extrabold uppercase tracking-[0.08em] text-coral">
            {kicker}
          </span>
          <h2 className="mt-2.5 text-h2 font-extrabold leading-tight">{title}</h2>
        </ScrollReveal>

        <div className="mt-5 space-y-3">
          {testimonials.map((t) => (
            <ScrollReveal key={`${t.author_name}-${t.quote}`}>
              <Card className="p-5">
                <p className="text-[14.5px] leading-relaxed text-foreground">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-3 text-[13px] font-semibold text-navy">
                  {t.author_name}
                  {t.author_role ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      — {t.author_role}
                    </span>
                  ) : null}
                </p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
