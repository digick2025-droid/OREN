"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TestimonialForm } from "@/features/admin/testimonial-form";

export default function NouveauTestimonialPage() {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/admin/temoignages"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} /> Témoignages
        </Link>
        <h1 className="mt-2 text-xl font-bold text-navy">Nouveau témoignage</h1>
      </div>

      <TestimonialForm />
    </div>
  );
}
