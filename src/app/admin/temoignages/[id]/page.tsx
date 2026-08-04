"use client";

import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TestimonialForm } from "@/features/admin/testimonial-form";
import { useAdminTestimonial } from "@/hooks/use-admin-testimonials";

export default function EditTestimonialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: testimonial, isLoading } = useAdminTestimonial(id);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/admin/temoignages"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} /> Témoignages
        </Link>
        <h1 className="mt-2 text-xl font-bold text-navy">
          {testimonial ? testimonial.author_name : "Témoignage"}
        </h1>
      </div>

      {isLoading || !testimonial ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <TestimonialForm testimonial={testimonial} />
      )}
    </div>
  );
}
