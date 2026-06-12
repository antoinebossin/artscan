-- ArtScan — schéma initial
-- À exécuter dans Supabase (SQL Editor) ou via `supabase db push`.

-- ============ TABLES ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('street', 'museum')),
  photo_url text not null,
  title text,
  artist_name text, -- null = artiste inconnu
  lat double precision,
  lng double precision,
  location_text text, -- ville / quartier
  museum_name text,   -- renseigné si type = museum
  notes text,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  category text not null default 'libre'
    check (category in ('artiste', 'lieu', 'musee', 'theme', 'libre')),
  created_at timestamptz not null default now()
);

create table public.folder_items (
  folder_id uuid not null references public.folders(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (folder_id, artwork_id)
);

create table public.hunts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  share_code text unique not null default substr(md5(random()::text), 1, 8),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.hunt_artworks (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts(id) on delete cascade,
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  points integer not null default 10,
  unique (hunt_id, artwork_id)
);

create table public.hunt_participants (
  id uuid primary key default gen_random_uuid(),
  hunt_id uuid not null references public.hunts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (hunt_id, user_id)
);

create table public.finds (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.hunt_participants(id) on delete cascade,
  hunt_artwork_id uuid not null references public.hunt_artworks(id) on delete cascade,
  photo_url text not null,
  lat double precision,
  lng double precision,
  status text not null default 'pending'
    check (status in ('auto_validated', 'pending', 'rejected', 'approved')),
  found_at timestamptz not null default now(),
  unique (participant_id, hunt_artwork_id)
);

-- ============ INDEXES ============

create index idx_artworks_owner on public.artworks(owner_id);
create index idx_artworks_artist on public.artworks(artist_name);
create index idx_folders_owner on public.folders(owner_id);
create index idx_hunts_share_code on public.hunts(share_code);
create index idx_finds_participant on public.finds(participant_id);

-- ============ RLS ============

alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.folders enable row level security;
alter table public.folder_items enable row level security;
alter table public.hunts enable row level security;
alter table public.hunt_artworks enable row level security;
alter table public.hunt_participants enable row level security;
alter table public.finds enable row level security;

-- Profils : lisibles par tous (pseudos des leaderboards), modifiables par soi.
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Œuvres : le propriétaire fait tout ; les participants d'une course voient ses œuvres.
create policy "artworks_own" on public.artworks for all using (auth.uid() = owner_id);
create policy "artworks_hunt_visible" on public.artworks for select using (
  exists (
    select 1 from public.hunt_artworks ha
    join public.hunts h on h.id = ha.hunt_id
    where ha.artwork_id = artworks.id and h.is_published
  )
);

-- Folders : privés.
create policy "folders_own" on public.folders for all using (auth.uid() = owner_id);
create policy "folder_items_own" on public.folder_items for all using (
  exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
);

-- Courses : créateur = tout ; publiées = visibles par tous.
create policy "hunts_own" on public.hunts for all using (auth.uid() = creator_id);
create policy "hunts_published" on public.hunts for select using (is_published);

create policy "hunt_artworks_own" on public.hunt_artworks for all using (
  exists (select 1 from public.hunts h where h.id = hunt_id and h.creator_id = auth.uid())
);
create policy "hunt_artworks_published" on public.hunt_artworks for select using (
  exists (select 1 from public.hunts h where h.id = hunt_id and h.is_published)
);

-- Participants : on rejoint soi-même ; visibles entre participants d'une même course publiée.
create policy "participants_join" on public.hunt_participants for insert with check (auth.uid() = user_id);
create policy "participants_select" on public.hunt_participants for select using (
  exists (select 1 from public.hunts h where h.id = hunt_id and (h.is_published or h.creator_id = auth.uid()))
);

-- Finds : le participant crée les siens ; visibles par la course (leaderboard) ; créateur peut modérer.
create policy "finds_insert" on public.finds for insert with check (
  exists (select 1 from public.hunt_participants p where p.id = participant_id and p.user_id = auth.uid())
);
create policy "finds_select" on public.finds for select using (
  exists (
    select 1 from public.hunt_participants p
    join public.hunts h on h.id = p.hunt_id
    where p.id = participant_id and (h.is_published or h.creator_id = auth.uid())
  )
);
create policy "finds_moderate" on public.finds for update using (
  exists (
    select 1 from public.hunt_participants p
    join public.hunts h on h.id = p.hunt_id
    where p.id = participant_id and h.creator_id = auth.uid()
  )
);

-- ============ STORAGE ============
-- Créer un bucket public "photos" dans Supabase Storage (Dashboard > Storage),
-- puis ces politiques :

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos_upload" on storage.objects for insert
with check (bucket_id = 'photos' and auth.role() = 'authenticated');

create policy "photos_read" on storage.objects for select
using (bucket_id = 'photos');

-- ============ TRIGGER PROFIL AUTO ============
-- Crée un profil automatiquement à l'inscription.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
