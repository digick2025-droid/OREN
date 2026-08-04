import { Card } from "@/components/ui/card";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { cn } from "@/lib/utils";

export type LandingTestimonial = {
  id: string;
  author_name: string;
  author_role: string | null;
  quote: string | null;
  image_url: string | null;
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
            <ScrollReveal key={t.id}>
              <Card className="overflow-hidden p-5">
                {t.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- capture d'écran à ratio libre (bucket public), pas d'intrinsic size fiable pour next/image
                  <img
                    src={t.image_url}
                    alt=""
                    className="-mx-5 -mt-5 mb-4 w-[calc(100%+2.5rem)] object-cover"
                  />
                ) : null}
                {t.quote ? (
                  <p className="text-[14.5px] leading-relaxed text-foreground">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                ) : null}
                <p className={cn("text-[13px] font-semibold text-navy", t.quote && "mt-3")}>
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
