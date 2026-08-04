"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Testimonial {
  id: string;
  author_name: string;
  author_role: string | null;
  quote: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export function useAdminTestimonials() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: async (): Promise<Testimonial[]> => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Testimonial[];
    },
  });
}

export function useAdminTestimonial(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin-testimonial", id],
    queryFn: async (): Promise<Testimonial> => {
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Testimonial;
    },
    enabled: Boolean(id),
  });
}

export interface SaveTestimonialInput {
  author_name: string;
  author_role: string | null;
  quote: string;
  display_order: number;
  is_active: boolean;
}

export function useCreateTestimonial() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveTestimonialInput): Promise<Testimonial> => {
      const { data, error } = await supabase
        .from("testimonials")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as Testimonial;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
    },
  });
}

export function useUpdateTestimonial() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      values: Partial<SaveTestimonialInput>;
    }): Promise<Testimonial> => {
      const { data, error } = await supabase
        .from("testimonials")
        .update(input.values)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data as Testimonial;
    },
    onSuccess: (_data, input) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin-testimonial", input.id],
      });
    },
  });
}

export function useDeleteTestimonial() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("testimonials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
    },
  });
}
