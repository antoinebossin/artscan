-- Chaque dossier appartient a un monde : street ou musee
alter table public.folders
  add column if not exists mode text not null default 'street'
  check (mode in ('street', 'museum'));
