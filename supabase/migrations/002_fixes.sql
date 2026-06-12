-- Dedoublonnage des dossiers (garde le plus ancien)
delete from public.folders f
using public.folders g
where f.owner_id = g.owner_id
  and lower(f.name) = lower(g.name)
  and (f.created_at > g.created_at
       or (f.created_at = g.created_at and f.id > g.id));

-- Unicite : un nom de dossier par utilisateur
create unique index if not exists folders_owner_name_key
  on public.folders (owner_id, lower(name));

-- Suppression de ses propres photos dans le Storage
create policy "photos_delete_own" on storage.objects for delete
using (bucket_id = 'photos' and auth.uid() = owner);
