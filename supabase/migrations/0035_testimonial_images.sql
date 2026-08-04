-- ============================================================
-- 0035 : capture d'écran (image) sur un témoignage.
--
-- Un témoignage peut désormais être une image seule (capture d'écran
-- WhatsApp, avis, message client — plus convaincant qu'une citation
-- tapée), une citation seule, ou les deux. `quote` devient optionnelle,
-- avec la garantie qu'un témoignage n'est jamais totalement vide.
-- ============================================================

alter table public.testimonials add column if not exists image_url text;
alter table public.testimonials alter column quote drop not null;
alter table public.testimonials add constraint testimonials_has_content
  check (quote is not null or image_url is not null);

-- Stockage : bucket dédié, lecture publique (affiché sur la landing),
-- écriture réservée aux admins (seuls gestionnaires de /admin/temoignages).
insert into storage.buckets (id, name, public)
values ('testimonial-images', 'testimonial-images', true)
on conflict (id) do nothing;

create policy "testimonial_images_public_read" on storage.objects
  for select using (bucket_id = 'testimonial-images');

create policy "testimonial_images_admin_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'testimonial-images' and public.is_admin());

create policy "testimonial_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'testimonial-images' and public.is_admin());

create policy "testimonial_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'testimonial-images' and public.is_admin());
