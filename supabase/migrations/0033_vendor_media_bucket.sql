-- ---------------------------------------------------------------------------
-- Vendor images
--
-- Logos and banners are uploaded by the vendor instead of pasted as a link.
-- The files live in a public bucket, one folder per vendor, so the website
-- and the mobile app can both read them straight from the database row.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-media',
  'vendor-media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read the images: they are the storefront.
drop policy if exists "vendor media read" on storage.objects;
create policy "vendor media read" on storage.objects
  for select to public
  using (bucket_id = 'vendor-media');

-- Owners and managers may only write inside their own vendor folder.
drop policy if exists "vendor media upload" on storage.objects;
create policy "vendor media upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vendor-media'
    and exists (
      select 1
      from public.vendor_members vm
      where vm.user_id = auth.uid()
        and vm.active
        and vm.role in ('owner', 'manager')
        and vm.vendor_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "vendor media update" on storage.objects;
create policy "vendor media update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vendor-media'
    and exists (
      select 1
      from public.vendor_members vm
      where vm.user_id = auth.uid()
        and vm.active
        and vm.role in ('owner', 'manager')
        and vm.vendor_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'vendor-media'
    and exists (
      select 1
      from public.vendor_members vm
      where vm.user_id = auth.uid()
        and vm.active
        and vm.role in ('owner', 'manager')
        and vm.vendor_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "vendor media delete" on storage.objects;
create policy "vendor media delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vendor-media'
    and exists (
      select 1
      from public.vendor_members vm
      where vm.user_id = auth.uid()
        and vm.active
        and vm.role in ('owner', 'manager')
        and vm.vendor_id::text = (storage.foldername(name))[1]
    )
  );
