-- Task 4: public media bucket; only editors may write objects.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists media_editor_insert on storage.objects;
drop policy if exists media_editor_update on storage.objects;
drop policy if exists media_editor_delete on storage.objects;

create policy media_editor_insert on storage.objects for insert
  with check (bucket_id = 'media' and (select public.is_editor()));
create policy media_editor_update on storage.objects for update
  using (bucket_id = 'media' and (select public.is_editor()))
  with check (bucket_id = 'media' and (select public.is_editor()));
create policy media_editor_delete on storage.objects for delete
  using (bucket_id = 'media' and (select public.is_editor()));
